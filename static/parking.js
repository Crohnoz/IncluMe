(() => {
    "use strict";

    const root = document.getElementById("parking-app");
    if (!root) return;

    const elements = {
        search: document.getElementById("parking-search"),
        locate: document.getElementById("locate-button"),
        status: document.getElementById("parking-status"),
        list: document.getElementById("parking-list"),
        empty: document.getElementById("parking-empty"),
        summary: document.getElementById("results-summary"),
        updateChip: document.getElementById("update-chip"),
        workspace: document.querySelector(".parking-workspace"),
        mapPanel: document.getElementById("map-panel"),
        mapContext: document.getElementById("map-context"),
        preferenceSummary: document.getElementById("preference-summary-text"),
        preferencesDialog: document.getElementById("preferences-dialog"),
        preferencesForm: document.getElementById("preferences-form"),
        detailDialog: document.getElementById("detail-dialog"),
        detailContent: document.getElementById("detail-content"),
        detailTitle: document.getElementById("detail-title"),
        detailStatus: document.getElementById("detail-status"),
        navigationDialog: document.getElementById("navigation-dialog"),
        navigationPlace: document.getElementById("navigation-place-name"),
        rememberProvider: document.getElementById("remember-provider"),
        verifyDialog: document.getElementById("verify-dialog"),
        verifyForm: document.getElementById("verify-form"),
        verifyPlace: document.getElementById("verify-place-name"),
        verifyFeedback: document.getElementById("verify-feedback"),
        contributeDialog: document.getElementById("contribute-dialog"),
        contributeForm: document.getElementById("contribute-form"),
        contributeFeedback: document.getElementById("contribute-feedback"),
    };

    const DEFAULT_PREFERENCES = {
        maxEntranceDistance: 100,
        transferSide: "any",
        stepFreeOnly: true,
        avoidSteepSlope: true,
        largeText: false,
        highContrast: false,
    };

    const state = {
        parkings: [],
        visible: [],
        selected: null,
        navigationParking: null,
        verificationParking: null,
        userLocation: null,
        priority: "effort",
        view: window.matchMedia("(max-width: 960px)").matches ? "list" : "split",
        preferences: loadPreferences(),
        map: null,
        markerLayer: null,
        markers: new Map(),
        userMarker: null,
    };

    function safeStorageGet(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (_error) {
            return null;
        }
    }

    function safeStorageSet(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (_error) {
            // The product remains usable when storage is blocked.
        }
    }

    function safeStorageRemove(key) {
        try {
            window.localStorage.removeItem(key);
        } catch (_error) {
            // No-op.
        }
    }

    function loadPreferences() {
        const stored = safeStorageGet("inclume.accessibility.preferences");
        if (!stored) return { ...DEFAULT_PREFERENCES };
        try {
            return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
        } catch (_error) {
            return { ...DEFAULT_PREFERENCES };
        }
    }

    function applyDisplayPreferences() {
        document.body.dataset.textScale = state.preferences.largeText ? "large" : "standard";
        document.body.dataset.highContrast = state.preferences.highContrast ? "true" : "false";
    }

    function createElement(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function append(parent, ...children) {
        children.filter(Boolean).forEach((child) => parent.appendChild(child));
        return parent;
    }

    function getCsrfToken() {
        const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : "";
    }

    async function requestJson(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-CSRFToken": getCsrfToken(),
                ...(options.headers || {}),
            },
            ...options,
        });
        let payload = {};
        try {
            payload = await response.json();
        } catch (_error) {
            payload = { message: "La respuesta del servidor no pudo interpretarse." };
        }
        if (!response.ok) {
            const error = new Error(payload.message || "No pudimos completar la solicitud.");
            error.payload = payload;
            error.status = response.status;
            throw error;
        }
        return payload;
    }

    function setStatus(message) {
        elements.status.textContent = message;
    }

    function formatRelativeDate(value) {
        if (!value) return "Sin verificación reciente";
        const timestamp = new Date(value).getTime();
        const difference = Date.now() - timestamp;
        const minutes = Math.max(0, Math.round(difference / 60000));
        if (minutes < 60) return `Verificado hace ${minutes || 1} min`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `Verificado hace ${hours} h`;
        const days = Math.round(hours / 24);
        if (days < 31) return `Verificado hace ${days} ${days === 1 ? "día" : "días"}`;
        return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(value));
    }

    function haversineKm(origin, destination) {
        if (!origin || !destination) return null;
        const earthRadiusKm = 6371;
        const toRadians = (degrees) => (degrees * Math.PI) / 180;
        const deltaLatitude = toRadians(destination.latitude - origin.latitude);
        const deltaLongitude = toRadians(destination.longitude - origin.longitude);
        const latitudeA = toRadians(origin.latitude);
        const latitudeB = toRadians(destination.latitude);
        const a =
            Math.sin(deltaLatitude / 2) ** 2 +
            Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;
        return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function compatibility(parking) {
        const preferences = state.preferences;
        const maxDistance = Number(preferences.maxEntranceDistance || 0);
        const entranceDistance = parking.distance_to_entrance_m;

        if (maxDistance > 0 && entranceDistance !== null && entranceDistance > maxDistance) {
            return false;
        }
        if (preferences.stepFreeOnly && parking.has_step_free_route === false) {
            return false;
        }
        if (preferences.avoidSteepSlope && parking.surface_type === "steep_slope") {
            return false;
        }
        if (preferences.transferSide !== "any") {
            const side = parking.transfer_side;
            if (side !== "unknown" && side !== "both" && side !== preferences.transferSide) {
                return false;
            }
            if (preferences.transferSide === "both" && side !== "unknown" && side !== "both") {
                return false;
            }
        }
        return true;
    }

    function trustScore(parking) {
        let score = 0;
        if (parking.status === "verified") score += 45;
        if (parking.trust_level === "community") score += 25;
        if (parking.verification_freshness === "fresh") score += 20;
        if (parking.verification_freshness === "aging") score += 8;
        score += Math.min(Number(parking.verification_count || 0), 10) * 2;
        if (parking.status === "unavailable") score -= 80;
        return score;
    }

    function effortScore(parking) {
        let score = 100;
        if (parking.distance_to_entrance_m !== null) {
            score -= Math.min(parking.distance_to_entrance_m, 500) / 5;
        } else {
            score -= 20;
        }
        if (parking.has_step_free_route === true) score += 18;
        if (parking.has_transfer_space === true) score += 14;
        if (parking.surface_type === "level") score += 10;
        if (parking.surface_type === "irregular") score -= 15;
        if (parking.transfer_side === state.preferences.transferSide) score += 8;
        if (parking.transfer_side === "unknown") score -= 4;
        const distanceKm = parking.distance_km;
        if (distanceKm !== null) score -= Math.min(distanceKm, 25) * 2;
        return score;
    }

    function sortValue(parking) {
        if (state.priority === "trust") return trustScore(parking) * -1;
        if (state.priority === "distance") {
            return parking.distance_km === null ? Number.POSITIVE_INFINITY : parking.distance_km;
        }
        return (effortScore(parking) + trustScore(parking) * 0.35) * -1;
    }

    function filteredParkings() {
        const query = elements.search.value.trim().toLocaleLowerCase("es-CL");
        return state.parkings
            .map((parking) => ({
                ...parking,
                distance_km: haversineKm(state.userLocation, {
                    latitude: parking.latitude,
                    longitude: parking.longitude,
                }),
            }))
            .filter((parking) => {
                const matchesQuery =
                    !query ||
                    `${parking.name} ${parking.location} ${parking.place_type_label}`
                        .toLocaleLowerCase("es-CL")
                        .includes(query);
                return matchesQuery && compatibility(parking);
            })
            .sort((a, b) => sortValue(a) - sortValue(b));
    }

    function preferenceSummary() {
        const items = [];
        const maxDistance = Number(state.preferences.maxEntranceDistance || 0);
        items.push(maxDistance ? `máximo ${maxDistance} m a la entrada` : "sin límite de distancia a la entrada");
        if (state.preferences.transferSide !== "any") {
            const label = {
                right: "transferencia derecha",
                left: "transferencia izquierda",
                both: "transferencia por ambos lados",
            }[state.preferences.transferSide];
            items.push(label);
        }
        if (state.preferences.stepFreeOnly) items.push("ruta sin escalones");
        if (state.preferences.avoidSteepSlope) items.push("evitar pendientes pronunciadas");
        return items.join(" · ");
    }

    function trustLabel(parking) {
        if (parking.status === "unavailable") return "Disponibilidad cuestionada";
        if (parking.trust_level === "community") return "Confirmado por la comunidad";
        if (parking.status === "verified") return "Verificado";
        return "Dato nuevo";
    }

    function renderFeatureChips(parking) {
        const container = createElement("div", "parking-card__features");
        const featureLabels = [...parking.features];
        if (parking.transfer_side && parking.transfer_side !== "unknown") {
            featureLabels.unshift(parking.transfer_side_label);
        }
        if (parking.distance_to_entrance_m !== null) {
            featureLabels.unshift(`${parking.distance_to_entrance_m} m a la entrada`);
        }
        featureLabels.slice(0, 5).forEach((feature) => {
            container.appendChild(createElement("span", "feature-chip", feature));
        });
        return container;
    }

    function renderTrustPanel(parking) {
        const panel = createElement("div", "parking-card__trust");
        const verification = createElement("strong", "", formatRelativeDate(parking.last_verified_at));
        const reports = createElement(
            "span",
            "",
            `${parking.verification_count || 0} ${parking.verification_count === 1 ? "confirmación" : "confirmaciones"}`,
        );
        const disclaimer = createElement("small", "", "La disponibilidad no está garantizada en tiempo real.");
        append(panel, verification, reports, disclaimer);
        return panel;
    }

    function actionButton(label, className, handler) {
        const button = createElement("button", `button ${className}`, label);
        button.type = "button";
        button.addEventListener("click", handler);
        return button;
    }

    function renderParkingCard(parking, index) {
        const item = createElement("li", `parking-card${index === 0 ? " is-best" : ""}`);
        item.dataset.parkingId = String(parking.id);

        const topline = createElement("div", "parking-card__topline");
        if (index === 0) topline.appendChild(createElement("span", "status-chip status-chip--success", "Mejor opción"));
        topline.appendChild(createElement("span", "status-chip", trustLabel(parking)));

        const title = createElement("h3", "", parking.name);
        const address = createElement("p", "parking-card__address", parking.location);
        const meta = createElement("div", "parking-card__meta");
        if (parking.distance_km !== null) {
            meta.appendChild(createElement("span", "feature-chip", `${parking.distance_km.toFixed(1)} km desde ti`));
        }
        meta.appendChild(createElement("span", "feature-chip", parking.place_type_label));

        const actions = createElement("div", "parking-card__actions");
        append(
            actions,
            actionButton("Ver detalles", "button--secondary", () => openDetails(parking)),
            actionButton("Cómo llegar", "button--primary", () => beginNavigation(parking)),
            actionButton("Verificar", "button--secondary", () => openVerification(parking)),
        );

        append(item, topline, title, address, meta, renderTrustPanel(parking), renderFeatureChips(parking), actions);
        item.addEventListener("mouseenter", () => selectParking(parking, false));
        item.addEventListener("focusin", () => selectParking(parking, false));
        return item;
    }

    function renderPlanB(parking) {
        const item = createElement("li", "plan-b-card");
        const title = createElement("strong", "", "Plan B compatible");
        const descriptionParts = [parking.name];
        if (parking.distance_km !== null) descriptionParts.push(`${parking.distance_km.toFixed(1)} km desde ti`);
        const description = createElement("p", "", descriptionParts.join(" · "));
        const actions = createElement("div", "parking-card__actions");
        append(
            actions,
            actionButton("Revisar alternativa", "button--secondary", () => openDetails(parking)),
            actionButton("Cómo llegar", "button--primary", () => beginNavigation(parking)),
        );
        append(item, title, description, actions);
        return item;
    }

    function renderList() {
        state.visible = filteredParkings();
        elements.list.replaceChildren();
        elements.empty.hidden = state.visible.length > 0;
        elements.summary.textContent = `${state.visible.length} ${state.visible.length === 1 ? "opción compatible" : "opciones compatibles"}`;

        state.visible.forEach((parking, index) => {
            if (index === 1) {
                elements.list.appendChild(renderPlanB(parking));
            } else {
                elements.list.appendChild(renderParkingCard(parking, index));
            }
        });

        renderMarkers();
        if (state.visible.length > 0 && !state.selected) selectParking(state.visible[0], false);
        if (state.visible.length === 0) state.selected = null;
    }

    function createPopup(parking) {
        const container = createElement("div", "inclume-popup");
        const title = createElement("h3", "", parking.name);
        const address = createElement("p", "", parking.location);
        const details = actionButton("Ver detalles", "button--secondary", () => openDetails(parking));
        details.style.width = "100%";
        append(container, title, address, details);
        return container;
    }

    function markerIcon(parking, index) {
        const classNames = ["inclume-marker"];
        if (index === 0) classNames.push("inclume-marker--best");
        if (parking.status === "unavailable") classNames.push("inclume-marker--warning");
        return window.L.divIcon({
            className: "",
            html: `<span class="${classNames.join(" ")}" aria-hidden="true">${index + 1}</span>`,
            iconSize: [42, 42],
            iconAnchor: [21, 21],
        });
    }

    function renderMarkers() {
        if (!state.map || !state.markerLayer) return;
        state.markerLayer.clearLayers();
        state.markers.clear();
        const bounds = [];
        state.visible.forEach((parking, index) => {
            const coordinates = [parking.latitude, parking.longitude];
            const marker = window.L.marker(coordinates, { icon: markerIcon(parking, index) });
            marker.bindPopup(createPopup(parking));
            marker.on("click", () => selectParking(parking, false));
            marker.addTo(state.markerLayer);
            state.markers.set(parking.id, marker);
            bounds.push(coordinates);
        });
        if (state.userLocation) bounds.push([state.userLocation.latitude, state.userLocation.longitude]);
        if (bounds.length > 1) state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        else if (bounds.length === 1) state.map.setView(bounds[0], 16);
    }

    function selectParking(parking, openPopup = true) {
        state.selected = parking;
        document.querySelectorAll(".parking-card").forEach((card) => {
            card.classList.toggle("is-selected", card.dataset.parkingId === String(parking.id));
        });
        elements.mapContext.innerHTML = "";
        append(
            elements.mapContext,
            createElement("strong", "", parking.name),
            createElement(
                "span",
                "",
                parking.distance_to_entrance_m !== null
                    ? `${parking.distance_to_entrance_m} m hasta la entrada accesible`
                    : "Distancia a la entrada todavía no informada",
            ),
        );
        const marker = state.markers.get(parking.id);
        if (marker && openPopup) marker.openPopup();
    }

    function initMap() {
        if (!window.L) {
            elements.mapPanel.classList.add("map-unavailable");
            elements.mapContext.innerHTML = "<strong>Mapa no disponible</strong><span>La lista sigue funcionando y contiene las coordenadas de navegación.</span>";
            return;
        }
        state.map = window.L.map("map", {
            scrollWheelZoom: false,
            zoomControl: true,
        }).setView([-33.4489, -70.6693], 12);
        window.L.tileLayer(root.dataset.tileUrl, {
            maxZoom: 19,
            attribution: root.dataset.tileAttribution,
        }).addTo(state.map);
        state.markerLayer = window.L.layerGroup().addTo(state.map);
    }

    function setView(view) {
        state.view = view;
        elements.workspace.dataset.currentView = view;
        document.querySelectorAll("[data-view]").forEach((button) => {
            const active = button.dataset.view === view;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", String(active));
        });
        if ((view === "map" || view === "split") && state.map) {
            window.setTimeout(() => state.map.invalidateSize(), 20);
        }
    }

    function openDialog(dialog) {
        if (!dialog) return;
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
    }

    function closeDialog(dialog) {
        if (!dialog) return;
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
    }

    function detailMetric(label, value) {
        const metric = createElement("div", "detail-metric");
        append(metric, createElement("span", "", label), createElement("strong", "", value || "No informado"));
        return metric;
    }

    function openDetails(parking) {
        state.selected = parking;
        elements.detailTitle.textContent = parking.name;
        elements.detailStatus.textContent = trustLabel(parking);
        elements.detailContent.replaceChildren();

        const grid = createElement("div", "detail-grid");
        append(
            grid,
            detailMetric("Ubicación", parking.location),
            detailMetric("Entrada accesible", parking.distance_to_entrance_m !== null ? `${parking.distance_to_entrance_m} metros` : null),
            detailMetric("Transferencia", parking.transfer_side_label),
            detailMetric("Superficie", parking.surface_type_label),
            detailMetric("Horario", parking.schedule_info || null),
            detailMetric("Costo", parking.cost_info || null),
        );
        elements.detailContent.appendChild(grid);

        if (parking.vehicle_access_notes) {
            const section = createElement("section", "detail-section");
            append(section, createElement("h3", "", "Cómo ingresar en vehículo"), createElement("p", "", parking.vehicle_access_notes));
            elements.detailContent.appendChild(section);
        }
        if (parking.accessible_entrance_notes) {
            const section = createElement("section", "detail-section");
            append(section, createElement("h3", "", "Ruta hasta la entrada accesible"), createElement("p", "", parking.accessible_entrance_notes));
            elements.detailContent.appendChild(section);
        }
        if (parking.accessibility_info) {
            const section = createElement("section", "detail-section");
            append(section, createElement("h3", "", "Información adicional"), createElement("p", "", parking.accessibility_info));
            elements.detailContent.appendChild(section);
        }

        const actions = createElement("div", "detail-actions");
        append(
            actions,
            actionButton("Cómo llegar", "button--primary", () => beginNavigation(parking)),
            actionButton("Verificar lugar", "button--secondary", () => openVerification(parking)),
            actionButton("Ver en mapa", "button--secondary", () => {
                closeDialog(elements.detailDialog);
                setView("map");
                selectParking(parking, true);
                state.map?.setView([parking.latitude, parking.longitude], 17);
            }),
        );
        elements.detailContent.appendChild(actions);
        openDialog(elements.detailDialog);
    }

    function providerUrl(parking, provider) {
        const latitude = parking.latitude;
        const longitude = parking.longitude;
        const destination = `${latitude},${longitude}`;
        const label = encodeURIComponent(parking.name);
        if (provider === "waze") return `https://www.waze.com/ul?ll=${destination}&navigate=yes`;
        if (provider === "apple") return `https://maps.apple.com/?daddr=${destination}&dirflg=d`;
        if (provider === "google") return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
        if (/Android/i.test(navigator.userAgent)) return `geo:${destination}?q=${destination}(${label})`;
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return `https://maps.apple.com/?daddr=${destination}&dirflg=d`;
        return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    }

    function openProvider(parking, provider) {
        if (elements.rememberProvider.checked) safeStorageSet("inclume.navigation.provider", provider);
        closeDialog(elements.navigationDialog);
        window.location.assign(providerUrl(parking, provider));
    }

    function beginNavigation(parking) {
        closeDialog(elements.detailDialog);
        const remembered = safeStorageGet("inclume.navigation.provider");
        if (remembered) {
            window.location.assign(providerUrl(parking, remembered));
            return;
        }
        state.navigationParking = parking;
        elements.navigationPlace.textContent = `${parking.name} · ${parking.location}`;
        elements.rememberProvider.checked = false;
        openDialog(elements.navigationDialog);
    }

    function openPreferences() {
        const form = elements.preferencesForm;
        form.elements.maxEntranceDistance.value = String(state.preferences.maxEntranceDistance);
        form.elements.transferSide.value = state.preferences.transferSide;
        form.elements.stepFreeOnly.checked = state.preferences.stepFreeOnly;
        form.elements.avoidSteepSlope.checked = state.preferences.avoidSteepSlope;
        form.elements.largeText.checked = state.preferences.largeText;
        form.elements.highContrast.checked = state.preferences.highContrast;
        openDialog(elements.preferencesDialog);
    }

    function savePreferences(event) {
        event.preventDefault();
        const form = elements.preferencesForm;
        state.preferences = {
            maxEntranceDistance: Number(form.elements.maxEntranceDistance.value),
            transferSide: form.elements.transferSide.value,
            stepFreeOnly: form.elements.stepFreeOnly.checked,
            avoidSteepSlope: form.elements.avoidSteepSlope.checked,
            largeText: form.elements.largeText.checked,
            highContrast: form.elements.highContrast.checked,
        };
        safeStorageSet("inclume.accessibility.preferences", JSON.stringify(state.preferences));
        applyDisplayPreferences();
        elements.preferenceSummary.textContent = preferenceSummary();
        closeDialog(elements.preferencesDialog);
        renderList();
        setStatus("Preferencias guardadas y resultados actualizados.");
    }

    function openVerification(parking) {
        closeDialog(elements.detailDialog);
        state.verificationParking = parking;
        elements.verifyForm.reset();
        elements.verifyFeedback.textContent = "";
        elements.verifyFeedback.className = "form-feedback";
        elements.verifyPlace.textContent = `${parking.name} · ${parking.location}`;
        openDialog(elements.verifyDialog);
    }

    function formObject(form) {
        const payload = {};
        new FormData(form).forEach((value, key) => {
            payload[key] = value;
        });
        return payload;
    }

    function booleanOrNull(value) {
        if (value === "true") return true;
        if (value === "false") return false;
        return null;
    }

    async function submitVerification(event) {
        event.preventDefault();
        const parking = state.verificationParking;
        if (!parking) return;
        const payload = formObject(elements.verifyForm);
        payload.is_available = booleanOrNull(payload.is_available);
        payload.accessibility_confirmed = booleanOrNull(payload.accessibility_confirmed);
        payload.transfer_space_clear = booleanOrNull(payload.transfer_space_clear);
        payload.step_free_route_clear = booleanOrNull(payload.step_free_route_clear);
        payload.official_signage_visible = booleanOrNull(payload.official_signage_visible);
        elements.verifyFeedback.textContent = "Enviando verificación…";
        try {
            const url = root.dataset.verifyUrlTemplate.replace("/0/", `/${parking.id}/`);
            const response = await requestJson(url, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            const index = state.parkings.findIndex((item) => item.id === parking.id);
            if (index >= 0) state.parkings[index] = response.parking;
            elements.verifyFeedback.textContent = response.message;
            elements.verifyFeedback.className = "form-feedback is-success";
            renderList();
            window.setTimeout(() => closeDialog(elements.verifyDialog), 1000);
        } catch (error) {
            elements.verifyFeedback.textContent = error.message;
            elements.verifyFeedback.className = "form-feedback is-error";
        }
    }

    function contributionPayload(form) {
        const payload = formObject(form);
        const nullableBooleans = [
            "has_official_signage",
            "has_transfer_space",
            "has_level_surface",
            "has_curb_ramp",
            "has_step_free_route",
            "is_well_lit",
            "is_covered",
        ];
        nullableBooleans.forEach((name) => {
            payload[name] = form.elements[name].checked ? true : null;
        });
        ["latitude", "longitude", "distance_to_entrance_m"].forEach((name) => {
            if (payload[name] === "") payload[name] = null;
        });
        return payload;
    }

    async function submitContribution(event) {
        event.preventDefault();
        elements.contributeFeedback.textContent = "Enviando aporte para revisión…";
        elements.contributeFeedback.className = "form-feedback";
        try {
            const response = await requestJson(root.dataset.submitUrl, {
                method: "POST",
                body: JSON.stringify(contributionPayload(elements.contributeForm)),
            });
            elements.contributeFeedback.textContent = response.message;
            elements.contributeFeedback.className = "form-feedback is-success";
            elements.contributeForm.reset();
        } catch (error) {
            const firstError = error.payload?.errors
                ? Object.values(error.payload.errors).flat()[0]
                : null;
            elements.contributeFeedback.textContent = firstError || error.message;
            elements.contributeFeedback.className = "form-feedback is-error";
        }
    }

    function useLocation(callback) {
        if (!navigator.geolocation) {
            setStatus("Este dispositivo no permite obtener la ubicación.");
            return;
        }
        setStatus("Buscando tu ubicación…");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };
                callback(location);
            },
            (error) => {
                const messages = {
                    1: "No diste permiso para usar la ubicación. Puedes buscar manualmente.",
                    2: "El dispositivo no pudo determinar la ubicación.",
                    3: "La búsqueda de ubicación tardó demasiado.",
                };
                setStatus(messages[error.code] || "No fue posible obtener tu ubicación.");
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
        );
    }

    function locateUser() {
        useLocation((location) => {
            state.userLocation = location;
            if (state.map) {
                if (state.userMarker) state.userMarker.remove();
                state.userMarker = window.L.circleMarker([location.latitude, location.longitude], {
                    radius: 9,
                    weight: 4,
                    color: "#ffffff",
                    fillColor: "#6f50c9",
                    fillOpacity: 1,
                }).addTo(state.map).bindPopup("Tu ubicación aproximada");
            }
            renderList();
            setStatus("Ubicación encontrada. Ordenamos las opciones según tus preferencias.");
        });
    }

    function useLocationForContribution() {
        useLocation((location) => {
            elements.contributeForm.elements.latitude.value = location.latitude.toFixed(6);
            elements.contributeForm.elements.longitude.value = location.longitude.toFixed(6);
            elements.contributeFeedback.textContent = "Ubicación agregada al aporte. Puedes ajustarla antes de enviar.";
            elements.contributeFeedback.className = "form-feedback is-success";
        });
    }

    async function loadParkings() {
        try {
            const response = await requestJson(root.dataset.apiUrl, { method: "GET", headers: { "Content-Type": "application/json" } });
            state.parkings = response.parkings;
            elements.updateChip.textContent = "Actualizado ahora";
            elements.preferenceSummary.textContent = preferenceSummary();
            renderList();
            setStatus(`${response.count} estacionamientos publicados. Aplica filtros para encontrar el más útil.`);
        } catch (error) {
            elements.empty.hidden = false;
            elements.empty.querySelector("h3").textContent = "No pudimos cargar los estacionamientos";
            elements.empty.querySelector("p").textContent = error.message;
            setStatus("La información no está disponible en este momento.");
        }
    }

    function bindEvents() {
        elements.search.addEventListener("input", renderList);
        elements.locate.addEventListener("click", locateUser);
        document.querySelectorAll('input[name="priority"]').forEach((input) => {
            input.addEventListener("change", () => {
                state.priority = input.value;
                renderList();
            });
        });
        document.querySelectorAll("[data-view]").forEach((button) => {
            button.addEventListener("click", () => setView(button.dataset.view));
        });
        [
            "preferences-button",
            "edit-preferences-button",
            "empty-preferences-button",
        ].forEach((id) => document.getElementById(id)?.addEventListener("click", openPreferences));
        document.getElementById("contribute-button")?.addEventListener("click", () => openDialog(elements.contributeDialog));
        document.getElementById("use-location-for-contribution")?.addEventListener("click", useLocationForContribution);
        elements.preferencesForm.addEventListener("submit", savePreferences);
        document.getElementById("reset-preferences")?.addEventListener("click", () => {
            state.preferences = { ...DEFAULT_PREFERENCES };
            safeStorageRemove("inclume.accessibility.preferences");
            applyDisplayPreferences();
            openPreferences();
        });
        elements.verifyForm.addEventListener("submit", submitVerification);
        elements.contributeForm.addEventListener("submit", submitContribution);
        document.querySelectorAll("[data-close-dialog]").forEach((button) => {
            button.addEventListener("click", () => closeDialog(button.closest("dialog")));
        });
        document.querySelectorAll(".provider-button").forEach((button) => {
            button.addEventListener("click", () => {
                if (state.navigationParking) openProvider(state.navigationParking, button.dataset.provider);
            });
        });
        document.querySelectorAll("dialog").forEach((dialog) => {
            dialog.addEventListener("click", (event) => {
                const rect = dialog.getBoundingClientRect();
                const outside =
                    event.clientX < rect.left || event.clientX > rect.right ||
                    event.clientY < rect.top || event.clientY > rect.bottom;
                if (outside) closeDialog(dialog);
            });
        });
    }

    applyDisplayPreferences();
    initMap();
    bindEvents();
    setView(state.view);
    loadParkings();

    if (window.location.hash === "#aportar") {
        window.setTimeout(() => openDialog(elements.contributeDialog), 150);
    }
})();
