import json
from json import JSONDecodeError

from django.conf import settings
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .forms import ParkingSubmissionForm, ParkingVerificationForm
from .models import Parking
from .services import (
    create_parking_submission,
    create_parking_verification,
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
    return JsonResponse(
        {
            "parkings": payload,
            "count": len(payload),
            "generated_at": timezone.now().isoformat(),
        },
        json_dumps_params={"ensure_ascii": False},
    )


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

    parking = create_parking_submission(
        cleaned_data=form.cleaned_data,
        user=request.user,
    )
    _mark_throttle(request, "submit_parking")
    return JsonResponse(
        {
            "ok": True,
            "id": parking.pk,
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
    if _is_throttled(request, f"verify_parking_{parking_id}", 12):
        return JsonResponse(
            {
                "ok": False,
                "message": "Espera unos segundos antes de verificar nuevamente.",
            },
            status=429,
        )

    parking = get_object_or_404(
        Parking,
        pk=parking_id,
        is_published=True,
    )
    if parking.status == Parking.Status.REMOVED:
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

    create_parking_verification(
        parking=parking,
        cleaned_data=form.cleaned_data,
        user=request.user,
    )
    _mark_throttle(request, f"verify_parking_{parking_id}")
    parking.refresh_from_db()
    return JsonResponse(
        {
            "ok": True,
            "message": "Gracias. Tu verificación ayudará a la siguiente persona.",
            "parking": serialize_parking(parking),
        },
        status=201,
        json_dumps_params={"ensure_ascii": False},
    )
