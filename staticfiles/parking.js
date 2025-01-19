var map = L.map('map').setView([-33.45694, -70.64827], 13); // Coordenadas de Santiago, ajusta según necesidad

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Añadir un marcador
L.marker([-33.45694, -70.64827]).addTo(map)
    .bindPopup('Un posible estacionamiento para discapacitados aquí.')
    .openPopup();
