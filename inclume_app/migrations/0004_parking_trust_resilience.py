from django.db import migrations, models


def rebuild_parking_trust(apps, schema_editor):
    Parking = apps.get_model("inclume_app", "Parking")
    ParkingVerification = apps.get_model("inclume_app", "ParkingVerification")

    for parking in Parking.objects.all().iterator():
        verifications = ParkingVerification.objects.filter(parking_id=parking.pk)
        positives = verifications.filter(
            is_available=True,
            accessibility_confirmed=True,
            issue_type="none",
        )
        issues = verifications.exclude(
            is_available=True,
            accessibility_confirmed=True,
            issue_type="none",
        )
        latest_issue = issues.order_by("-created_at").first()
        parking.verification_count = positives.count()
        parking.issue_report_count = issues.count()
        parking.last_verified_at = (
            positives.order_by("-created_at").values_list("created_at", flat=True).first()
        )
        parking.last_reported_at = (
            issues.order_by("-created_at").values_list("created_at", flat=True).first()
        )
        parking.last_issue_type = latest_issue.issue_type if latest_issue else "none"
        parking.save(
            update_fields=[
                "verification_count",
                "issue_report_count",
                "last_verified_at",
                "last_reported_at",
                "last_issue_type",
            ]
        )


class Migration(migrations.Migration):
    dependencies = [
        ("inclume_app", "0003_parking_product_v2"),
    ]

    operations = [
        migrations.AddField(
            model_name="parking",
            name="issue_report_count",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Cantidad de verificaciones que informaron una incidencia.",
            ),
        ),
        migrations.AddField(
            model_name="parking",
            name="last_issue_type",
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
                help_text="Tipo de la incidencia más reciente.",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="parking",
            name="last_reported_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Fecha de la última incidencia informada.",
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="parking",
            name="last_verified_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Fecha de la última confirmación positiva.",
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="parking",
            name="verification_count",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Cantidad de confirmaciones positivas registradas.",
            ),
        ),
        migrations.AddField(
            model_name="parkingverification",
            name="submission_fingerprint",
            field=models.CharField(
                blank=True,
                editable=False,
                help_text=(
                    "Identificador irreversible y temporal utilizado para evitar envíos "
                    "repetidos desde la misma sesión."
                ),
                max_length=64,
            ),
        ),
        migrations.RunPython(
            rebuild_parking_trust,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AddIndex(
            model_name="parking",
            index=models.Index(
                fields=["last_reported_at", "last_issue_type"],
                name="inclume_parking_issue_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="parkingverification",
            constraint=models.UniqueConstraint(
                condition=models.Q(("submission_fingerprint", ""), _negated=True),
                fields=("parking", "submission_fingerprint"),
                name="inclume_unique_verify_fingerprint",
            ),
        ),
    ]
