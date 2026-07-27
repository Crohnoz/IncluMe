# Generated manually for the IncluMe community parking MVP.

import django.core.validators
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("inclume_app", "0001_initial"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="parking",
            options={"ordering": ["-last_verified_at", "name"]},
        ),
        migrations.AddField(
            model_name="parking",
            name="name",
            field=models.CharField(
                default="Estacionamiento accesible",
                max_length=160,
            ),
        ),
        migrations.AlterField(
            model_name="parking",
            name="location",
            field=models.CharField(
                max_length=255,
                verbose_name="dirección o referencia",
            ),
        ),
        migrations.AlterField(
            model_name="parking",
            name="accessibility_info",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="parking",
            name="latitude",
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                max_digits=9,
                null=True,
                validators=[
                    django.core.validators.MinValueValidator(-90),
                    django.core.validators.MaxValueValidator(90),
                ],
            ),
        ),
        migrations.AddField(
            model_name="parking",
            name="longitude",
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                max_digits=9,
                null=True,
                validators=[
                    django.core.validators.MinValueValidator(-180),
                    django.core.validators.MaxValueValidator(180),
                ],
            ),
        ),
        migrations.AddField(
            model_name="parking",
            name="place_type",
            field=models.CharField(
                choices=[
                    ("street", "Vía pública"),
                    ("municipal", "Municipal"),
                    ("business", "Comercio"),
                    ("healthcare", "Clínica u hospital"),
                    ("building", "Edificio"),
                    ("private", "Privado"),
                    ("other", "Otro"),
                ],
                default="other",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="parking",
            name="has_official_signage",
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="parking",
            name="has_transfer_space",
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="parking",
            name="has_level_surface",
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="parking",
            name="has_curb_ramp",
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="parking",
            name="has_step_free_route",
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="parking",
            name="is_well_lit",
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="parking",
            name="is_covered",
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="parking",
            name="schedule_info",
            field=models.CharField(blank=True, default="", max_length=255),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="parking",
            name="cost_info",
            field=models.CharField(blank=True, default="", max_length=255),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="parking",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pendiente de verificación"),
                    ("verified", "Verificado"),
                    ("unavailable", "Temporalmente no disponible"),
                    ("removed", "Retirado"),
                ],
                db_index=True,
                default="pending",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="parking",
            name="verification_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="parking",
            name="last_verified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="parking",
            name="created_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="parking_spots_created",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="parking",
            name="created_at",
            field=models.DateTimeField(
                auto_now_add=True,
                default=django.utils.timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="parking",
            name="updated_at",
            field=models.DateTimeField(
                auto_now=True,
                default=django.utils.timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.CreateModel(
            name="ParkingVerification",
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
                ("is_available", models.BooleanField(default=True)),
                ("accessibility_confirmed", models.BooleanField(default=True)),
                ("comment", models.TextField(blank=True)),
                (
                    "evidence_url",
                    models.URLField(
                        blank=True,
                        help_text=(
                            "URL de una fotografía o evidencia almacenada externamente."
                        ),
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "parking",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="verifications",
                        to="inclume_app.parking",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="parking_verifications",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="parking",
            index=models.Index(
                fields=["latitude", "longitude"],
                name="inclume_parking_coords_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="parking",
            index=models.Index(
                fields=["status", "last_verified_at"],
                name="inclume_parking_state_idx",
            ),
        ),
    ]
