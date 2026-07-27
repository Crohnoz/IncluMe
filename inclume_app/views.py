import json
from json import JSONDecodeError

from django.conf import settings
from django.core.signing import salted_hmac
from django.db import connection
from django.http import Http404, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .forms import ParkingSubmissionForm, ParkingVerificationForm
from .models import Parking
from .services import (
    DuplicateVerificationError,
    create_parking_submission,
    create_parking_verification,
    find_possible_duplicates,
    serialize_parking,
)


def home(request):
    return render(request, "index.html", {"current_page": "home"})


def resources(request):
    return render(request, "resources.html", {"current_page": "resources"})


@ensure_csrf_cookie
def parking(request):
    return render(
        request,
        "parking.html",
        {
            "current_page": "parking",
            "map_tile_url": settings.MAP_TILE_URL,
            "map_tile_attribution": settings.MAP_TILE_ATTRIBUTION,
        },
    )


def contact(request):
    return render(request, "contact.html", {"current_page": "contact"})


def _normalize_form_payload(payload: dict) -> dict:
    normalized = {}
    for key, value in payload.items():
        if isinstance(value, bool):
            normalized[key] = "true" if value else "false"
        elif value is None:
            normalized[key] = ""
        else:
            normalized[key] = value
    return normalized


def _request_payload(request) -> dict:
    content_type = request.headers.get("Content-Type", "")
    if "application/json" in content_type:
        try:
            payload = json.loads(request.body or "{}")
        except JSONDecodeError as exc:
            raise ValueError("El cuerpo JSON no es válido.") from exc
        if not isinstance(payload, dict):
            raise ValueError("El cuerpo de la solicitud debe ser un objeto JSON.")
        return _normalize_form_payload(payload)
    return request.POST.dict()


def _form_errors(form) -> dict:
    return {
        field: [item["message"] for item in errors]
        for field, errors in form.errors.get_json_data().items()
    }


def _is_throttled(request, key: str, seconds: int) -> bool:
    now = timezone.now().timestamp()
    last_value = request.session.get(f"inclume_rate_{key}")
    return bool(last_value and now - float(last_value) < seconds)


def _mark_throttle(request, key: str) -> None:
    request.session[f"inclume_rate_{key}"] = timezone.now().timestamp()


def _truthy(value) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _verification_fingerprint(request, parking_id: int) -> str:
    """Create a non-reversible six-hour deduplication token without storing IPs."""
    if getattr(request.user, "is_authenticated", False):
        identity = f"user:{request.user.pk}"
    else:
        if not request.session.session_key:
            request.session.create()
        identity = f"session:{request.session.session_key}"

    six_hour_bucket = int(timezone.now().timestamp() // (6 * 60 * 60))
    value = f"{identity}:parking:{parking_id}:bucket:{six_hour_bucket}"
    return salted_hmac("inclume.parking-verification", value).hexdigest()


@require_GET
@never_cache
def health(request):
    """Small readiness endpoint for Render and operational monitoring."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:  # pragma: no cover - exercised by infrastructure failures.
        return JsonResponse(
            {
                "status": "degraded",
                "database": "unavailable",
            },
            status=503,
        )

    return JsonResponse(
        {
            "status": "ok",
            "database": "ok",
            "timestamp": timezone.now().isoformat(),
        }
    )


@require_GET
@never_cache
def service_worker(request):
    """Serve the worker at the site root so it can control the complete product."""
    worker_path = settings.BASE_DIR / "static" / "service-worker.js"
    try:
        content = worker_path.read_text(encoding="utf-8")
    except OSError:
        raise Http404 from None

    response = HttpResponse(content, content_type="application/javascript; charset=utf-8")
    response["Service-Worker-Allowed"] = "/"
    response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


@require_GET
def parking_data(request):
    """Return published parking data for the map and accessible list view."""
    parkings = (
        Parking.objects.filter(is_published=True)
        .exclude(status=Parking.Status.REMOVED)
        .filter(latitude__isnull=False, longitude__isnull=False)
        .order_by("-last_verified_at", "name")
    )
    payload = [serialize_parking(item) for item in parkings]
    response = JsonResponse(
        {
            "parkings": payload,
            "count": len(payload),
            "generated_at": timezone.now().isoformat(),
        },
        json_dumps_params={"ensure_ascii": False},
    )
    response["Cache-Control"] = "public, max-age=30, stale-while-revalidate=300"
    return response


@require_POST
def submit_parking(request):
    if _is_throttled(request, "submit_parking", 20):
        return JsonResponse(
            {
                "ok": False,
                "message": "Espera unos segundos antes de enviar otro aporte.",
            },
            status=429,
        )

    try:
        payload = _request_payload(request)
    except ValueError as exc:
        return JsonResponse({"ok": False, "message": str(exc)}, status=400)

    confirm_duplicate = _truthy(payload.pop("confirm_duplicate", "false"))
    form = ParkingSubmissionForm(payload)
    if not form.is_valid():
        return JsonResponse(
            {
                "ok": False,
                "message": "Revisa los datos del estacionamiento.",
                "errors": _form_errors(form),
            },
            status=400,
        )

    duplicates = find_possible_duplicates(
        latitude=form.cleaned_data["latitude"],
        longitude=form.cleaned_data["longitude"],
    )
    if duplicates and not confirm_duplicate:
        return JsonResponse(
            {
                "ok": False,
                "code": "possible_duplicate",
                "message": (
                    "Encontramos lugares muy cercanos. Revísalos antes de crear "
                    "otro registro."
                ),
                "duplicates": duplicates,
            },
            status=409,
            json_dumps_params={"ensure_ascii": False},
        )

    parking_item = create_parking_submission(
        cleaned_data=form.cleaned_data,
        user=request.user,
    )
    _mark_throttle(request, "submit_parking")
    return JsonResponse(
        {
            "ok": True,
            "id": parking_item.pk,
            "message": (
                "Recibimos tu aporte. Se publicará después de una revisión "
                "para proteger la calidad de la información."
            ),
        },
        status=201,
        json_dumps_params={"ensure_ascii": False},
    )


@require_POST
def verify_parking(request, parking_id: int):
    parking_item = get_object_or_404(
        Parking,
        pk=parking_id,
        is_published=True,
    )
    if parking_item.status == Parking.Status.REMOVED:
        raise Http404

    try:
        payload = _request_payload(request)
    except ValueError as exc:
        return JsonResponse({"ok": False, "message": str(exc)}, status=400)

    form = ParkingVerificationForm(payload)
    if not form.is_valid():
        return JsonResponse(
            {
                "ok": False,
                "message": "Revisa las respuestas de la verificación.",
                "errors": _form_errors(form),
            },
            status=400,
        )

    try:
        create_parking_verification(
            parking=parking_item,
            cleaned_data=form.cleaned_data,
            fingerprint=_verification_fingerprint(request, parking_id),
            user=request.user,
        )
    except DuplicateVerificationError:
        parking_item.refresh_from_db()
        return JsonResponse(
            {
                "ok": False,
                "code": "duplicate_verification",
                "message": (
                    "Ya recibimos una verificación desde este dispositivo durante "
                    "las últimas horas."
                ),
                "parking": serialize_parking(parking_item),
            },
            status=409,
            json_dumps_params={"ensure_ascii": False},
        )

    parking_item.refresh_from_db()
    return JsonResponse(
        {
            "ok": True,
            "message": "Gracias. Tu verificación ayudará a la siguiente persona.",
            "parking": serialize_parking(parking_item),
        },
        status=201,
        json_dumps_params={"ensure_ascii": False},
    )
