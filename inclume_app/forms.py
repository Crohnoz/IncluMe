from decimal import Decimal

from django import forms

from .models import Parking, ParkingVerification


BOOLEAN_CHOICES = (
    ("", "No sé"),
    ("true", "Sí"),
    ("false", "No"),
)

# Broad bounds include continental Chile and western Chilean territory used by the product map.
CHILE_LATITUDE_MIN = Decimal("-58")
CHILE_LATITUDE_MAX = Decimal("-15")
CHILE_LONGITUDE_MIN = Decimal("-112")
CHILE_LONGITUDE_MAX = Decimal("-64")


def nullable_boolean_field(*, label: str = "") -> forms.TypedChoiceField:
    return forms.TypedChoiceField(
        label=label,
        choices=BOOLEAN_CHOICES,
        required=False,
        coerce=lambda value: None if value == "" else value == "true",
        empty_value=None,
    )


def required_boolean_field(*, label: str = "") -> forms.TypedChoiceField:
    return forms.TypedChoiceField(
        label=label,
        choices=(("true", "Sí"), ("false", "No")),
        required=True,
        coerce=lambda value: value == "true",
    )


def coordinates_are_in_chile(latitude, longitude) -> bool:
    if latitude is None or longitude is None:
        return False
    return (
        CHILE_LATITUDE_MIN <= latitude <= CHILE_LATITUDE_MAX
        and CHILE_LONGITUDE_MIN <= longitude <= CHILE_LONGITUDE_MAX
    )


class ParkingSubmissionForm(forms.ModelForm):
    has_official_signage = nullable_boolean_field(label="Señalización oficial")
    has_transfer_space = nullable_boolean_field(label="Espacio de transferencia")
    has_level_surface = nullable_boolean_field(label="Superficie nivelada")
    has_curb_ramp = nullable_boolean_field(label="Rebaje de solera o rampa")
    has_step_free_route = nullable_boolean_field(label="Ruta sin escalones")
    is_well_lit = nullable_boolean_field(label="Buena iluminación")
    is_covered = nullable_boolean_field(label="Protección climática")

    class Meta:
        model = Parking
        fields = (
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
        )

    def clean_name(self) -> str:
        return self.cleaned_data["name"].strip()

    def clean_location(self) -> str:
        return self.cleaned_data["location"].strip()

    def clean(self):
        cleaned_data = super().clean()
        latitude = cleaned_data.get("latitude")
        longitude = cleaned_data.get("longitude")
        entrance_latitude = cleaned_data.get("entrance_latitude")
        entrance_longitude = cleaned_data.get("entrance_longitude")

        if (latitude is None) != (longitude is None):
            raise forms.ValidationError(
                "La latitud y longitud del estacionamiento deben enviarse juntas."
            )
        if latitude is None:
            raise forms.ValidationError(
                "Necesitamos la ubicación del estacionamiento para revisar el aporte."
            )
        if latitude is not None and longitude is not None and not coordinates_are_in_chile(latitude, longitude):
            self.add_error(
                "latitude",
                "IncluMe está enfocado en Chile. Marca un punto dentro del territorio chileno.",
            )
            self.add_error(
                "longitude",
                "IncluMe está enfocado en Chile. Marca un punto dentro del territorio chileno.",
            )
        if (entrance_latitude is None) != (entrance_longitude is None):
            raise forms.ValidationError(
                "Las coordenadas de la entrada accesible deben enviarse juntas."
            )
        if (
            entrance_latitude is not None
            and entrance_longitude is not None
            and not coordinates_are_in_chile(entrance_latitude, entrance_longitude)
        ):
            self.add_error(
                "entrance_latitude",
                "La entrada accesible debe ubicarse dentro de Chile.",
            )
            self.add_error(
                "entrance_longitude",
                "La entrada accesible debe ubicarse dentro de Chile.",
            )
        return cleaned_data


class ParkingVerificationForm(forms.ModelForm):
    is_available = required_boolean_field(label="¿Continúa disponible?")
    accessibility_confirmed = required_boolean_field(
        label="¿Pudiste utilizarlo según la información publicada?"
    )
    transfer_space_clear = nullable_boolean_field(
        label="¿El espacio lateral estaba libre?"
    )
    step_free_route_clear = nullable_boolean_field(
        label="¿La ruta seguía sin escalones?"
    )
    official_signage_visible = nullable_boolean_field(
        label="¿La señalización estaba visible?"
    )

    class Meta:
        model = ParkingVerification
        fields = (
            "is_available",
            "accessibility_confirmed",
            "transfer_space_clear",
            "step_free_route_clear",
            "official_signage_visible",
            "issue_type",
            "comment",
            "evidence_url",
        )

    def clean_comment(self) -> str:
        comment = self.cleaned_data.get("comment", "").strip()
        if len(comment) > 800:
            raise forms.ValidationError("El comentario no puede superar 800 caracteres.")
        return comment
