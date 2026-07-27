from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.cache import cache

from .models import Parking
from .services import serialize_parking


class GeocodingError(RuntimeError):
    """Raised when the configured geocoder cannot complete a user search."""


class GeocodingRateLimited(GeocodingError):
    """Raised when the shared one-request-per-second budget is already in use."""


@dataclass(frozen=True)
class Destination:
    label: str
    latitude: float
    longitude: float
    category: str = ""
    place_type: str = ""

    def as_dict(self) -> dict:
        return {
            "label": self.label,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "category": self.category,
            "place_type": self.place_type,
        }


def normalize_destination_query(value: str) -> str:
    return " ".join((value or "").strip().split())[:160]


def _query_cache_key(query: str) -> str:
    digest = hashlib.sha256(query.casefold().encode("utf-8")).hexdigest()
    return f"inclume:geocode:v1:{digest}"


def _inside_chile_bounds(latitude: float, longitude: float) -> bool:
    return -58.0 <= latitude <= -15.0 and -112.0 <= longitude <= -64.0


def geocode_chile_destination(query: str) -> list[dict]:
    """Geocode one explicit end-user search, with shared cache and throttling.

    The public Nominatim endpoint is intentionally used only for submitted searches.
    Autocomplete, background lookups and bulk requests are not supported.
    """

    normalized = normalize_destination_query(query)
    if len(normalized) < 3:
        raise GeocodingError("Escribe al menos tres caracteres para buscar un destino.")

    cache_key = _query_cache_key(normalized)
    cached = cache.get(cache_key)
    if isinstance(cached, list):
        return cached

    # The public service allows an absolute maximum of one request per second for
    # the complete application. DatabaseCache makes this lock shared by workers.
    if not cache.add("inclume:nominatim:global-throttle", "1", timeout=2):
        raise GeocodingRateLimited(
            "Hay otra búsqueda en curso. Espera un momento y vuelve a intentarlo."
        )

    params = {
        "q": f"{normalized}, Chile",
        "format": "jsonv2",
        "countrycodes": "cl",
        "limit": "5",
        "addressdetails": "1",
        "accept-language": "es",
        "viewbox": "-112,-15,-64,-58",
        "bounded": "1",
    }
    request = Request(
        f"{settings.GEOCODING_URL}?{urlencode(params)}",
        headers={
            "Accept": "application/json",
            "Accept-Language": "es-CL,es;q=0.9",
            "User-Agent": settings.GEOCODING_USER_AGENT,
            "Referer": settings.GEOCODING_REFERER,
        },
        method="GET",
    )

    try:
        with urlopen(request, timeout=settings.GEOCODING_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 429:
            raise GeocodingRateLimited(
                "El buscador de direcciones está ocupado. Intenta nuevamente en unos segundos."
            ) from exc
        raise GeocodingError("El buscador de destinos no respondió correctamente.") from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise GeocodingError(
            "No pudimos consultar el destino. Revisa tu conexión o intenta nuevamente."
        ) from exc

    results: list[dict] = []
    if isinstance(payload, list):
        for item in payload:
            try:
                latitude = float(item["lat"])
                longitude = float(item["lon"])
            except (KeyError, TypeError, ValueError):
                continue
            if not _inside_chile_bounds(latitude, longitude):
                continue
            label = " ".join(str(item.get("display_name", normalized)).split())[:300]
            results.append(
                Destination(
                    label=label,
                    latitude=latitude,
                    longitude=longitude,
                    category=str(item.get("category", ""))[:40],
                    place_type=str(item.get("type", ""))[:40],
                ).as_dict()
            )

    cache.set(cache_key, results, timeout=settings.GEOCODING_CACHE_SECONDS)
    return results


def haversine_m(
    origin_latitude: float,
    origin_longitude: float,
    destination_latitude: float,
    destination_longitude: float,
) -> float:
    earth_radius_m = 6_371_000
    lat1 = math.radians(origin_latitude)
    lat2 = math.radians(destination_latitude)
    delta_lat = math.radians(destination_latitude - origin_latitude)
    delta_lon = math.radians(destination_longitude - origin_longitude)
    value = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    )
    return earth_radius_m * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def find_nearby_published_parkings(
    *,
    latitude: float,
    longitude: float,
    radius_km: float = 2.0,
    limit: int = 50,
) -> list[dict]:
    """Return approved public records ordered by straight-line distance."""

    radius_km = min(max(float(radius_km), 0.25), 10.0)
    radius_m = radius_km * 1000
    latitude_delta = radius_m / 111_320
    longitude_scale = max(math.cos(math.radians(latitude)), 0.2)
    longitude_delta = radius_m / (111_320 * longitude_scale)

    candidates = (
        Parking.objects.filter(
            is_published=True,
            moderation_status=Parking.ModerationStatus.APPROVED,
            latitude__isnull=False,
            longitude__isnull=False,
            latitude__range=(
                Decimal(str(latitude - latitude_delta)),
                Decimal(str(latitude + latitude_delta)),
            ),
            longitude__range=(
                Decimal(str(longitude - longitude_delta)),
                Decimal(str(longitude + longitude_delta)),
            ),
        )
        .exclude(status=Parking.Status.REMOVED)
        .select_related("reviewed_by")
    )

    matches: list[dict] = []
    for parking in candidates:
        distance_m = haversine_m(
            latitude,
            longitude,
            float(parking.latitude),
            float(parking.longitude),
        )
        if distance_m > radius_m:
            continue
        item = serialize_parking(parking)
        item["distance_m"] = round(distance_m)
        item["distance_km"] = round(distance_m / 1000, 2)
        item["google_maps_url"] = (
            "https://www.google.com/maps/dir/?api=1&destination="
            f"{parking.latitude},{parking.longitude}"
        )
        item["waze_url"] = (
            "https://www.waze.com/ul?ll="
            f"{parking.latitude},{parking.longitude}&navigate=yes"
        )
        matches.append(item)

    matches.sort(
        key=lambda item: (
            item["distance_m"],
            -int(item.get("verification_count") or 0),
            item["name"].casefold(),
        )
    )
    return matches[:limit]
