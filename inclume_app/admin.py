from django.contrib import admin

from .models import (
    DiscriminationReport,
    EducationalResource,
    Parking,
    ParkingVerification,
)


@admin.register(Parking)
class ParkingAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "location",
        "place_type",
        "status",
        "verification_count",
        "last_verified_at",
    )
    list_filter = (
        "status",
        "place_type",
        "has_official_signage",
        "has_transfer_space",
        "has_curb_ramp",
        "has_step_free_route",
    )
    search_fields = ("name", "location", "accessibility_info")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (
            "Ubicación",
            {
                "fields": (
                    "name",
                    "location",
                    ("latitude", "longitude"),
                    "place_type",
                )
            },
        ),
        (
            "Accesibilidad",
            {
                "fields": (
                    "accessibility_info",
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
                    "status",
                    "verification_count",
                    "last_verified_at",
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
        "user",
        "created_at",
    )
    list_filter = ("is_available", "accessibility_confirmed", "created_at")
    search_fields = ("parking__name", "parking__location", "comment")
    readonly_fields = ("created_at",)


admin.site.register(EducationalResource)
admin.site.register(DiscriminationReport)
