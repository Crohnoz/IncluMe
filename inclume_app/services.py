from __future__ import annotations

import math
from datetime import timedelta
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Count, Max, Q
from django.utils import timezone

from .models import Parking, ParkingIssueType, ParkingVerification


FEATURE_FIELDS = (
    ("has_official_signage", "Señalización oficial"),
    ("has_transfer_space", "Espacio de transferencia"),
    ("has_level_surface", "Superficie nivelada"),
    ("has_curb_ramp", "Rebaje de solera o rampa"),
    ("has_step_free_route", "Ruta sin escalones"),
    ("is_well_lit", "Buena iluminación"),
    ("is_covered", "Protección climática"),
)


class DuplicateVerificationError(Exception):
    """Raised when the same privacy-preserving identity submits twice in a window."""


POSITIVE_VERIFICATION_FILTER = Q(
    is_available=True,
    accessibility_confirmed=True,
    issue_type=ParkingIssueType.NONE,
)
ISSUE_VERIFICATION_FILTER = (
    Q(is_available=False)
    | Q(accessibility_confirmed=False)
    | ~Q(issue_type=ParkingIssueType.NONE)
)


def availability_signal(parking: Parking) -> str:
    """Return an honest, time-bounded signal without claiming live availability."""
    if parking.status == Parking.Status.UNAVAILABLE:
        return "unavailable"

    now = timezone.now()
    latest_positive = parking.last_verified_at
    latest_issue = parking.last_reported_at

    if (
        latest_issue
        and now - latest_issue <= timedelta(hours=12)
        and (not latest_positive or latest_issue >= latest_positive)
    ):
        return "issue_reported"

    if latest_positive and now - latest_positive <= timedelta(hours=6):
        return "recently_confirmed"

    return "unknown"


def trust_level(parking: Parking) -> str:
    signal = availability_signal(parking)
    if signal in {"unavailable", "issue_reported"}:
        return "warning"
    if parking.status == Parking.Status.VERIFIED and parking.verification_count >= 3:
        return "community"
    if parking.status == Parking.Status.VERIFIED:
        return "verified"
    return "new"


def verification_freshness(parking: Parking) -> str:
    if not parking.last_verified_at:
        return "unknown"
    age = timezone.now() - parking.last_verified_at
    if age <= timedelta(days=7):
        return "fresh"
    if age <= timedelta(days=30):
        return "aging"
    return "stale"


def serialize_parking(parking: Parking) -> dict:
    features = [
        label
        for field_name, label in FEATURE_FIELDS
        if getattr(parking, field_name) is True
    ]
    return {
        "id": parking.pk,
        "name": parking.name,
        "location": parking.location,
        "latitude": float(parking.latitude),
        "longitude": float(parking.longitude),
        "entrance_latitude": (
            float(parking.entrance_latitude)
            if parking.entrance_latitude is not None
            else None
        ),
        "entrance_longitude": (
            float(parking.entrance_longitude)
            if parking.entrance_longitude is not None
            else None
        ),
        "place_type": parking.place_type,
        "place_type_label": parking.get_place_type_display(),
        "status": parking.status,
        "status_label": parking.get_status_display(),
        "trust_level": trust_level(parking),
        "availability_signal": availability_signal(parking),
        "verification_freshness": verification_freshness(parking),
        "accessibility_info": parking.accessibility_info,
        "vehicle_access_notes": parking.vehicle_access_notes,
        "accessible_entrance_notes": parking.accessible_entrance_notes,
        "photo_url": parking.photo_url,
        "features": features,
        "has_official_signage": parking.has_official_signage,
        "has_transfer_space": parking.has_transfer_space,
        "has_level_surface": parking.has_level_surface,
        "has_curb_ramp": parking.has_curb_ramp,
        "has_step_free_route": parking.has_step_free_route,
        "is_well_lit": parking.is_well_lit,
        "is_covered": parking.is_covered,
        "transfer_side": parking.transfer_side,
        "transfer_side_label": parking.get_transfer_side_display(),
        "surface_type": parking.surface_type,
        "surface_type_label": parking.get_surface_type_display(),
        "distance_to_entrance_m": parking.distance_to_entrance_m,
        "schedule_info": parking.schedule_info,
        "cost_info": parking.cost_info,
        "verification_count": parking.verification_count,
        "issue_report_count": parking.issue_report_count,
        "last_verified_at": (
            parking.last_verified_at.isoformat()
            if parking.last_verified_at
            else None
        ),
        "last_reported_at": (
            parking.last_reported_at.isoformat()
            if parking.last_reported_at
            else None
        ),
        "last_issue_type": parking.last_issue_type,
        "last_issue_type_label": parking.last_issue_label,
        "updated_at": parking.updated_at.isoformat(),
    }


