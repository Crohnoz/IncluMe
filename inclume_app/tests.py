import json
from decimal import Decimal

from django.test import Client, TestCase
from django.urls import reverse

from .models import Parking, ParkingIssueType, ParkingVerification


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

    def verification_payload(self, **overrides):
        data = {
            "is_available": True,
            "accessibility_confirmed": True,
            "transfer_space_clear": True,
            "step_free_route_clear": True,
            "official_signage_visible": None,
            "issue_type": "none",
            "comment": "La ruta estaba despejada.",
        }
        data.update(overrides)
        return data

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
        self.assertEqual(item["availability_signal"], "unknown")
        self.assertIn("Espacio de transferencia", item["features"])
        self.assertIn("stale-while-revalidate", response["Cache-Control"])

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

    def test_possible_duplicate_requires_explicit_confirmation(self):
        self.create_parking()
        payload = {
            "name": "Otro nombre para el mismo lugar",
            "location": "Acceso norte",
            "latitude": -33.448900,
            "longitude": -70.669300,
            "place_type": "healthcare",
            "transfer_side": "unknown",
            "surface_type": "unknown",
        }

        response = self.client.post(
            reverse("submit_parking"),
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "possible_duplicate")
        self.assertEqual(len(response.json()["duplicates"]), 1)

        payload["confirm_duplicate"] = True
        confirmed_response = self.client.post(
            reverse("submit_parking"),
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(confirmed_response.status_code, 201)
        self.assertFalse(
            Parking.objects.get(pk=confirmed_response.json()["id"]).is_published
        )

    def test_positive_verification_updates_confirmation_fields(self):
        parking = self.create_parking(verification_count=0, last_verified_at=None)

        response = self.client.post(
            reverse("verify_parking", args=[parking.pk]),
            data=json.dumps(self.verification_payload()),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        parking.refresh_from_db()
        self.assertEqual(parking.verification_count, 1)
        self.assertEqual(parking.issue_report_count, 0)
        self.assertIsNotNone(parking.last_verified_at)
        self.assertIsNone(parking.last_reported_at)
        verification = ParkingVerification.objects.get(parking=parking)
        self.assertTrue(verification.transfer_space_clear)
        self.assertTrue(verification.submission_fingerprint)
        self.assertEqual(response.json()["parking"]["availability_signal"], "recently_confirmed")

    def test_negative_report_does_not_inflate_positive_trust(self):
        parking = self.create_parking(verification_count=0, last_verified_at=None)

        response = self.client.post(
            reverse("verify_parking", args=[parking.pk]),
            data=json.dumps(
                self.verification_payload(
                    is_available=False,
                    accessibility_confirmed=False,
                    issue_type="occupied",
                    comment="El espacio estaba ocupado.",
                )
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        parking.refresh_from_db()
        self.assertEqual(parking.verification_count, 0)
        self.assertEqual(parking.issue_report_count, 1)
        self.assertIsNone(parking.last_verified_at)
        self.assertIsNotNone(parking.last_reported_at)
        self.assertEqual(parking.last_issue_type, ParkingIssueType.OCCUPIED)
        serialized = response.json()["parking"]
        self.assertEqual(serialized["trust_level"], "warning")
        self.assertEqual(serialized["availability_signal"], "issue_reported")
        self.assertEqual(serialized["last_issue_type_label"], "Espacio ocupado")

    def test_same_session_cannot_repeat_verification_in_six_hour_window(self):
        parking = self.create_parking(verification_count=0, last_verified_at=None)
        url = reverse("verify_parking", args=[parking.pk])

        first = self.client.post(
            url,
            data=json.dumps(self.verification_payload()),
            content_type="application/json",
        )
        second = self.client.post(
            url,
            data=json.dumps(self.verification_payload()),
            content_type="application/json",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.json()["code"], "duplicate_verification")
        self.assertEqual(ParkingVerification.objects.filter(parking=parking).count(), 1)

    def test_different_sessions_can_verify_same_place(self):
        parking = self.create_parking(verification_count=0, last_verified_at=None)
        url = reverse("verify_parking", args=[parking.pk])

        first = self.client.post(
            url,
            data=json.dumps(self.verification_payload()),
            content_type="application/json",
        )
        second_client = Client()
        second = second_client.post(
            url,
            data=json.dumps(self.verification_payload()),
            content_type="application/json",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        parking.refresh_from_db()
        self.assertEqual(parking.verification_count, 2)

    def test_health_endpoint_checks_database(self):
        response = self.client.get(reverse("health"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(response.json()["database"], "ok")
        self.assertIn("no-store", response["Cache-Control"])

    def test_service_worker_is_served_from_root_scope(self):
        response = self.client.get(reverse("service_worker"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Service-Worker-Allowed"], "/")
        self.assertIn("javascript", response["Content-Type"])
