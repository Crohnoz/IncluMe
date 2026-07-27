import json
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse

from .models import Parking, ParkingVerification


class ParkingApiTests(TestCase):
    def create_parking(self, **overrides):
        data = {
            "name": "Clínica Nueva Providencia",
            "location": "Estacionamiento 02, costado norte",
            "latitude": Decimal("-33.448900"),
            "longitude": Decimal("-70.669300"),
            "entrance_latitude": Decimal("-33.448700"),
            "entrance_longitude": Decimal("-70.669100"),
            "status": Parking.Status.VERIFIED,
            "is_published": True,
            "has_transfer_space": True,
            "has_step_free_route": True,
            "transfer_side": Parking.TransferSide.RIGHT,
            "surface_type": Parking.SurfaceType.LEVEL,
            "distance_to_entrance_m": 18,
            "verification_count": 3,
        }
        data.update(overrides)
        return Parking.objects.create(**data)

    def test_returns_extended_published_parking_data(self):
        parking = self.create_parking()

        response = self.client.get(reverse("parking_data"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 1)
        item = payload["parkings"][0]
        self.assertEqual(item["id"], parking.pk)
        self.assertEqual(item["status"], "verified")
        self.assertEqual(item["transfer_side"], "right")
        self.assertEqual(item["distance_to_entrance_m"], 18)
        self.assertEqual(item["trust_level"], "community")
        self.assertIn("Espacio de transferencia", item["features"])

    def test_excludes_unpublished_parking(self):
        self.create_parking(is_published=False)

        response = self.client.get(reverse("parking_data"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 0)

    def test_excludes_parking_without_coordinates(self):
        self.create_parking(latitude=None, longitude=None)

        response = self.client.get(reverse("parking_data"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 0)

    def test_excludes_removed_parking(self):
        self.create_parking(status=Parking.Status.REMOVED)

        response = self.client.get(reverse("parking_data"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 0)

    def test_anonymous_submission_is_held_for_moderation(self):
        response = self.client.post(
            reverse("submit_parking"),
            data=json.dumps(
                {
                    "name": "Nuevo estacionamiento comunitario",
                    "location": "Acceso norte",
                    "latitude": -33.44,
                    "longitude": -70.66,
                    "place_type": "healthcare",
                    "transfer_side": "right",
                    "surface_type": "level",
                    "has_transfer_space": True,
                    "has_step_free_route": True,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        parking = Parking.objects.get(pk=response.json()["id"])
        self.assertFalse(parking.is_published)
        self.assertEqual(parking.status, Parking.Status.PENDING)
        self.assertTrue(parking.has_transfer_space)

    def test_submission_requires_coordinates(self):
        response = self.client.post(
            reverse("submit_parking"),
            data=json.dumps(
                {
                    "name": "Registro incompleto",
                    "location": "Sin coordenadas",
                    "place_type": "other",
                    "transfer_side": "unknown",
                    "surface_type": "unknown",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["ok"])

    def test_verification_updates_community_trust_fields(self):
        parking = self.create_parking(verification_count=0, last_verified_at=None)

        response = self.client.post(
            reverse("verify_parking", args=[parking.pk]),
            data=json.dumps(
                {
                    "is_available": True,
                    "accessibility_confirmed": True,
                    "transfer_space_clear": True,
                    "step_free_route_clear": True,
                    "official_signage_visible": None,
                    "issue_type": "none",
                    "comment": "La ruta estaba despejada.",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        parking.refresh_from_db()
        self.assertEqual(parking.verification_count, 1)
        self.assertIsNotNone(parking.last_verified_at)
        verification = ParkingVerification.objects.get(parking=parking)
        self.assertTrue(verification.transfer_space_clear)
        self.assertEqual(response.json()["parking"]["verification_count"], 1)
