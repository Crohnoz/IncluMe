(() => {
    "use strict";

    const dataNode = document.getElementById("destination-map-data");
    const mapNode = document.getElementById("destination-map");
    if (!dataNode || !mapNode || !window.L) return;

    let payload;
    try {
        payload = JSON.parse(dataNode.textContent || "{}");
    } catch (_error) {
        mapNode.textContent = "No pudimos preparar el mapa. La lista de resultados sigue disponible.";
        return;
    }

    const destination = payload.destination;
    const parkings = Array.isArray(payload.parkings) ? payload.parkings : [];
    if (!destination) return;

    const map = window.L.map(mapNode, {
        scrollWheelZoom: false,
        zoomControl: true,
    }).setView([destination.latitude, destination.longitude], 15);

    window.L.tileLayer(payload.tile_url, {
        maxZoom: 19,
        attribution: payload.tile_attribution,
    }).addTo(map);

    const destinationIcon = window.L.divIcon({
        className: "",
        html: '<span class="destination-marker" aria-hidden="true"><span>D</span></span>',
        iconSize: [38, 38],
        iconAnchor: [19, 34],
    });
    const destinationMarker = window.L.marker(
        [destination.latitude, destination.longitude],
        { icon: destinationIcon },
    ).addTo(map);
    destinationMarker.bindPopup(
        document.createTextNode(destination.label),
    );

    const bounds = [[destination.latitude, destination.longitude]];
    parkings.forEach((parking, index) => {
        const icon = window.L.divIcon({
            className: "",
            html: `<span class="destination-parking-marker" aria-hidden="true"><span>${index + 1}</span></span>`,
            iconSize: [38, 38],
            iconAnchor: [19, 34],
        });
        const marker = window.L.marker(
            [parking.latitude, parking.longitude],
            { icon },
        ).addTo(map);

        const popup = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = parking.name;
        const detail = document.createElement("p");
        detail.textContent = `${parking.distance_m} m desde el destino`;
        const link = document.createElement("a");
        link.href = parking.google_maps_url;
        link.textContent = "Abrir navegación";
        popup.append(title, detail, link);
        marker.bindPopup(popup);
        bounds.push([parking.latitude, parking.longitude]);
    });

    if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
    }
})();
