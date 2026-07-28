import json
from decimal import Decimal
from io import StringIO
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse

from .geocoding import find_nearby_published_parkings, geocode_chile_destination
from .models import Parking


@override_settings(
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "functional-search-tests",
        }
    },
    GEOCODING_URL="https://nominatim.example/search",
    GEOCODING_USER_AGENT="IncluMeTests/1.0 (+https://example.test)",
    GEOCODING_REFERER="https://example.test",
    GEOCODING_TIMEOUT_SECONDS=3,
    GEOCODING_CACHE_SECONDS=3600,
)
class FunctionalSearchTests(TestCase):
    def setUp(self):
        cache.clear()

    def create_parking(self, **overrides):
        data = {
            "name": "Estacionamiento piloto",
            "location": "Acceso norte",
            "latitude": Decimal("-38.735900"),
            "longitude": Decimal("-72.590400"),
            "status": Parking.Status.PENDING,
            "moderation_status": Parking.ModerationStatus.APPROVED,
            "is_published": True,
            "has_step_free_route": True,
            "has_transfer_space": True,
        }
        data.update(overrides)
        return Parking.objects.create(**data)

    def test_destination_page_is_useful_without_javascript(self):
        response = self.client.get(reverse("parking"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Encuentra una opción cerca de tu destino")
        self.assertContains(response, "Buscar destino")
        self.assertContains(response, "sin crear una cuenta")

    @patch("inclume_app.geocoding.urlopen")
    def test_explicit_geocoding_is_cached_and_chile_limited(self, mocked_urlopen):
        response = MagicMock()
        response.read.return_value = json.dumps(
            [
                {
                    "display_name": "Hospital Regional, Temuco, Chile",
                    "lat": "-38.7359",
                    "lon": "-72.5904",
                    "category": "amenity",
                    "type": "hospital",
                }
            ]
        ).encode("utf-8")
        mocked_urlopen.return_value.__enter__.return_value = response

        first = geocode_chile_destination("Hospital Regional Temuco")
        second = geocode_chile_destination("Hospital Regional Temuco")

        self.assertEqual(first, second)
        self.assertEqual(len(first), 1)
        self.assertEqual(first[0]["latitude"], -38.7359)
        mocked_urlopen.assert_called_once()
        request = mocked_urlopen.call_args.args[0]
        self.assertIn("countrycodes=cl", request.full_url)
        self.assertIn("bounded=1", request.full_url)
        self.assertEqual(request.get_header("User-agent"), "IncluMeTests/1.0 (+https://example.test)")

    def test_nearby_lookup_returns_only_approved_public_records_in_distance_order(self):
        closest = self.create_parking(name="Más cercano")
        farther = self.create_parking(
            name="Más lejano",
            latitude=Decimal("-38.742000"),
            longitude=Decimal("-72.590400"),
        )
        self.create_parking(
            name="Oculto",
            latitude=Decimal("-38.736000"),
            is_published=False,
            moderation_status=Parking.ModerationStatus.PENDING,
        )
        self.create_parking(
            name="No aprobado",
            latitude=Decimal("-38.736100"),
            moderation_status=Parking.ModerationStatus.REJECTED,
        )

        results = find_nearby_published_parkings(
            latitude=-38.7359,
            longitude=-72.5904,
            radius_km=2,
        )

        self.assertEqual([item["id"] for item in results], [closest.pk, farther.pk])
        self.assertLessEqual(results[0]["distance_m"], results[1]["distance_m"])
        self.assertIn("waze.com", results[0]["waze_url"])
        self.assertIn("google.com/maps", results[0]["google_maps_url"])

    def test_selected_destination_renders_real_nearby_results(self):
        parking = self.create_parking()

        response = self.client.get(
            reverse("parking"),
            {
                "latitude": "-38.7359",
                "longitude": "-72.5904",
                "label": "Hospital Regional de Temuco",
                "radius": "2",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Hospital Regional de Temuco")
        self.assertContains(response, parking.name)
        self.assertContains(response, "Abrir Waze")

    def test_nearby_api_rejects_coordinates_outside_chile(self):
        response = self.client.get(
            reverse("nearby_parkings_api"),
            {"latitude": "40.7128", "longitude": "-74.0060", "radius": "2"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["ok"])

    @patch.dict(
        "os.environ",
        {
            "INCLUME_ADMIN_USERNAME": "inclume-admin",
            "INCLUME_ADMIN_EMAIL": "admin@example.test",
            "INCLUME_ADMIN_PASSWORD": "a-strong-test-password-2026",
        },
        clear=False,
    )
    def test_bootstrap_admin_is_idempotent(self):
        output = StringIO()
        call_command("bootstrap_admin", require=True, stdout=output)
        call_command("bootstrap_admin", require=True, stdout=output)

        user = get_user_model().objects.get(username="inclume-admin")
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.check_password("a-strong-test-password-2026"))
        self.assertEqual(get_user_model().objects.filter(username="inclume-admin").count(), 1)
