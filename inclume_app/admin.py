from django.contrib import admin, messages

from .moderation import apply_moderation_action
from .models import (
    DiscriminationReport,
    EducationalResource,
    Parking,
    ParkingModerationEvent,
    ParkingVerification,
)


@admin.action(description="Aprobar y publicar con trazabilidad")
def approve_parkings(modeladmin, request, queryset):
    processed = 0
    for parking in queryset:
        apply_moderation_action(
            parking=parking,
            action=ParkingModerationEvent.Action.APPROVED,
            actor=request.user,
            note="Aprobación masiva desde Django Admin.",
        )
        processed += 1
    modeladmin.message_user(
        request,
        f"Se aprobaron {processed} registros.",
        level=messages.SUCCESS,
    )


@admin.action(description="Reabrir y ocultar para una nueva revisión")
def reopen_parkings(modeladmin, request, queryset):
    processed = 0
    for parking in queryset:
        apply_moderation_action(
            parking=parking,
            action=ParkingModerationEvent.Action.REOPENED,
            actor=request.user,
            note="Reapertura masiva desde Django Admin.",
        )
        processed += 1
    modeladmin.message_user(
        request,
        f"Se reabrieron {processed} registros.",
        level=messages.SUCCESS,
    )


class ParkingModerationEventInline(admin.TabularInline):
    model = ParkingModerationEvent
    fk_name = "parking"
    extra = 0
    can_delete = False
    fields = ("created_at", "action", "actor", "note", "target_parking")
    readonly_fields = fields
    ordering = ("-created_at",)
    verbose_name_plural = "Historial editorial"

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Parking)
class ParkingAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "location",
        "moderation_status",
        "status",
        "is_published",
        "verification_count",
        "issue_report_count",
        "reviewed_by",
        "reviewed_at",
    )
    list_filter = (
        "moderation_status",
        "is_published",
        "status",
        "place_type",
        "transfer_side",
        "surface_type",
        "last_issue_type",
        "has_official_signage",
        "has_transfer_space",
        "has_curb_ramp",
        "has_step_free_route",
    )
    search_fields = (
        "name",
        "location",
        "accessibility_info",
        "vehicle_access_notes",
        "accessible_entrance_notes",
        "moderation_notes",
    )
    readonly_fields = (
        "verification_count",
        "issue_report_count",
        "last_verified_at",
        "last_reported_at",
        "last_issue_type",
        "reviewed_by",
        "reviewed_at",
        "merged_into",
        "created_at",
        "updated_at",
    )
    actions = (approve_parkings, reopen_parkings)
    inlines = (ParkingModerationEventInline,)
    fieldsets = (
        (
            "Moderación y publicación",
            {
                "fields": (
                    "moderation_status",
                    "moderation_notes",
                    "is_published",
                    "status",
                    "reviewed_by",
                    "reviewed_at",
                    "merged_into",
                )
            },
        ),
        (
            "Ubicación",
            {
                "fields": (
                    "name",
                    "location",
                    ("latitude", "longitude"),
                    ("entrance_latitude", "entrance_longitude"),
                    "place_type",
                    "photo_url",
                )
            },
        ),
        (
            "Decisión de accesibilidad",
            {
                "fields": (
                    "distance_to_entrance_m",
                    "transfer_side",
                    "surface_type",
                    "accessibility_info",
                    "vehicle_access_notes",
                    "accessible_entrance_notes",
                    "has_official_signage",
                    "has_transfer_space",
                    "has_level_surface",
                    "has_curb_ramp",
                    "has_step_free_route",
                    "is_well_lit",
                    "is_covered",
                )
            },
        ),
        (
            "Operación y confianza",
            {
                "fields": (
                    "schedule_info",
                    "cost_info",
                    "verification_count",
                    "issue_report_count",
                    "last_verified_at",
                    "last_reported_at",
                    "last_issue_type",
                    "created_by",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )


@admin.register(ParkingVerification)
class ParkingVerificationAdmin(admin.ModelAdmin):
    list_display = (
        "parking",
        "is_available",
        "accessibility_confirmed",
        "issue_type",
        "user",
        "created_at",
    )
    list_filter = (
        "is_available",
        "accessibility_confirmed",
        "issue_type",
        "transfer_space_clear",
        "step_free_route_clear",
        "official_signage_visible",
        "created_at",
    )
    search_fields = ("parking__name", "parking__location", "comment")
    readonly_fields = ("submission_fingerprint", "created_at")
    date_hierarchy = "created_at"


@admin.register(ParkingModerationEvent)
class ParkingModerationEventAdmin(admin.ModelAdmin):
    list_display = ("parking", "action", "actor", "target_parking", "created_at")
    list_filter = ("action", "created_at")
    search_fields = ("parking__name", "parking__location", "note")
    readonly_fields = (
        "parking",
        "actor",
        "action",
        "note",
        "target_parking",
        "snapshot",
        "created_at",
    )
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


admin.site.register(EducationalResource)
admin.site.register(DiscriminationReport)
