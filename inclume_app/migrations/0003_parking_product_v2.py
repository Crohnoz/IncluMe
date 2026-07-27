from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):
    dependencies = [
        ("inclume_app", "0002_parking_community_mvp"),
    ]

    operations = [
        migrations.AddField(
            model_name="parking",
            name="accessible_entrance_notes",
            field=models.TextField(
                blank=True,
                help_text="Indicaciones desde el estacionamiento hasta la entrada accesible.",
            ),
        ),
        migrations.AddField(
            model_name="parking",
            name="distance_to_entrance_m",
            field=models.PositiveSmallIntegerField(
                blank=True,
                help_text="Distancia aproximada hasta la entrada accesible, en metros.",
                null=True,
                validators=[django.core.validators.MaxValueValidator(5000)],
            ),
        ),
        migrations.AddField(
            model_name="parking",
            name="entrance_latitude",
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text="Coordenada de la entrada accesible del destino, si se conoce.",
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
            name="entrance_longitude",
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text="Coordenada de la entrada accesible del destino, si se conoce.",
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
            name="is_published",
            field=models.BooleanField(
                db_index=True,
                default=True,
                help_text="Solo los registros publicados aparecen en la aplicación pública.",
            ),
        ),
        migrations.AddField(
            model_name="parking",
            name="photo_url",
            field=models.URLField(
                blank=True,
                help_text="Fotografía de referencia moderada y sin datos personales visibles.",
            ),
        ),
        migrations.AddField(
            model_name="parking",
            name="surface_type",
            field=models.CharField(
                choices=[
                    ("unknown", "No informada"),
                    ("level", "Nivelada"),
                    ("slight_slope", "Pendiente leve"),
                    ("steep_slope", "Pendiente pronunciada"),
                    ("irregular", "Irregular"),
                ],
                default="unknown",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="parking",
            name="transfer_side",
            field=models.CharField(
                choices=[
                    ("unknown", "No informado"),
                    ("left", "Lado izquierdo"),
                    ("right", "Lado derecho"),
                    ("both", "Ambos lados"),
                ],
                default="unknown",
                max_length=12,
            ),
        ),
        migrations.AddField(
            model_name="parking",
            name="vehicle_access_notes",
            field=models.TextField(
                blank=True,
                help_text="Cómo ingresar en vehículo: portón, costado, sentido de la calle u otra referencia.",
            ),
        ),
        migrations.AddField(
            model_name="parkingverification",
            name="issue_type",
            field=models.CharField(
                choices=[
                    ("none", "Sin problema"),
                    ("occupied", "Espacio ocupado"),
                    ("blocked", "Acceso bloqueado"),
                    ("signage", "Señalización ausente o dañada"),
                    ("route", "Ruta accesible interrumpida"),
                    ("removed", "El estacionamiento ya no existe"),
                    ("other", "Otro"),
                ],
                default="none",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="parkingverification",
            name="official_signage_visible",
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="parkingverification",
            name="step_free_route_clear",
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="parkingverification",
            name="transfer_space_clear",
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name="parking",
            index=models.Index(
                fields=["is_published", "status"],
                name="inclume_parking_public_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="parkingverification",
            index=models.Index(
                fields=["parking", "-created_at"],
                name="inclume_verify_recent_idx",
            ),
        ),
    ]
