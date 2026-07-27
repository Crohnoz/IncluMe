from django.urls import path

from . import functional_views, municipal_views, views

urlpatterns = [
    path("", views.home, name="home"),
    path("health/", views.health, name="health"),
    path("service-worker.js", views.service_worker, name="service_worker"),
    path("resources/", views.resources, name="resources"),
    path("parking/", functional_views.destination_search, name="parking"),
    path("parking/mapa/", views.parking, name="parking_map"),
    path("api/parkings/", views.parking_data, name="parking_data"),
    path(
        "api/parkings/nearby/",
        functional_views.nearby_parkings_api,
        name="nearby_parkings_api",
    ),
    path("api/parkings/submit/", views.submit_parking, name="submit_parking"),
    path(
        "api/parkings/<int:parking_id>/verify/",
        views.verify_parking,
        name="verify_parking",
    ),
    path("municipalidades/", municipal_views.municipalities, name="municipalities"),
    path(
        "api/municipalidades/resumen/",
        municipal_views.municipal_summary_api,
        name="municipal_summary_api",
    ),
    path(
        "municipalidades/panel/",
        municipal_views.municipal_dashboard,
        name="municipal_dashboard",
    ),
    path(
        "municipalidades/exportar.csv",
        municipal_views.municipal_export_csv,
        name="municipal_export_csv",
    ),
    path("moderation/", views.moderation_queue, name="moderation_queue"),
    path(
        "moderation/<int:parking_id>/",
        views.moderation_detail,
        name="moderation_detail",
    ),
    path("contact/", views.contact, name="contact"),
]
