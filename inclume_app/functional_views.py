from __future__ import annotations

from urllib.parse import urlencode

from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET

from .forms import coordinates_are_in_chile
from .geocoding import (
    GeocodingError,
    GeocodingRateLimited,
    find_nearby_published_parkings,
    geocode_chile_destination,
    normalize_destination_query,
)


RADIUS_OPTIONS = (0.5, 1.0, 2.0, 5.0, 10.0)


def _parse_radius(value) -> float:
    try:
        radius = float(value)
    except (TypeError, ValueError):
        return 2.0
    return min(RADIUS_OPTIONS, key=lambda item: abs(item - radius))


def _parse_coordinate(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def destination_search(request):
    query = normalize_destination_query(request.GET.get("q", ""))
    radius_km = _parse_radius(request.GET.get("radius"))
    latitude = _parse_coordinate(request.GET.get("latitude"))
    longitude = _parse_coordinate(request.GET.get("longitude"))
    destination_label = " ".join(request.GET.get("label", "").strip().split())[:300]

    geocoding_results = []
    nearby_parkings = []
    error_message = ""
    destination = None

    if latitude is not None or longitude is not None:
        if latitude is None or longitude is None or not coordinates_are_in_chile(latitude, longitude):
            error_message = "El destino seleccionado no tiene coordenadas válidas dentro de Chile."
        else:
            destination = {
                "label": destination_label or "Destino seleccionado",
                "latitude": latitude,
                "longitude": longitude,
            }
            nearby_parkings = find_nearby_published_parkings(
                latitude=latitude,
                longitude=longitude,
                radius_km=radius_km,
            )
    elif query:
        try:
            geocoding_results = geocode_chile_destination(query)
            if not geocoding_results:
                error_message = (
                    "No encontramos ese destino en Chile. Prueba con el nombre del lugar, "
                    "comuna y ciudad."
                )
        except GeocodingRateLimited as exc:
            error_message = str(exc)
        except GeocodingError as exc:
            error_message = str(exc)

    map_payload = {
        "destination": destination,
        "parkings": nearby_parkings,
        "tile_url": settings.MAP_TILE_URL,
        "tile_attribution": settings.MAP_TILE_ATTRIBUTION,
    }

    return render(
        request,
        "destination_search.html",
        {
            "current_page": "parking",
            "query": query,
            "radius_km": radius_km,
            "radius_options": RADIUS_OPTIONS,
            "geocoding_results": geocoding_results,
            "destination": destination,
            "nearby_parkings": nearby_parkings,
            "error_message": error_message,
            "map_payload": map_payload,
        },
    )


@require_GET
@never_cache
def nearby_parkings_api(request):
    latitude = _parse_coordinate(request.GET.get("latitude"))
    longitude = _parse_coordinate(request.GET.get("longitude"))
    radius_km = _parse_radius(request.GET.get("radius"))

    if latitude is None or longitude is None or not coordinates_are_in_chile(latitude, longitude):
        return JsonResponse(
            {
                "ok": False,
                "message": "Envía coordenadas válidas dentro de Chile.",
            },
            status=400,
        )

    parkings = find_nearby_published_parkings(
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
    )
    response = JsonResponse(
        {
            "ok": True,
            "origin": {"latitude": latitude, "longitude": longitude},
            "radius_km": radius_km,
            "parkings": parkings,
            "count": len(parkings),
            "generated_at": timezone.now().isoformat(),
        },
        json_dumps_params={"ensure_ascii": False},
    )
    response["Cache-Control"] = "public, max-age=30, stale-while-revalidate=300"
    return response


def advanced_map_url(*, latitude: float | None = None, longitude: float | None = None) -> str:
    base = reverse("parking_map")
    if latitude is None or longitude is None:
        return base
    return f"{base}?{urlencode({'latitude': latitude, 'longitude': longitude})}"
