from __future__ import annotations

from decimal import Decimal

from django import forms
from django.db import transaction
from django.db.models import Count, Max
from django.utils import timezone

from .models import Parking, ParkingIssueType, ParkingModerationEvent
from .services import (
    ISSUE_VERIFICATION_FILTER,
    POSITIVE_VERIFICATION_FILTER,
    create_parking_submission,
)


EDITABLE_FIELDS = (
    "name",
    "location",
    "latitude",
    "longitude",
    "entrance_latitude",
    "entrance_longitude",
    "place_type",
    "accessibility_info",
    "vehicle_access_notes",
    "accessible_entrance_notes",
    "photo_url",
    "has_official_signage",
    "has_transfer_space",
    "has_level_surface",
    "has_curb_ramp",
    "has_step_free_route",
    "is_well_lit",
    "is_covered",
    "transfer_side",
    "surface_type",
    "distance_to_entrance_m",
    "schedule_info",
    "cost_info",
    "status",
)

SNAPSHOT_FIELDS = EDITABLE_FIELDS + (
    "is_published",
    "moderation_status",
    "moderation_notes",
    "merged_into_id",
    "verification_count",
    "issue_report_count",
    "last_verified_at",
    "last_reported_at",
    "last_issue_type",
)

MERGEABLE_FIELDS = (
    "entrance_latitude",
    "entrance_longitude",
    "accessibility_info",
    "vehicle_access_notes",
    "accessible_entrance_notes",
    "photo_url",
    "has_official_signage",
    "has_transfer_space",
    "has_level_surface",
    "has_curb_ramp",
    "has_step_free_route",
    "is_well_lit",
    "is_covered",
    "transfer_side",
    "surface_type",
    "distance_to_entrance_m",
    "schedule_info",
    "cost_info",
)

MODERATION_ACTIONS = (
    (ParkingModerationEvent.Action.APPROVED, "Aprobar y publicar"),
    (
        ParkingModerationEvent.Action.CHANGES_REQUESTED,
        "Solicitar correcciones y mantener oculto",
    ),
    (ParkingModerationEvent.Action.REJECTED, "Rechazar aporte"),
    (ParkingModerationEvent.Action.MERGED, "Fusionar con registro existente"),
    (ParkingModerationEvent.Action.REOPENED, "Reabrir para revisión"),
)


class ModerationWorkflowError(ValueError):
    pass


class ParkingModerationEditForm(forms.ModelForm):
    class Meta:
        model = Parking
        fields = EDITABLE_FIELDS
        widgets = {
            "accessibility_info": forms.Textarea(attrs={"rows": 4}),
            "vehicle_access_notes": forms.Textarea(attrs={"rows": 3}),
            "accessible_entrance_notes": forms.Textarea(attrs={"rows": 3}),
        }


class ParkingModerationActionForm(forms.Form):
    action = forms.ChoiceField(label="Decisión", choices=MODERATION_ACTIONS)
    note = forms.CharField(
        label="Motivo o nota interna",
        required=False,
        max_length=2000,
        widget=forms.Textarea(
            attrs={
                "rows": 4,
                "placeholder": "Explica la decisión, las correcciones necesarias o el motivo de la fusión.",
            }
        ),
    )
    target_parking = forms.ModelChoiceField(
        label="Registro canónico para fusionar",
        required=False,
        queryset=Parking.objects.none(),
        help_text="Solo se muestran registros aprobados que pueden actuar como destino canónico.",
    )

    def __init__(self, *args, parking: Parking, **kwargs):
        super().__init__(*args, **kwargs)
        self.parking = parking
        self.fields["target_parking"].queryset = (
            Parking.objects.filter(
                moderation_status=Parking.ModerationStatus.APPROVED,
                is_published=True,
            )
            .exclude(pk=parking.pk)
            .exclude(status=Parking.Status.REMOVED)
            .order_by("name", "location")
        )

    def clean(self):
        cleaned_data = super().clean()
        action = cleaned_data.get("action")
        note = (cleaned_data.get("note") or "").strip()
        target = cleaned_data.get("target_parking")

        if action in {
            ParkingModerationEvent.Action.CHANGES_REQUESTED,
            ParkingModerationEvent.Action.REJECTED,
            ParkingModerationEvent.Action.MERGED,
        } and not note:
            self.add_error("note", "Explica el motivo para mantener una trazabilidad útil.")

        if action == ParkingModerationEvent.Action.MERGED and target is None:
            self.add_error("target_parking", "Selecciona el registro que conservará la información.")
        elif action != ParkingModerationEvent.Action.MERGED and target is not None:
            cleaned_data["target_parking"] = None

        return cleaned_data


