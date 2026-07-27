import json

from django.test import TestCase
from django.urls import reverse


class InclusiveInterfaceTests(TestCase):
    def submission_payload(self, **overrides):
        payload = {
            "name": "Estacionamiento comunitario",
            "location": "Acceso norte",
            "latitude": -33.4489,
            "longitude": -70.6693,
            "place_type": "healthcare",
            "transfer_side": "right",
            "surface_type": "level",
            "has_transfer_space": True,
            "has_step_free_route": True,
        }
        payload.update(overrides)
        return payload

    def test_parking_page_loads_accessibility_and_geotag_assets(self):
        response = self.client.get(reverse("parking"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "accessibility-dialog")
        self.assertContains(response, "inclusive-v4.css")
        self.assertContains(response, "accessibility-controls.js")
        self.assertContains(response, "parking-geotag-v4.css")
        self.assertContains(response, "parking-geotag-v4.js")
        self.assertContains(response, "data-map-style=\"vivid\"")

    def test_submission_inside_chile_is_accepted_for_moderation(self):
        response = self.client.post(
            reverse("submit_parking"),
            data=json.dumps(self.submission_payload()),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()["ok"])

    def test_submission_outside_chile_is_rejected(self):
        response = self.client.post(
            reverse("submit_parking"),
            data=json.dumps(
                self.submission_payload(
                    name="Punto fuera de Chile",
                    latitude=40.7128,
                    longitude=-74.0060,
                )
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertFalse(payload["ok"])
        error_text = " ".join(
            message
            for messages in payload["errors"].values()
            for message in messages
        )
        self.assertIn("Chile", error_text)
