from __future__ import annotations

import csv
from datetime import timedelta

from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Count, Q, Sum
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.cache import cache_page
from django.views.decorators.http import require_GET

from .models import Parking
from .services import availability_signal, trust_level, verification_freshness


STALE_AFTER_DAYS = 90


def _public_parkings():
    return (
        Parking.objects.filter(
            moderation_status=Parking.ModerationStatus.APPROVED,
            is_published=True,
            latitude__isnull=False,
            longitude__isnull=False,
        )
        .exclude(status=Parking.Status.REMOVED)
        .select_related("reviewed_by")
    )


def _metrics(queryset=None) -> dict:
    queryset = queryset if queryset is not None else _public_parkings()
    stale_cutoff = timezone.now() - timedelta(days=STALE_AFTER_DAYS)
    aggregate = queryset.aggregate(
        published_count=Count("id"),
        verified_count=Count("id", filter=Q(status=Parking.Status.VERIFIED)),
        unavailable_count=Count("id", filter=Q(status=Parking.Status.UNAVAILABLE)),
        positive_confirmations=Sum("verification_count"),
        issue_reports=Sum("issue_report_count"),
        step_free_count=Count("id", filter=Q(has_step_free_route=True)),
        transfer_space_count=Count("id", filter=Q(has_transfer_space=True)),
        stale_count=Count(
            "id",
            filter=Q(last_verified_at__lt=stale_cutoff) | Q(last_verified_at__isnull=True),
        ),
    )
    return {key: value or 0 for key, value in aggregate.items()}


def municipalities(request):
    queryset = _public_parkings()
    metrics = _metrics(queryset)
    place_type_coverage = list(
        queryset.values("place_type")
        .annotate(total=Count("id"))
        .order_by("-total", "place_type")
    )
    labels = dict(Parking.PlaceType.choices)
    for item in place_type_coverage:
        item["label"] = labels.get(item["place_type"], "Otro")

    return render(
        request,
        "municipalities.html",
        {
            "current_page": "municipalities",
            "metrics": metrics,
            "place_type_coverage": place_type_coverage,
            "generated_at": timezone.now(),
        },
    )


@require_GET
@cache_page(60)
def municipal_summary_api(request):
    metrics = _metrics()
    return JsonResponse(
        {
            "ok": True,
            "scope": "catalogo_publico_aprobado",
            "stale_after_days": STALE_AFTER_DAYS,
            "metrics": metrics,
            "generated_at": timezone.now().isoformat(),
            "disclaimer": (
                "La información es comunitaria y no garantiza disponibilidad en tiempo real."
            ),
        },
        json_dumps_params={"ensure_ascii": False},
    )


def _territory_filter(queryset, value: str):
    value = " ".join((value or "").strip().split())[:120]
    if not value:
        return queryset, ""
    return (
        queryset.filter(
            Q(name__icontains=value)
            | Q(location__icontains=value)
            | Q(vehicle_access_notes__icontains=value)
            | Q(accessible_entrance_notes__icontains=value)
        ),
        value,
    )


@staff_member_required
@require_GET
def municipal_dashboard(request):
    queryset, territory_query = _territory_filter(
        _public_parkings().order_by("name", "location"),
        request.GET.get("territory", ""),
    )
    rows = []
    for parking in queryset[:250]:
        rows.append(
            {
                "parking": parking,
                "trust_level": trust_level(parking),
                "availability_signal": availability_signal(parking),
                "freshness": verification_freshness(parking),
            }
        )

    return render(
        request,
        "municipal_dashboard.html",
        {
            "current_page": "municipal_dashboard",
            "metrics": _metrics(queryset),
            "rows": rows,
            "territory_query": territory_query,
            "result_limit_reached": queryset.count() > 250,
            "generated_at": timezone.now(),
        },
    )


@staff_member_required
@require_GET
def municipal_export_csv(request):
    queryset, territory_query = _territory_filter(
        _public_parkings().order_by("name", "location"),
        request.GET.get("territory", ""),
    )
    filename = "inclume-estacionamientos"
    if territory_query:
        safe_fragment = "-".join(territory_query.lower().split())[:50]
        filename = f"{filename}-{safe_fragment}"

    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}.csv"'
    response.write("\ufeff")
    writer = csv.writer(response)
    writer.writerow(
        [
            "id",
            "nombre",
            "direccion_referencia",
            "latitud",
            "longitud",
            "tipo_lugar",
            "estado_operativo",
            "nivel_confianza",
            "senal_disponibilidad",
            "frescura_verificacion",
            "confirmaciones",
            "incidencias",
            "ultima_confirmacion",
            "ultima_incidencia",
            "distancia_entrada_m",
            "ruta_sin_escalones",
            "espacio_transferencia",
            "rebaje_rampa",
            "lado_transferencia",
            "superficie",
            "actualizado",
        ]
    )
    for parking in queryset.iterator():
        writer.writerow(
            [
                parking.pk,
                parking.name,
                parking.location,
                parking.latitude,
                parking.longitude,
                parking.get_place_type_display(),
                parking.get_status_display(),
                trust_level(parking),
                availability_signal(parking),
                verification_freshness(parking),
                parking.verification_count,
                parking.issue_report_count,
                parking.last_verified_at.isoformat() if parking.last_verified_at else "",
                parking.last_reported_at.isoformat() if parking.last_reported_at else "",
                parking.distance_to_entrance_m or "",
                parking.has_step_free_route,
                parking.has_transfer_space,
                parking.has_curb_ramp,
                parking.get_transfer_side_display(),
                parking.get_surface_type_display(),
                parking.updated_at.isoformat(),
            ]
        )
    return response
