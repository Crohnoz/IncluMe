from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Parking(models.Model):
    class PlaceType(models.TextChoices):
        STREET = "street", "Vía pública"
        MUNICIPAL = "municipal", "Municipal"
        BUSINESS = "business", "Comercio"
        HEALTHCARE = "healthcare", "Clínica u hospital"
        BUILDING = "building", "Edificio"
        PRIVATE = "private", "Privado"
        OTHER = "other", "Otro"

    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente de verificación"
        VERIFIED = "verified", "Verificado"
        UNAVAILABLE = "unavailable", "Temporalmente no disponible"
        REMOVED = "removed", "Retirado"

    name = models.CharField(max_length=160, default="Estacionamiento accesible")
    location = models.CharField("dirección o referencia", max_length=255)
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    place_type = models.CharField(
        max_length=20,
        choices=PlaceType.choices,
        default=PlaceType.OTHER,
    )
    accessibility_info = models.TextField(blank=True)

    has_official_signage = models.BooleanField(null=True, blank=True)
    has_transfer_space = models.BooleanField(null=True, blank=True)
    has_level_surface = models.BooleanField(null=True, blank=True)
    has_curb_ramp = models.BooleanField(null=True, blank=True)
    has_step_free_route = models.BooleanField(null=True, blank=True)
    is_well_lit = models.BooleanField(null=True, blank=True)
    is_covered = models.BooleanField(null=True, blank=True)

    schedule_info = models.CharField(max_length=255, blank=True)
    cost_info = models.CharField(max_length=255, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    verification_count = models.PositiveIntegerField(default=0)
    last_verified_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="parking_spots_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_verified_at", "name"]
        indexes = [
            models.Index(fields=["latitude", "longitude"]),
            models.Index(fields=["status", "last_verified_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} — {self.location}"

    @property
    def has_coordinates(self) -> bool:
        return self.latitude is not None and self.longitude is not None


class ParkingVerification(models.Model):
    parking = models.ForeignKey(
        Parking,
        on_delete=models.CASCADE,
        related_name="verifications",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="parking_verifications",
    )
    is_available = models.BooleanField(default=True)
    accessibility_confirmed = models.BooleanField(default=True)
    comment = models.TextField(blank=True)
    evidence_url = models.URLField(
        blank=True,
        help_text="URL de una fotografía o evidencia almacenada externamente.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Verificación de {self.parking} ({self.created_at:%Y-%m-%d})"


class EducationalResource(models.Model):
    title = models.CharField(max_length=255)
    content = models.TextField()

    def __str__(self) -> str:
        return self.title


class DiscriminationReport(models.Model):
    report_date = models.DateTimeField(auto_now_add=True)
    details = models.TextField()

    def __str__(self) -> str:
        return f"Reporte #{self.pk} — {self.report_date:%Y-%m-%d}"
