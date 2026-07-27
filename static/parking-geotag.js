(() => {
    "use strict";

    const root = document.getElementById("parking-app");
    const form = document.getElementById("contribute-form");
    if (!root || !form || !window.L) return;

    const CHILE_CENTER = [-33.4489, -70.6693];
    const CHILE_ZOOM = 5;
    const CHILE_BOUNDS = window.L.latLngBounds([[-58, -112], [-15, -64]]);
    const maps = (window.IncluMeMaps = window.IncluMeMaps || {});

    let pinMode = false;
    let contributionMap = null;
    let contributionMarker = null;
    let pendingMainMarker = null;
    let mainMapEventsBound = false;

    function setLiveStatus(message) {
        const status = document.getElementById("parking-status");
        if (status) status.textContent = message;
    }

    function geotagIcon(pending = false) {
        return window.L.divIcon({
            className: "",
            html: `<span class="inclume-geotag-pin${pending ? " inclume-geotag-pin--pending" : ""}" aria-hidden="true"><span>♿</span></span>`,
            iconSize: [46, 46],
            iconAnchor: [23, 42],
        });
    }

    function patchLeafletMapFactory() {
        if (window.L.map.__inclumePatched) return;
        const originalMap = window.L.map;
        const patchedMap = function patchedMap(target, options) {
            const map = originalMap.call(window.L, target, options);
            const container = map.getContainer();
            if (container?.id === "map") {
                maps.main = map;
                map.setMaxBounds(CHILE_BOUNDS.pad(0.15));
                map.options.maxBoundsViscosity = 0.55;

                const originalSetView = map.setView.bind(map);
                let initialViewPending = true;
                map.setView = function setView(center, zoom, setViewOptions) {
                    if (initialViewPending) {
                        initialViewPending = false;
                        return originalSetView(CHILE_CENTER, CHILE_ZOOM, setViewOptions);
                    }
                    return originalSetView(center, zoom, setViewOptions);
                };
            }
            return map;
        };
        patchedMap.__inclumePatched = true;
        window.L.map = patchedMap;
    }

    patchLeafletMapFactory();

    const latitudeInput = form.elements.latitude;
    const longitudeInput = form.elements.longitude;
    const contributionDialog = document.getElementById("contribute-dialog");

    function validCoordinates() {
        const latitude = Number(latitudeInput.value);
        const longitude = Number(longitudeInput.value);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
        return { latitude, longitude };
    }

    function updateCoordinateStatus(point, prefix = "Punto marcado") {
        const status = document.getElementById("geotag-picker-status");
        if (!status) return;
        status.textContent = `${prefix}: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}. Puedes arrastrar el marcador para afinarlo.`;
    }

    function movePendingMainMarker(point) {
        const mainMap = maps.main;
        if (!mainMap) return;
        const coordinates = [point.latitude, point.longitude];
        if (!pendingMainMarker) {
            pendingMainMarker = window.L.marker(coordinates, {
                icon: geotagIcon(true),
                draggable: true,
                keyboard: true,
                title: "Nuevo estacionamiento pendiente",
            })
                .addTo(mainMap)
                .bindPopup("Nuevo punto pendiente de revisión.");
            pendingMainMarker.on("dragend", () => {
                const position = pendingMainMarker.getLatLng();
                setContributionPoint(position.lat, position.lng, "Marcador ajustado");
            });
        } else {
            pendingMainMarker.setLatLng(coordinates);
        }
    }

    function moveContributionMarker(point) {
        if (!contributionMap) return;
        const coordinates = [point.latitude, point.longitude];
        if (!contributionMarker) {
            contributionMarker = window.L.marker(coordinates, {
                icon: geotagIcon(false),
                draggable: true,
                keyboard: true,
                title: "Ubicación exacta del estacionamiento",
            }).addTo(contributionMap);
            contributionMarker.on("dragend", () => {
                const position = contributionMarker.getLatLng();
                setContributionPoint(position.lat, position.lng, "Marcador ajustado");
            });
        } else {
            contributionMarker.setLatLng(coordinates);
        }
        contributionMap.setView(coordinates, Math.max(contributionMap.getZoom(), 17));
    }

    function setContributionPoint(latitude, longitude, prefix = "Punto marcado") {
        const point = { latitude: Number(latitude), longitude: Number(longitude) };
        if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return;

        latitudeInput.value = point.latitude.toFixed(6);
        longitudeInput.value = point.longitude.toFixed(6);
        latitudeInput.dispatchEvent(new Event("input", { bubbles: true }));
        longitudeInput.dispatchEvent(new Event("input", { bubbles: true }));
        moveContributionMarker(point);
        movePendingMainMarker(point);
        updateCoordinateStatus(point, prefix);
    }

    function ensureContributionMap() {
        const container = document.getElementById("contribution-geotag-map");
        if (!container || contributionMap) {
            window.setTimeout(() => contributionMap?.invalidateSize(), 50);
            return;
        }

        contributionMap = window.L.map(container, {
            scrollWheelZoom: false,
            zoomControl: true,
            preferCanvas: true,
        }).setView(CHILE_CENTER, CHILE_ZOOM);
        contributionMap.setMaxBounds(CHILE_BOUNDS.pad(0.15));
        window.L.tileLayer(root.dataset.tileUrl, {
            maxZoom: 19,
            attribution: root.dataset.tileAttribution,
        }).addTo(contributionMap);
        contributionMap.on("click", (event) => {
            setContributionPoint(event.latlng.lat, event.latlng.lng);
        });

        const current = validCoordinates();
        if (current) moveContributionMarker(current);
        window.setTimeout(() => contributionMap.invalidateSize(), 50);
    }

    function openContributionDialog(point = null) {
        if (!contributionDialog.open) {
            if (typeof contributionDialog.showModal === "function") contributionDialog.showModal();
            else contributionDialog.setAttribute("open", "");
        }
        window.setTimeout(() => {
            ensureContributionMap();
            if (point) setContributionPoint(point.latitude, point.longitude);
        }, 60);
    }

    function bindMainMap() {
        const mainMap = maps.main;
        if (!mainMap || mainMapEventsBound) return Boolean(mainMap);
        mainMapEventsBound = true;
        mainMap.on("click", (event) => {
            if (!pinMode) return;
            pinMode = false;
            const mapContainer = mainMap.getContainer();
            mapContainer.classList.remove("is-pin-mode");
            document.getElementById("pin-parking-button")?.setAttribute("aria-pressed", "false");
            const point = { latitude: event.latlng.lat, longitude: event.latlng.lng };
            setContributionPoint(point.latitude, point.longitude);
            openContributionDialog(point);
            setLiveStatus("Punto marcado en Chile. Completa los datos y envíalo para revisión.");
        });
        return true;
    }

    function waitForMainMap(callback, attempts = 40) {
        if (bindMainMap()) {
            callback?.(maps.main);
            return;
        }
        if (attempts <= 0) {
            callback?.(null);
            return;
        }
        window.setTimeout(() => waitForMainMap(callback, attempts - 1), 100);
    }

    function enablePinMode() {
        const mapViewButton = document.querySelector('[data-view="map"]');
        mapViewButton?.click();
        waitForMainMap((mainMap) => {
            if (!mainMap) {
                openContributionDialog();
                setLiveStatus("El mapa principal no está disponible. Puedes marcar el punto en el formulario.");
                return;
            }
            pinMode = true;
            mainMap.getContainer().classList.add("is-pin-mode");
            document.getElementById("pin-parking-button")?.setAttribute("aria-pressed", "true");
            mainMap.setView(CHILE_CENTER, Math.max(mainMap.getZoom(), CHILE_ZOOM));
            setLiveStatus("Modo geotag activo. Toca el mapa donde está el estacionamiento accesible.");
        });
    }

    function useDeviceLocation() {
        const status = document.getElementById("geotag-picker-status");
        if (!navigator.geolocation) {
            if (status) status.textContent = "Este dispositivo no permite obtener la ubicación. Toca el mapa para marcarla.";
            return;
        }
        if (status) status.textContent = "Buscando tu ubicación…";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setContributionPoint(position.coords.latitude, position.coords.longitude, "Ubicación del dispositivo");
            },
            (error) => {
                const message = {
                    1: "No diste permiso. Puedes tocar el mapa para marcar el punto.",
                    2: "No pudimos determinar la ubicación. Puedes tocar el mapa.",
                    3: "La ubicación tardó demasiado. Puedes tocar el mapa.",
                }[error.code] || "No fue posible obtener la ubicación.";
                if (status) status.textContent = message;
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
        );
    }

    function injectControls() {
        const toolbarActions = document.querySelector(".parking-search-panel__actions");
        if (toolbarActions && !document.getElementById("pin-parking-button")) {
            const button = document.createElement("button");
            button.id = "pin-parking-button";
            button.className = "button button--secondary pin-parking-button";
            button.type = "button";
            button.setAttribute("aria-pressed", "false");
            button.textContent = "Marcar en el mapa";
            button.addEventListener("click", enablePinMode);
            toolbarActions.appendChild(button);
        }

        const coordinateGrid = latitudeInput.closest(".form-grid");
        if (!coordinateGrid || document.getElementById("contribution-geotag-map")) return;
        coordinateGrid.classList.add("geotag-coordinate-grid");

        const picker = document.createElement("section");
        picker.className = "geotag-picker";
        picker.setAttribute("aria-labelledby", "geotag-picker-title");
        picker.innerHTML = `
            <div class="geotag-picker__header">
                <div>
                    <h3 id="geotag-picker-title">Marca la ubicación exacta en Chile</h3>
                    <p>Toca el mapa o arrastra el marcador. La dirección escrita sirve como referencia; las coordenadas guían la navegación.</p>
                </div>
            </div>
            <div class="geotag-picker__actions">
                <button class="button button--secondary" id="geotag-device-location" type="button">Usar mi ubicación</button>
                <button class="button button--secondary" id="geotag-show-chile" type="button">Ver Chile completo</button>
            </div>
            <div id="contribution-geotag-map" role="application" aria-label="Mapa para marcar la ubicación exacta del estacionamiento"></div>
            <p class="geotag-picker__status" id="geotag-picker-status" role="status" aria-live="polite">Todavía no has marcado un punto.</p>
        `;
        coordinateGrid.parentNode.insertBefore(picker, coordinateGrid);
        document.getElementById("geotag-device-location")?.addEventListener("click", useDeviceLocation);
        document.getElementById("geotag-show-chile")?.addEventListener("click", () => {
            ensureContributionMap();
            contributionMap?.setView(CHILE_CENTER, CHILE_ZOOM);
        });
    }

    function syncFromCoordinateFields() {
        const point = validCoordinates();
        if (point && contributionMap) {
            moveContributionMarker(point);
            updateCoordinateStatus(point, "Coordenadas actualizadas");
        }
    }

    injectControls();
    waitForMainMap();

    document.getElementById("contribute-button")?.addEventListener("click", () => {
        window.setTimeout(ensureContributionMap, 80);
    });
    contributionDialog?.addEventListener("toggle", () => {
        if (contributionDialog.open) window.setTimeout(ensureContributionMap, 60);
    });
    latitudeInput.addEventListener("change", syncFromCoordinateFields);
    longitudeInput.addEventListener("change", syncFromCoordinateFields);
    form.addEventListener("reset", () => {
        window.setTimeout(() => {
            contributionMarker?.remove();
            contributionMarker = null;
            const status = document.getElementById("geotag-picker-status");
            if (status) status.textContent = "Aporte enviado. El punto queda pendiente de revisión antes de publicarse.";
            if (pendingMainMarker) {
                pendingMainMarker.bindPopup("Aporte enviado. Pendiente de revisión antes de publicarse.").openPopup();
            }
        }, 0);
    });
})();
