from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),  # URL para la página de inicio
    path('resources/', views.resources, name='resources'),  # URL para la página de recursos
    path('parking/', views.parking, name='parking'),
    path('contact/', views.contact, name='contact'),
]
