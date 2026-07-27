from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import Parking


class MunicipalPilotTests(TestCase):
    def create_parking(self, **overrides):
        data = {
            "name": "Estacionamiento piloto",
            "location": "Centro de Temuco",
            "latitude": Decimal("-38.735900"),
            "longitude": Decimal("-72.590400"),
            "status": Parking.Status.VERIFIED,
            "moderation_status": Parking.ModerationStatus.APPROVED,
            "is_published": True,
            "verification_count": 4,
            "issue_report_count": 1,
            "has_step_free_route": True,
            "has_transfer_space": True,
        }
        data.update(overrides)
        return Parking.objects.create(**data)

    def setUp(self):
        self.staff = get_user_model().objects.create_user(
            username="municipal",
            password="safe-test-password",
            is_staff=True,
        )

    def test_public_municipal_page_uses_only_approved_catalogue(self):
        self.create_parking()
        self.create_parking(
            name="Oculto",
            is_published=False,
            moderation_status=Parking.ModerationStatus.PENDING,
        )

        response = self.client.get(reverse("municipalities"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Métricas públicas del piloto")
        self.assertEqual(response.context["metrics"]["published_count"], 1)
        self.assertEqual(response.context["metrics"]["positive_confirmations"], 4)

    def test_summary_api_does_not_expose_pending_records(self):
        self.create_parking()
        self.create_parking(
            moderation_status=Parking.ModerationStatus.REJECTED,
            is_published=False,
        )

        response = self.client.get(reverse("municipal_summary_api"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["metrics"]["published_count"], 1)
        self.assertEqual(response.json()["scope"], "catalogo_publico_aprobado")

    def test_dashboard_requires_staff_account(self):
        response = self.client.get(reverse("municipal_dashboard"))

        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response["Location"])

    def test_dashboard_filters_by_territorial_text(self):
        self.create_parking(name="Temuco centro", location="Municipalidad de Temuco")
        self.create_parking(name="Ñuñoa", location="Plaza Ñuñoa")
        self.client.force_login(self.staff)

        response = self.client.get(reverse("municipal_dashboard"), {"territory": "Temuco"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Temuco centro")
        self.assertNotContains(response, "Plaza Ñuñoa")
        self.assertEqual(response.context["metrics"]["published_count"], 1)

    def test_csv_export_is_utf8_and_staff_only(self):
        self.create_parking()
        self.client.force_login(self.staff)

        response = self.client.get(reverse("municipal_export_csv"), {"territory": "Temuco"})

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response["Content-Type"])
        self.assertIn("attachment", response["Content-Disposition"])
        content = response.content.decode("utf-8-sig")
        self.assertIn("Estacionamiento piloto", content)
        self.assertIn("Centro de Temuco", content)
