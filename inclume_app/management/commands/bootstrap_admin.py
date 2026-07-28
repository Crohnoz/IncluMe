from __future__ import annotations

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Crea o actualiza la cuenta administrativa inicial desde variables de entorno."

    def add_arguments(self, parser):
        parser.add_argument(
            "--require",
            action="store_true",
            help="Falla si las variables requeridas no están configuradas.",
        )

    def handle(self, *args, **options):
        username = os.getenv("INCLUME_ADMIN_USERNAME", "").strip()
        email = os.getenv("INCLUME_ADMIN_EMAIL", "").strip()
        password = os.getenv("INCLUME_ADMIN_PASSWORD", "")

        missing = [
            name
            for name, value in (
                ("INCLUME_ADMIN_USERNAME", username),
                ("INCLUME_ADMIN_EMAIL", email),
                ("INCLUME_ADMIN_PASSWORD", password),
            )
            if not value
        ]
        if missing:
            message = "Faltan variables para crear la cuenta de equipo: " + ", ".join(missing)
            if options["require"]:
                raise CommandError(message)
            self.stdout.write(self.style.WARNING(message + ". Se omitió el bootstrap."))
            return

        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email},
        )
        changed_fields = []
        if user.email != email:
            user.email = email
            changed_fields.append("email")
        if not user.is_staff:
            user.is_staff = True
            changed_fields.append("is_staff")
        if not user.is_superuser:
            user.is_superuser = True
            changed_fields.append("is_superuser")
        user.set_password(password)
        changed_fields.append("password")
        user.save()

        action = "creada" if created else "actualizada"
        self.stdout.write(self.style.SUCCESS(f"Cuenta administrativa {action}: {username}"))
