from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET

from .models import Parking


def home(request):
    return render(request, "index.html")


def resources(request):
    return render(request, "resources.html")


def parking(request):
    return render(request, "parking.html")


def contact(request):
    return render(request, "contact.html")


@require_GET
def parking_data(request):
    """Return public parking data for the map and accessible list view."""
    parkings = (
        Parking.objects.exclude(status=Parking.Status.REMOVED)
        .filter(latitude__isnull=False, longitude__isnull=False)
        .order_by("-last_verified_at", "name")
    )

    feature_fields = (
        ("has_official_signage", "Señalización oficial"),
        ("has_transfer_space", "Espacio de transferencia"),
        ("has_level_surface", "Superficie nivelada"),
        ("has_curb_ramp", "Rebaje de solera o rampa"),
        ("has_step_free_route", "Ruta sin escalones"),
        ("is_well_lit", "Buena iluminación"),
        ("is_covered", "Estacionamiento cubierto"),
    )

    payload = []
    for item in parkings:
        payload.append(
            {
                "id": item.pk,
                "name": item.name,
                "location": item.location,
                "latitude": float(item.latitude),
                "longitude": float(item.longitude),
                "place_type": item.get_place_type_display(),
                "status": item.status,
                "status_label": item.get_status_display(),
                "accessibility_info": item.accessibility_info,
                "features": [
                    label
                    for field_name, label in feature_fields
                    if getattr(item, field_name) is True
                ],
                "schedule_info": item.schedule_info,
                "cost_info": item.cost_info,
                "verification_count": item.verification_count,
                "last_verified_at": (
                    item.last_verified_at.isoformat()
                    if item.last_verified_at
                    else None
                ),
            }
        )

    return JsonResponse(
        {"parkings": payload, "count": len(payload)},
        json_dumps_params={"ensure_ascii": False},
    )
