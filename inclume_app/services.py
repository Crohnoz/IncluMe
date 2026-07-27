from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Max
from django.utils import timezone

from .models import Parking, ParkingVerification


FEATURE_FIELDS = (
    ("has_official_signage", "Señalización oficial"),
    ("has_transfer_space", "Espacio de transferencia"),
    ("has_level_surface", "Superficie nivelada"),
    ("has_curb_ramp", "Rebaje de solera o rampa"),
    ("has_step_free_route", "Ruta sin escalones"),
    ("is_well_lit", "Buena iluminación"),
    ("is_covered", "Protección climática"),
)


def trust_level(parking: Parking) -> str:
    if parking.status == Parking.Status.UNAVAILABLE:
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
        "last_verified_at": (
            parking.last_verified_at.isoformat()
            if parking.last_verified_at
            else None
        ),
        "updated_at": parking.updated_at.isoformat(),
    }


@transaction.atomic
def create_parking_submission(*, cleaned_data: dict, user=None) -> Parking:
    parking = Parking.objects.create(
        **cleaned_data,
        status=Parking.Status.PENDING,
        is_published=False,
        created_by=user if getattr(user, "is_authenticated", False) else None,
    )
    return parking


@transaction.atomic
def create_parking_verification(
    *, parking: Parking, cleaned_data: dict, user=None
) -> ParkingVerification:
    verification = ParkingVerification.objects.create(
        parking=parking,
        user=user if getattr(user, "is_authenticated", False) else None,
        **cleaned_data,
    )
    aggregate = parking.verifications.aggregate(
        count=Count("id"),
        last_verified_at=Max("created_at"),
    )
    parking.verification_count = aggregate["count"] or 0
    parking.last_verified_at = aggregate["last_verified_at"]
    parking.save(
        update_fields=["verification_count", "last_verified_at", "updated_at"]
    )
    return verification