def _haversine_m(
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


def find_possible_duplicates(
    *,
    latitude: Decimal,
    longitude: Decimal,
    radius_m: int = 45,
    limit: int = 5,
) -> list[dict]:
    """Find nearby records without requiring PostGIS during the pilot stage."""
    latitude_float = float(latitude)
    longitude_float = float(longitude)
    latitude_delta = radius_m / 111_320
    longitude_scale = max(math.cos(math.radians(latitude_float)), 0.2)
    longitude_delta = radius_m / (111_320 * longitude_scale)

    candidates = (
        Parking.objects.exclude(status=Parking.Status.REMOVED)
        .filter(
            latitude__range=(
                Decimal(str(latitude_float - latitude_delta)),
                Decimal(str(latitude_float + latitude_delta)),
            ),
            longitude__range=(
                Decimal(str(longitude_float - longitude_delta)),
                Decimal(str(longitude_float + longitude_delta)),
            ),
        )
        .only("id", "name", "location", "latitude", "longitude", "is_published")
    )

    matches = []
    for candidate in candidates:
        distance_m = _haversine_m(
            latitude_float,
            longitude_float,
            float(candidate.latitude),
            float(candidate.longitude),
        )
        if distance_m <= radius_m:
            matches.append(
                {
                    "id": candidate.pk,
                    "name": candidate.name,
                    "location": candidate.location,
                    "distance_m": round(distance_m),
                    "is_published": candidate.is_published,
                }
            )

    return sorted(matches, key=lambda item: item["distance_m"])[:limit]


@transaction.atomic
def create_parking_submission(*, cleaned_data: dict, user=None) -> Parking:
    parking = Parking.objects.create(
        **cleaned_data,
        status=Parking.Status.PENDING,
        is_published=False,
        created_by=user if getattr(user, "is_authenticated", False) else None,
    )
    return parking


def create_parking_verification(
    *,
    parking: Parking,
    cleaned_data: dict,
    fingerprint: str,
    user=None,
) -> ParkingVerification:
    try:
        with transaction.atomic():
            verification = ParkingVerification.objects.create(
                parking=parking,
                user=user if getattr(user, "is_authenticated", False) else None,
                submission_fingerprint=fingerprint,
                **cleaned_data,
            )

            aggregate = parking.verifications.aggregate(
                positive_count=Count("id", filter=POSITIVE_VERIFICATION_FILTER),
                issue_count=Count("id", filter=ISSUE_VERIFICATION_FILTER),
                last_verified_at=Max(
                    "created_at",
                    filter=POSITIVE_VERIFICATION_FILTER,
                ),
                last_reported_at=Max(
                    "created_at",
                    filter=ISSUE_VERIFICATION_FILTER,
                ),
            )
            latest_issue_type = (
                parking.verifications.filter(ISSUE_VERIFICATION_FILTER)
                .order_by("-created_at")
                .values_list("issue_type", flat=True)
                .first()
                or ParkingIssueType.NONE
            )

            parking.verification_count = aggregate["positive_count"] or 0
            parking.issue_report_count = aggregate["issue_count"] or 0
            parking.last_verified_at = aggregate["last_verified_at"]
            parking.last_reported_at = aggregate["last_reported_at"]
            parking.last_issue_type = latest_issue_type
            parking.save(
                update_fields=[
                    "verification_count",
                    "issue_report_count",
                    "last_verified_at",
                    "last_reported_at",
                    "last_issue_type",
                    "updated_at",
                ]
            )
            return verification
    except IntegrityError as exc:
        if fingerprint and ParkingVerification.objects.filter(
            parking=parking,
            submission_fingerprint=fingerprint,
        ).exists():
            raise DuplicateVerificationError from exc
        raise
