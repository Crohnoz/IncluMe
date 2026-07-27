from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("health/", views.health, name="health"),
    path("service-worker.js", views.service_worker, name="service_worker"),
    path("resources/", views.resources, name="resources"),
    path("parking/", views.parking, name="parking"),
    path("api/parkings/", views.parking_data, name="parking_data"),
    path("api/parkings/submit/", views.submit_parking, name="submit_parking"),
    path(
        "api/parkings/<int:parking_id>/verify/",
        views.verify_parking,
        name="verify_parking",
    ),
    path("moderation/", views.moderation_queue, name="moderation_queue"),
    path(
        "moderation/<int:parking_id>/",
        views.moderation_detail,
        name="moderation_detail",
    ),
    path("contact/", views.contact, name="contact"),
]
