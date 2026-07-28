import json

from django.test import TestCase
from django.urls import reverse

from .models import Parking, ParkingModerationEvent


class SubmissionModerationTests(TestCase):
    def test_anonymous_submission_enters_pending_queue_with_audit_event(self):
        response = self.client.post(
            reverse("submit_parking"),
            data=json.dumps(
                {
                    "name": "Punto comunitario piloto",
                    "location": "Acceso norte",
                    "latitude": -38.7359,
                    "longitude": -72.5904,
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
        self.assertEqual(parking.moderation_status, Parking.ModerationStatus.PENDING)
        self.assertFalse(parking.is_published)
        event = parking.moderation_events.get(
            action=ParkingModerationEvent.Action.SUBMITTED
        )
        self.assertIsNone(event.actor)
        self.assertEqual(event.snapshot["moderation_status"], "pending")

        public_response = self.client.get(reverse("parking_data"))
        self.assertEqual(public_response.json()["count"], 0)