def _json_value(value):
    if isinstance(value, Decimal):
        return str(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def parking_snapshot(parking: Parking) -> dict:
    return {
        field: _json_value(getattr(parking, field))
        for field in SNAPSHOT_FIELDS
    }


def _require_staff(actor) -> None:
    if not getattr(actor, "is_authenticated", False) or not getattr(actor, "is_staff", False):
        raise PermissionError("La moderación requiere una cuenta de equipo autorizada.")


def _is_blank_target_value(field_name: str, value) -> bool:
    if value is None or value == "":
        return True
    if field_name == "transfer_side" and value == Parking.TransferSide.UNKNOWN:
        return True
    if field_name == "surface_type" and value == Parking.SurfaceType.UNKNOWN:
        return True
    return False


def _has_meaningful_source_value(field_name: str, value) -> bool:
    if value is None or value == "":
        return False
    if field_name == "transfer_side" and value == Parking.TransferSide.UNKNOWN:
        return False
    if field_name == "surface_type" and value == Parking.SurfaceType.UNKNOWN:
        return False
    return True


def recalculate_parking_trust(parking: Parking) -> Parking:
    aggregate = parking.verifications.aggregate(
        positive_count=Count("id", filter=POSITIVE_VERIFICATION_FILTER),
        issue_count=Count("id", filter=ISSUE_VERIFICATION_FILTER),
        last_verified_at=Max("created_at", filter=POSITIVE_VERIFICATION_FILTER),
        last_reported_at=Max("created_at", filter=ISSUE_VERIFICATION_FILTER),
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
    return parking


@transaction.atomic
def create_moderated_parking_submission(*, cleaned_data: dict, user=None) -> Parking:
    parking = create_parking_submission(cleaned_data=cleaned_data, user=user)
    parking.moderation_status = Parking.ModerationStatus.PENDING
    parking.moderation_notes = ""
    parking.save(update_fields=["moderation_status", "moderation_notes", "updated_at"])
    ParkingModerationEvent.objects.create(
        parking=parking,
        actor=user if getattr(user, "is_authenticated", False) else None,
        action=ParkingModerationEvent.Action.SUBMITTED,
        snapshot=parking_snapshot(parking),
    )
    return parking


@transaction.atomic
def update_parking_details(*, parking: Parking, form: ParkingModerationEditForm, actor) -> Parking:
    _require_staff(actor)
    locked = Parking.objects.select_for_update().get(pk=parking.pk)
    before = parking_snapshot(locked)

    for field_name in EDITABLE_FIELDS:
        setattr(locked, field_name, form.cleaned_data[field_name])
    locked.reviewed_by = actor
    locked.reviewed_at = timezone.now()
    locked.save()

    ParkingModerationEvent.objects.create(
        parking=locked,
        actor=actor,
        action=ParkingModerationEvent.Action.EDITED,
        note="Datos observables actualizados durante la revisión.",
        snapshot={"before": before, "after": parking_snapshot(locked)},
    )
    return locked


def _move_verifications(source: Parking, target: Parking) -> dict:
    moved = 0
    discarded_duplicates = 0
    for verification in source.verifications.select_for_update().order_by("created_at"):
        fingerprint = verification.submission_fingerprint
        if fingerprint and target.verifications.filter(
            submission_fingerprint=fingerprint
        ).exists():
            verification.delete()
            discarded_duplicates += 1
            continue
        verification.parking = target
        verification.save(update_fields=["parking"])
        moved += 1
    return {"moved": moved, "discarded_duplicates": discarded_duplicates}


def _copy_missing_fields(source: Parking, target: Parking) -> list[str]:
    copied = []
    for field_name in MERGEABLE_FIELDS:
        source_value = getattr(source, field_name)
        target_value = getattr(target, field_name)
        if _is_blank_target_value(field_name, target_value) and _has_meaningful_source_value(
            field_name, source_value
        ):
            setattr(target, field_name, source_value)
            copied.append(field_name)
    if copied:
        target.save(update_fields=[*copied, "updated_at"])
    return copied


@transaction.atomic
def apply_moderation_action(
    *,
    parking: Parking,
    action: str,
    actor,
    note: str = "",
    target_parking: Parking | None = None,
) -> Parking:
    _require_staff(actor)
    note = note.strip()
    locked = Parking.objects.select_for_update().get(pk=parking.pk)
    before = parking_snapshot(locked)
    reviewed_at = timezone.now()

    valid_actions = {value for value, _label in MODERATION_ACTIONS}
    if action not in valid_actions:
        raise ModerationWorkflowError("La acción de moderación no es válida.")

    if action in {
        ParkingModerationEvent.Action.CHANGES_REQUESTED,
        ParkingModerationEvent.Action.REJECTED,
        ParkingModerationEvent.Action.MERGED,
    } and not note:
        raise ModerationWorkflowError("Esta decisión requiere una explicación.")

    if action == ParkingModerationEvent.Action.MERGED:
        if target_parking is None or target_parking.pk == locked.pk:
            raise ModerationWorkflowError("Selecciona un registro canónico diferente.")
        target = Parking.objects.select_for_update().get(pk=target_parking.pk)
        if (
            target.moderation_status != Parking.ModerationStatus.APPROVED
            or not target.is_published
            or target.status == Parking.Status.REMOVED
        ):
            raise ModerationWorkflowError("El destino de la fusión debe estar aprobado y publicado.")

        transfer_summary = _move_verifications(locked, target)
        copied_fields = _copy_missing_fields(locked, target)
        recalculate_parking_trust(target)

        locked.moderation_status = Parking.ModerationStatus.MERGED
        locked.moderation_notes = note
        locked.reviewed_by = actor
        locked.reviewed_at = reviewed_at
        locked.merged_into = target
        locked.is_published = False
        locked.status = Parking.Status.REMOVED
        locked.save()

        snapshot = {
            "before": before,
            "after": parking_snapshot(locked),
            "merge": {
                "target_id": target.pk,
                "copied_fields": copied_fields,
                **transfer_summary,
            },
        }
        ParkingModerationEvent.objects.create(
            parking=locked,
            actor=actor,
            action=ParkingModerationEvent.Action.MERGED,
            note=note,
            target_parking=target,
            snapshot=snapshot,
        )
        ParkingModerationEvent.objects.create(
            parking=target,
            actor=actor,
            action=ParkingModerationEvent.Action.MERGED,
            note=f"Este registro absorbió el aporte #{locked.pk}. {note}",
            target_parking=locked,
            snapshot={"absorbed_parking_id": locked.pk, **transfer_summary},
        )
        return locked

    locked.reviewed_by = actor
    locked.reviewed_at = reviewed_at
    locked.moderation_notes = note
    locked.merged_into = None

    if action == ParkingModerationEvent.Action.APPROVED:
        locked.moderation_status = Parking.ModerationStatus.APPROVED
        locked.is_published = True
        if locked.status == Parking.Status.REMOVED:
            locked.status = Parking.Status.PENDING
    elif action == ParkingModerationEvent.Action.CHANGES_REQUESTED:
        locked.moderation_status = Parking.ModerationStatus.CHANGES_REQUESTED
        locked.is_published = False
    elif action == ParkingModerationEvent.Action.REJECTED:
        locked.moderation_status = Parking.ModerationStatus.REJECTED
        locked.is_published = False
    elif action == ParkingModerationEvent.Action.REOPENED:
        locked.moderation_status = Parking.ModerationStatus.PENDING
        locked.is_published = False
        if locked.status == Parking.Status.REMOVED:
            locked.status = Parking.Status.PENDING

    locked.save()
    ParkingModerationEvent.objects.create(
        parking=locked,
        actor=actor,
        action=action,
        note=note,
        snapshot={"before": before, "after": parking_snapshot(locked)},
    )
    return locked
