from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import Parking, ParkingModerationEvent, ParkingVerification


class ModerationCenterTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.staff = User.objects.create_user(
            username="moderadora",
            password="test-password-123",
            is_staff=True,
        )
        self.regular_user = User.objects.create_user(
            username="persona",
            password="test-password-123",
        )

    def create_parking(self, **overrides):
        data = {
            "name": "Aporte pendiente",
            "location": "Acceso norte",
            "latitude": Decimal("-33.448900"),
            "longitude": Decimal("-70.669300"),
            "place_type": Parking.PlaceType.HEALTHCARE,
            "status": Parking.Status.PENDING,
            "moderation_status": Parking.ModerationStatus.PENDING,
            "is_published": False,
            "transfer_side": Parking.TransferSide.UNKNOWN,
            "surface_type": Parking.SurfaceType.UNKNOWN,
        }
        data.update(overrides)
        return Parking.objects.create(**data)

    def edit_payload(self, parking, **overrides):
        payload = {
            "operation": "save_details",
            "name": parking.name,
            "location": parking.location,
            "latitude": str(parking.latitude or ""),
            "longitude": str(parking.longitude or ""),
            "entrance_latitude": str(parking.entrance_latitude or ""),
            "entrance_longitude": str(parking.entrance_longitude or ""),
            "place_type": parking.place_type,
            "accessibility_info": parking.accessibility_info,
            "vehicle_access_notes": parking.vehicle_access_notes,
            "accessible_entrance_notes": parking.accessible_entrance_notes,
            "photo_url": parking.photo_url,
            "has_official_signage": "" if parking.has_official_signage is None else str(parking.has_official_signage).lower(),
            "has_transfer_space": "" if parking.has_transfer_space is None else str(parking.has_transfer_space).lower(),
            "has_level_surface": "" if parking.has_level_surface is None else str(parking.has_level_surface).lower(),
            "has_curb_ramp": "" if parking.has_curb_ramp is None else str(parking.has_curb_ramp).lower(),
            "has_step_free_route": "" if parking.has_step_free_route is None else str(parking.has_step_free_route).lower(),
            "is_well_lit": "" if parking.is_well_lit is None else str(parking.is_well_lit).lower(),
            "is_covered": "" if parking.is_covered is None else str(parking.is_covered).lower(),
            "transfer_side": parking.transfer_side,
            "surface_type": parking.surface_type,
            "distance_to_entrance_m": parking.distance_to_entrance_m or "",
            "schedule_info": parking.schedule_info,
            "cost_info": parking.cost_info,
            "status": parking.status,
        }
        payload.update(overrides)
        return payload

    def test_moderation_requires_staff_account(self):
        response = self.client.get(reverse("moderation_queue"))
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response.url)

        self.client.force_login(self.regular_user)
        response = self.client.get(reverse("moderation_queue"))
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response.url)

    def test_staff_can_open_queue_and_search(self):
        self.create_parking(name="Hospital piloto")
        self.create_parking(name="Municipalidad", location="Centro cívico")
        self.client.force_login(self.staff)

        response = self.client.get(
            reverse("moderation_queue"),
            {"status": "pending", "q": "Hospital"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Hospital piloto")
        self.assertNotContains(response, "Municipalidad")
        self.assertContains(response, "Centro de moderación")

    def test_approval_publishes_without_falsely_marking_verified(self):
        parking = self.create_parking()
        self.client.force_login(self.staff)

        response = self.client.post(
            reverse("moderation_detail", args=[parking.pk]),
            {
                "operation": "apply_action",
                "action": ParkingModerationEvent.Action.APPROVED,
                "note": "Coordenada y acceso revisados.",
                "target_parking": "",
            },
        )

        self.assertRedirects(response, reverse("moderation_detail", args=[parking.pk]))
        parking.refresh_from_db()
        self.assertTrue(parking.is_published)
        self.assertEqual(parking.moderation_status, Parking.ModerationStatus.APPROVED)
        self.assertEqual(parking.status, Parking.Status.PENDING)
        self.assertEqual(parking.reviewed_by, self.staff)
        self.assertIsNotNone(parking.reviewed_at)
        self.assertTrue(
            parking.moderation_events.filter(
                action=ParkingModerationEvent.Action.APPROVED,
                actor=self.staff,
            ).exists()
        )

    def test_rejection_requires_reason(self):
        parking = self.create_parking()
        self.client.force_login(self.staff)

        response = self.client.post(
            reverse("moderation_detail", args=[parking.pk]),
            {
                "operation": "apply_action",
                "action": ParkingModerationEvent.Action.REJECTED,
                "note": "",
                "target_parking": "",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Explica el motivo")
        parking.refresh_from_db()
        self.assertEqual(parking.moderation_status, Parking.ModerationStatus.PENDING)
        self.assertFalse(parking.is_published)

    def test_edit_is_logged_without_changing_editorial_state(self):
        parking = self.create_parking()
        self.client.force_login(self.staff)

        response = self.client.post(
            reverse("moderation_detail", args=[parking.pk]),
            self.edit_payload(
                parking,
                name="Hospital corregido",
                vehicle_access_notes="Ingreso por portón norte.",
            ),
        )

        self.assertRedirects(response, reverse("moderation_detail", args=[parking.pk]))
        parking.refresh_from_db()
        self.assertEqual(parking.name, "Hospital corregido")
        self.assertEqual(parking.vehicle_access_notes, "Ingreso por portón norte.")
        self.assertEqual(parking.moderation_status, Parking.ModerationStatus.PENDING)
        event = parking.moderation_events.get(action=ParkingModerationEvent.Action.EDITED)
        self.assertIn("before", event.snapshot)
        self.assertIn("after", event.snapshot)

    def test_merge_preserves_canonical_record_and_moves_verifications(self):
        target = self.create_parking(
            name="Hospital canónico",
            moderation_status=Parking.ModerationStatus.APPROVED,
            is_published=True,
            status=Parking.Status.VERIFIED,
            vehicle_access_notes="",
        )
        source = self.create_parking(
            name="Duplicado comunitario",
            latitude=Decimal("-33.448910"),
            longitude=Decimal("-70.669310"),
            vehicle_access_notes="Acceso vehicular por calle norte.",
            has_transfer_space=True,
        )
        verification = ParkingVerification.objects.create(
            parking=source,
            is_available=True,
            accessibility_confirmed=True,
            issue_type="none",
            submission_fingerprint="unique-source-fingerprint",
        )
        self.client.force_login(self.staff)

        response = self.client.post(
            reverse("moderation_detail", args=[source.pk]),
            {
                "operation": "apply_action",
                "action": ParkingModerationEvent.Action.MERGED,
                "note": "Corresponde al mismo espacio y acceso.",
                "target_parking": target.pk,
            },
        )

        self.assertRedirects(response, reverse("moderation_detail", args=[source.pk]))
        source.refresh_from_db()
        target.refresh_from_db()
        verification.refresh_from_db()
        self.assertEqual(source.moderation_status, Parking.ModerationStatus.MERGED)
        self.assertEqual(source.status, Parking.Status.REMOVED)
        self.assertFalse(source.is_published)
        self.assertEqual(source.merged_into, target)
        self.assertEqual(verification.parking, target)
        self.assertEqual(target.verification_count, 1)
        self.assertEqual(target.vehicle_access_notes, "Acceso vehicular por calle norte.")
        self.assertTrue(target.has_transfer_space)
        merge_event = source.moderation_events.get(action=ParkingModerationEvent.Action.MERGED)
        self.assertEqual(merge_event.target_parking, target)
        self.assertEqual(merge_event.snapshot["merge"]["moved"], 1)
