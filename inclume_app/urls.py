from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("resources/", views.resources, name="resources"),
    path("parking/", views.parking, name="parking"),
    path("api/parkings/", views.parking_data, name="parking_data"),
    path("contact/", views.contact, name="contact"),
]
