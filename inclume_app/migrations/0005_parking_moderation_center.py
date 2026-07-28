from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def initialize_moderation_status(apps, schema_editor):
    Parking = apps.get_model("inclume_app", "Parking")
    Parking.objects.filter(is_published=True).update(moderation_status="approved")
    Parking.objects.filter(is_published=False).update(moderation_status="pending")


def reverse_moderation_status(apps, schema_editor):
    Parking = apps.get_model("inclume_app", "Parking")
    Parking.objects.all().update(moderation_status="approved")


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("inclume_app", "0004_parking_trust_resilience"),
    ]

    operations = [
        migrations.AddField(
            model_name="parking",
            name="moderation_status",
            field=models.CharField(
                choices=[
                    ("pending", "Pendiente de revisión"),
                    ("approved", "Aprobado"),
                    ("changes_requested", "Requiere correcciones"),
                    ("rejected", "Rechazado"),
                    ("merged", "Fusionado"),
                ],
                db_index=True,
                default="approved",
                help_text="Estado editorial independiente de la verificación comunitaria del lugar.",
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name="parking",
            name="moderation_notes",
            field=models.TextField(
                blank=True,
                help_text="Motivo o instrucción de la decisión editorial más reciente.",
            ),
        ),
        migrations.AddField(
            model_name="parking",
            name="reviewed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="parking",
            name="merged_into",
            field=models.ForeignKey(
                blank=True,
                help_text="Registro canónico que absorbió este aporte cuando fue fusionado.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="merged_sources",
                to="inclume_app.parking",
            ),
        ),
        migrations.AddField(
            model_name="parking",
            name="reviewed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="parking_moderation_reviews",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.CreateModel(
            name="ParkingModerationEvent",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "action",
                    models.CharField(
                        choices=[
                            ("submitted", "Aporte recibido"),
                            ("edited", "Datos editados"),
                            ("approved", "Aprobado"),
                            ("changes_requested", "Correcciones solicitadas"),
                            ("rejected", "Rechazado"),
                            ("merged", "Fusionado"),
                            ("reopened", "Reabierto"),
                        ],
                        max_length=24,
                    ),
                ),
                ("note", models.TextField(blank=True)),
                ("snapshot", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="parking_moderation_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "parking",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="moderation_events",
                        to="inclume_app.parking",
                    ),
                ),
                (
                    "target_parking",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="moderation_target_events",
                        to="inclume_app.parking",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="parking",
            index=models.Index(
                fields=["moderation_status", "created_at"],
                name="inclume_parking_mod_queue_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="parkingmoderationevent",
            index=models.Index(
                fields=["parking", "-created_at"],
                name="inclume_mod_event_time_idx",
            ),
        ),
        migrations.RunPython(initialize_moderation_status, reverse_moderation_status),
    ]
