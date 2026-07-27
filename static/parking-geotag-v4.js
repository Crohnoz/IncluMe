(() => {
    "use strict";

    const root = document.getElementById("parking-app");
    const form = document.getElementById("contribute-form");
    if (!root || !form || !window.L) return;

    const CHILE_CENTER = [-33.4489, -70.6693];
    const CHILE_ZOOM = 5;
    const CHILE_BOUNDS = window.L.latLngBounds([[-58, -112], [-15, -64]]);
    const NUDGE_STEP = 0.0001;
    const maps = (window.IncluMeMaps = window.IncluMeMaps || {});

    let pinMode = false;
    let contributionMap = null;
    let contributionMarker = null;
    let pendingMainMarker = null;
    let mainMapEventsBound = false;

    const latitudeInput = form.elements.latitude;
    const longitudeInput = form.elements.longitude;
    const contributionDialog = document.getElementById("contribute-dialog");

    function setLiveStatus(message) {
        const status = document.getElementById("parking-status");
        if (status) status.textContent = message;
    }

    function isInsideChile(latitude, longitude) {
        return CHILE_BOUNDS.contains([Number(latitude), Number(longitude)]);
    }

    function geotagIcon(pending = false) {
        return window.L.divIcon({
            className: "",
            html: `<span class="inclume-geotag-pin${pending ? " inclume-geotag-pin--pending" : ""}" aria-hidden="true"><span>P</span></span>`,
            iconSize: [48, 48],
            iconAnchor: [24, 44],
        });
    }

    function patchLeafletMapFactory() {
        if (window.L.map.__inclumePatchedV4) return;
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
        patchedMap.__inclumePatchedV4 = true;
        window.L.map = patchedMap;
    }

    patchLeafletMapFactory();

    function validCoordinates() {
        const latitude = Number(latitudeInput.value);
        const longitude = Number(longitudeInput.value);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        if (!isInsideChile(latitude, longitude)) return null;
        return { latitude, longitude };
    }

    function validateCoordinateFields() {
        const latitude = Number(latitudeInput.value);
        const longitude = Number(longitudeInput.value);
        const complete = Number.isFinite(latitude) && Number.isFinite(longitude);
        const message = complete && !isInsideChile(latitude, longitude)
            ? "IncluMe está enfocado en Chile. Marca un punto dentro del territorio chileno."
            : "";
        latitudeInput.setCustomValidity(message);
        longitudeInput.setCustomValidity(message);
        return !message;
    }

    function updateCoordinateStatus(point, prefix = "Punto marcado") {
        const status = document.getElementById("geotag-picker-status");
        if (!status) return;
        status.textContent = `${prefix}: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}. Puedes tocar, escribir coordenadas, usar los botones de ajuste o arrastrar el marcador.`;
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
                title: "Nuevo estacionamiento pendiente de revisión",
                alt: "Nuevo estacionamiento pendiente de revisión",
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

    function moveContributionMarker(point, moveView = true) {
        if (!contributionMap) return;
        const coordinates = [point.latitude, point.longitude];
        if (!contributionMarker) {
            contributionMarker = window.L.marker(coordinates, {
                icon: geotagIcon(false),
                draggable: true,
                keyboard: true,
                title: "Ubicación exacta del estacionamiento",
                alt: "Ubicación exacta del estacionamiento",
            }).addTo(contributionMap);
            contributionMarker.on("dragend", () => {
                const position = contributionMarker.getLatLng();
                setContributionPoint(position.lat, position.lng, "Marcador ajustado");
            });
        } else {
            contributionMarker.setLatLng(coordinates);
        }
        if (moveView) contributionMap.setView(coordinates, Math.max(contributionMap.getZoom(), 17));
    }

    function setContributionPoint(latitude, longitude, prefix = "Punto marcado", moveView = true) {
        const point = { latitude: Number(latitude), longitude: Number(longitude) };
        if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return false;
        if (!isInsideChile(point.latitude, point.longitude)) {
            setLiveStatus("El punto está fuera del área de Chile configurada para IncluMe.");
            const pickerStatus = document.getElementById("geotag-picker-status");
            if (pickerStatus) pickerStatus.textContent = "El punto está fuera de Chile. Ajusta el mapa o escribe coordenadas válidas.";
            return false;
        }

        latitudeInput.value = point.latitude.toFixed(6);
        longitudeInput.value = point.longitude.toFixed(6);
        validateCoordinateFields();
        latitudeInput.dispatchEvent(new Event("input", { bubbles: true }));
        longitudeInput.dispatchEvent(new Event("input", { bubbles: true }));
        moveContributionMarker(point, moveView);
        movePendingMainMarker(point);
        updateCoordinateStatus(point, prefix);
        return true;
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
        contributionMap.options.maxBoundsViscosity = 0.55;
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

    function cancelPinMode(message = "Modo geotag cancelado.") {
        pinMode = false;
        maps.main?.getContainer().classList.remove("is-pin-mode");
        document.getElementById("pin-parking-button")?.setAttribute("aria-pressed", "false");
        setLiveStatus(message);
    }

    function bindMainMap() {
        const mainMap = maps.main;
        if (!mainMap || mainMapEventsBound) return Boolean(mainMap);
        mainMapEventsBound = true;
        mainMap.on("click", (event) => {
            if (!pinMode) return;
            cancelPinMode("Punto marcado en Chile. Completa los datos y envíalo para revisión.");
            const point = { latitude: event.latlng.lat, longitude: event.latlng.lng };
            if (!setContributionPoint(point.latitude, point.longitude)) return;
            openContributionDialog(point);
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
                setLiveStatus("El mapa principal no está disponible. Puedes usar coordenadas o el mapa del formulario.");
                return;
            }
            pinMode = true;
            mainMap.getContainer().classList.add("is-pin-mode");
            document.getElementById("pin-parking-button")?.setAttribute("aria-pressed", "true");
            mainMap.setView(CHILE_CENTER, Math.max(mainMap.getZoom(), CHILE_ZOOM));
            setLiveStatus("Modo geotag activo. Toca el mapa donde está el estacionamiento. Presiona Escape para cancelar.");
        });
    }

    function useDeviceLocation() {
        const status = document.getElementById("geotag-picker-status");
        if (!navigator.geolocation) {
            if (status) status.textContent = "Este dispositivo no permite obtener la ubicación. Toca el mapa o escribe coordenadas.";
            return;
        }
        if (status) status.textContent = "Buscando tu ubicación…";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setContributionPoint(position.coords.latitude, position.coords.longitude, "Ubicación del dispositivo");
            },
            (error) => {
                const message = {
                    1: "No diste permiso. Puedes tocar el mapa o escribir coordenadas.",
                    2: "No pudimos determinar la ubicación. Puedes tocar el mapa o escribir coordenadas.",
                    3: "La ubicación tardó demasiado. Puedes tocar el mapa o escribir coordenadas.",
                }[error.code] || "No fue posible obtener la ubicación.";
                if (status) status.textContent = message;
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
        );
    }

    function useMapCenter() {
        ensureContributionMap();
        const center = contributionMap?.getCenter();
        if (center) setContributionPoint(center.lat, center.lng, "Centro del mapa");
    }

    function nudgePoint(deltaLatitude, deltaLongitude) {
        ensureContributionMap();
        const current = validCoordinates() || (() => {
            const center = contributionMap?.getCenter() || window.L.latLng(CHILE_CENTER);
            return { latitude: center.lat, longitude: center.lng };
        })();
        setContributionPoint(
            current.latitude + deltaLatitude,
            current.longitude + deltaLongitude,
            "Punto ajustado con botones",
            false,
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
            button.setAttribute("aria-keyshortcuts", "Escape");
            button.textContent = "Marcar en el mapa";
            button.addEventListener("click", () => pinMode ? cancelPinMode() : enablePinMode());
            toolbarActions.appendChild(button);
        }

        const mainMap = document.getElementById("map");
        const mapPanel = document.getElementById("map-panel");
        if (mainMap && mapPanel && !document.getElementById("map-accessibility-note")) {
            mainMap.setAttribute("role", "region");
            mainMap.setAttribute("aria-describedby", "map-accessibility-note");
            const note = document.createElement("p");
            note.id = "map-accessibility-note";
            note.className = "map-accessibility-note";
            note.textContent = "El mapa es opcional. La lista contiene los mismos estacionamientos y todas las acciones. Para aportar sin arrastrar, usa coordenadas, ubicación del dispositivo, centro del mapa o botones de ajuste.";
            mapPanel.insertBefore(note, mainMap);
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
                    <p>Toca el mapa, escribe coordenadas o usa los controles. Arrastrar es opcional.</p>
                </div>
            </div>
            <div class="geotag-picker__actions">
                <button class="button button--secondary" id="geotag-device-location" type="button">Usar mi ubicación</button>
                <button class="button button--secondary" id="geotag-map-center" type="button">Usar centro del mapa</button>
                <button class="button button--secondary" id="geotag-show-chile" type="button">Ver Chile completo</button>
            </div>
            <div id="contribution-geotag-map" role="region" aria-label="Mapa opcional para marcar la ubicación exacta del estacionamiento"></div>
            <div class="geotag-nudge" aria-label="Ajustar coordenadas sin arrastrar">
                <button type="button" data-nudge="north" aria-label="Mover el punto aproximadamente 11 metros al norte">↑ Norte</button>
                <button type="button" data-nudge="west" aria-label="Mover el punto aproximadamente 9 metros al oeste">← Oeste</button>
                <button type="button" data-nudge="east" aria-label="Mover el punto aproximadamente 9 metros al este">Este →</button>
                <button type="button" data-nudge="south" aria-label="Mover el punto aproximadamente 11 metros al sur">↓ Sur</button>
            </div>
            <p class="geotag-picker__status" id="geotag-picker-status" role="status" aria-live="polite">Todavía no has marcado un punto.</p>
        `;
        coordinateGrid.parentNode.insertBefore(picker, coordinateGrid);
        document.getElementById("geotag-device-location")?.addEventListener("click", useDeviceLocation);
        document.getElementById("geotag-map-center")?.addEventListener("click", useMapCenter);
        document.getElementById("geotag-show-chile")?.addEventListener("click", () => {
            ensureContributionMap();
            contributionMap?.setView(CHILE_CENTER, CHILE_ZOOM);
        });
        document.querySelector('[data-nudge="north"]')?.addEventListener("click", () => nudgePoint(NUDGE_STEP, 0));
        document.querySelector('[data-nudge="south"]')?.addEventListener("click", () => nudgePoint(-NUDGE_STEP, 0));
        document.querySelector('[data-nudge="east"]')?.addEventListener("click", () => nudgePoint(0, NUDGE_STEP));
        document.querySelector('[data-nudge="west"]')?.addEventListener("click", () => nudgePoint(0, -NUDGE_STEP));
    }

    function syncFromCoordinateFields() {
        if (!validateCoordinateFields()) return;
        const point = validCoordinates();
        if (point && contributionMap) {
            moveContributionMarker(point);
            movePendingMainMarker(point);
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
    latitudeInput.addEventListener("input", validateCoordinateFields);
    longitudeInput.addEventListener("input", validateCoordinateFields);
    latitudeInput.addEventListener("change", syncFromCoordinateFields);
    longitudeInput.addEventListener("change", syncFromCoordinateFields);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && pinMode) cancelPinMode();
    });
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
