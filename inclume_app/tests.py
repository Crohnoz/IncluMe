from decimal import Decimal

from django.test import TestCase
from django.urls import reverse

from .models import Parking


class ParkingDataViewTests(TestCase):
    def test_returns_georeferenced_parking(self):
        parking = Parking.objects.create(
            name="Estacionamiento Hospital",
            location="Entrada principal",
            latitude=Decimal("-33.448900"),
            longitude=Decimal("-70.669300"),
            status=Parking.Status.VERIFIED,
            has_official_signage=True,
            has_transfer_space=True,
            verification_count=3,
        )

        response = self.client.get(reverse("parking_data"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["parkings"][0]["id"], parking.pk)
        self.assertEqual(payload["parkings"][0]["status"], "verified")
        self.assertIn(
            "Espacio de transferencia",
            payload["parkings"][0]["features"],
        )

    def test_excludes_parking_without_coordinates(self):
        Parking.objects.create(
            name="Registro incompleto",
            location="Dirección pendiente",
        )

        response = self.client.get(reverse("parking_data"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 0)

    def test_excludes_removed_parking(self):
        Parking.objects.create(
            name="Lugar retirado",
            location="Ya no existe",
            latitude=Decimal("-33.448900"),
            longitude=Decimal("-70.669300"),
            status=Parking.Status.REMOVED,
        )

        response = self.client.get(reverse("parking_data"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 0)
