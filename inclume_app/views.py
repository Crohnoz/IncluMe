# inclume_app/views.py
from django.shortcuts import render

def home(request):
    return render(request, 'index.html')

def resources(request):
    return render(request, 'resources.html')  # Renderiza el template de recursos
def parking(request):
    return render(request, 'parking.html')
def contact(request):
    return render(request, 'contact.html')