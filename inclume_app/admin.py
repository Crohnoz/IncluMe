from django.contrib import admin

from .models import (
    DiscriminationReport,
    EducationalResource,
    Parking,
    ParkingVerification,
)


@admin.action(description="Publicar estacionamientos seleccionados")
def publish_parkings(modeladmin, request, queryset):
    queryset.update(is_published=True)


@admin.action(description="Ocultar estacionamientos seleccionados")
def unpublish_parkings(modeladmin, request, queryset):
    queryset.update(is_published=False)


@admin.register(Parking)
class ParkingAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "location",
        "place_type",
        "status",
        "is_published",
        "verification_count",
        "issue_report_count",
        "last_verified_at",
        "last_reported_at",
    )
    list_filter = (
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
    )
    readonly_fields = (
        "verification_count",
        "issue_report_count",
        "last_verified_at",
        "last_reported_at",
        "last_issue_type",
        "created_at",
        "updated_at",
    )
    actions = (publish_parkings, unpublish_parkings)
    fieldsets = (
        (
            "Publicación",
            {"fields": ("is_published", "status")},
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


admin.site.register(EducationalResource)
admin.site.register(DiscriminationReport)
