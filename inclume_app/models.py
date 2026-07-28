from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q


class ParkingIssueType(models.TextChoices):
    NONE = "none", "Sin problema"
    OCCUPIED = "occupied", "Espacio ocupado"
    BLOCKED = "blocked", "Acceso bloqueado"
    SIGNAGE = "signage", "Señalización ausente o dañada"
    ROUTE = "route", "Ruta accesible interrumpida"
    REMOVED = "removed", "El estacionamiento ya no existe"
    OTHER = "other", "Otro"


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

    class ModerationStatus(models.TextChoices):
        PENDING = "pending", "Pendiente de revisión"
        APPROVED = "approved", "Aprobado"
        CHANGES_REQUESTED = "changes_requested", "Requiere correcciones"
        REJECTED = "rejected", "Rechazado"
        MERGED = "merged", "Fusionado"

    class TransferSide(models.TextChoices):
        UNKNOWN = "unknown", "No informado"
        LEFT = "left", "Lado izquierdo"
        RIGHT = "right", "Lado derecho"
        BOTH = "both", "Ambos lados"

    class SurfaceType(models.TextChoices):
        UNKNOWN = "unknown", "No informada"
        LEVEL = "level", "Nivelada"
        SLIGHT_SLOPE = "slight_slope", "Pendiente leve"
        STEEP_SLOPE = "steep_slope", "Pendiente pronunciada"
        IRREGULAR = "irregular", "Irregular"

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
    entrance_latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
        help_text="Coordenada de la entrada accesible del destino, si se conoce.",
    )
    entrance_longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
        help_text="Coordenada de la entrada accesible del destino, si se conoce.",
    )
    place_type = models.CharField(
        max_length=20,
        choices=PlaceType.choices,
        default=PlaceType.OTHER,
    )
    accessibility_info = models.TextField(blank=True)
    vehicle_access_notes = models.TextField(
        blank=True,
        help_text="Cómo ingresar en vehículo: portón, costado, sentido de la calle u otra referencia.",
    )
    accessible_entrance_notes = models.TextField(
        blank=True,
        help_text="Indicaciones desde el estacionamiento hasta la entrada accesible.",
    )
    photo_url = models.URLField(
        blank=True,
        help_text="Fotografía de referencia moderada y sin datos personales visibles.",
    )

    has_official_signage = models.BooleanField(null=True, blank=True)
    has_transfer_space = models.BooleanField(null=True, blank=True)
    has_level_surface = models.BooleanField(null=True, blank=True)
    has_curb_ramp = models.BooleanField(null=True, blank=True)
    has_step_free_route = models.BooleanField(null=True, blank=True)
    is_well_lit = models.BooleanField(null=True, blank=True)
    is_covered = models.BooleanField(null=True, blank=True)
    transfer_side = models.CharField(
        max_length=12,
        choices=TransferSide.choices,
        default=TransferSide.UNKNOWN,
    )
    surface_type = models.CharField(
        max_length=20,
        choices=SurfaceType.choices,
        default=SurfaceType.UNKNOWN,
    )
    distance_to_entrance_m = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MaxValueValidator(5000)],
        help_text="Distancia aproximada hasta la entrada accesible, en metros.",
    )

    schedule_info = models.CharField(max_length=255, blank=True)
    cost_info = models.CharField(max_length=255, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    is_published = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Solo los registros publicados aparecen en la aplicación pública.",
    )
    moderation_status = models.CharField(
        max_length=24,
        choices=ModerationStatus.choices,
        default=ModerationStatus.APPROVED,
        db_index=True,
        help_text="Estado editorial independiente de la verificación comunitaria del lugar.",
    )
    moderation_notes = models.TextField(
        blank=True,
        help_text="Motivo o instrucción de la decisión editorial más reciente.",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="parking_moderation_reviews",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    merged_into = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="merged_sources",
        help_text="Registro canónico que absorbió este aporte cuando fue fusionado.",
    )
    verification_count = models.PositiveIntegerField(
        default=0,
        help_text="Cantidad de confirmaciones positivas registradas.",
    )
    issue_report_count = models.PositiveIntegerField(
        default=0,
        help_text="Cantidad de verificaciones que informaron una incidencia.",
    )
    last_verified_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Fecha de la última confirmación positiva.",
    )
    last_reported_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Fecha de la última incidencia informada.",
    )
    last_issue_type = models.CharField(
        max_length=20,
        choices=ParkingIssueType.choices,
        default=ParkingIssueType.NONE,
        help_text="Tipo de la incidencia más reciente.",
    )
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
            models.Index(
                fields=["latitude", "longitude"],
                name="inclume_parking_coords_idx",
            ),
            models.Index(
                fields=["status", "last_verified_at"],
                name="inclume_parking_state_idx",
            ),
            models.Index(
                fields=["is_published", "status"],
                name="inclume_parking_public_idx",
            ),
            models.Index(
                fields=["last_reported_at", "last_issue_type"],
                name="inclume_parking_issue_idx",
            ),
            models.Index(
                fields=["moderation_status", "created_at"],
                name="inclume_parking_mod_queue_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} — {self.location}"

    @property
    def has_coordinates(self) -> bool:
        return self.latitude is not None and self.longitude is not None

    @property
    def has_entrance_coordinates(self) -> bool:
        return (
            self.entrance_latitude is not None
            and self.entrance_longitude is not None
        )

    @property
    def last_issue_label(self) -> str:
        return dict(ParkingIssueType.choices).get(
            self.last_issue_type,
            ParkingIssueType.OTHER.label,
        )

    @property
    def is_moderation_pending(self) -> bool:
        return self.moderation_status in {
            self.ModerationStatus.PENDING,
            self.ModerationStatus.CHANGES_REQUESTED,
        }


class ParkingVerification(models.Model):
    IssueType = ParkingIssueType

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
    transfer_space_clear = models.BooleanField(null=True, blank=True)
    step_free_route_clear = models.BooleanField(null=True, blank=True)
    official_signage_visible = models.BooleanField(null=True, blank=True)
    issue_type = models.CharField(
        max_length=20,
        choices=ParkingIssueType.choices,
        default=ParkingIssueType.NONE,
    )
    comment = models.TextField(blank=True)
    evidence_url = models.URLField(
        blank=True,
        help_text="URL de una fotografía o evidencia almacenada externamente.",
    )
    submission_fingerprint = models.CharField(
        max_length=64,
        blank=True,
        editable=False,
        help_text=(
            "Identificador irreversible y temporal utilizado para evitar envíos repetidos "
            "desde la misma sesión."
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["parking", "-created_at"],
                name="inclume_verify_recent_idx",
            )
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["parking", "submission_fingerprint"],
                condition=~Q(submission_fingerprint=""),
                name="inclume_unique_verify_fingerprint",
            )
        ]

    def __str__(self) -> str:
        return f"Verificación de {self.parking} ({self.created_at:%Y-%m-%d})"

    @property
    def is_positive_confirmation(self) -> bool:
        return (
            self.is_available
            and self.accessibility_confirmed
            and self.issue_type == ParkingIssueType.NONE
        )


class ParkingModerationEvent(models.Model):
    class Action(models.TextChoices):
        SUBMITTED = "submitted", "Aporte recibido"
        EDITED = "edited", "Datos editados"
        APPROVED = "approved", "Aprobado"
        CHANGES_REQUESTED = "changes_requested", "Correcciones solicitadas"
        REJECTED = "rejected", "Rechazado"
        MERGED = "merged", "Fusionado"
        REOPENED = "reopened", "Reabierto"

    parking = models.ForeignKey(
        Parking,
        on_delete=models.CASCADE,
        related_name="moderation_events",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="parking_moderation_events",
    )
    action = models.CharField(max_length=24, choices=Action.choices)
    note = models.TextField(blank=True)
    target_parking = models.ForeignKey(
        Parking,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moderation_target_events",
    )
    snapshot = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["parking", "-created_at"],
                name="inclume_mod_event_time_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.get_action_display()} — {self.parking}"


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
