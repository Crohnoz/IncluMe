(() => {
  "use strict";

  const STORAGE_KEY = "inclume.preview.chile.points.v4";
  const PREFERENCES_KEY = "inclume.preview.preferences.v4";
  const CHILE = { latMin: -58, latMax: -15, lngMin: -112, lngMax: -64 };
  const NUDGE_STEP = 0.0001;
  const DEFAULT_PREFERENCES = {
    textScale: "standard",
    highContrast: false,
    reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    mapStyle: "vivid",
    spacing: "standard",
  };

  const demoPoints = [
    {
      id: "demo-santiago",
      name: "Punto demo — Santiago Centro",
      location: "Referencia ficticia para probar la interfaz",
      latitude: -33.4489,
      longitude: -70.6693,
      transferSide: "right",
      stepFree: "yes",
      notes: "Ejemplo no verificado. En producción este registro requeriría moderación y evidencia.",
      pending: false,
      demo: true,
    },
    {
      id: "demo-valparaiso",
      name: "Punto demo — Valparaíso",
      location: "Referencia ficticia cerca del centro",
      latitude: -33.0472,
      longitude: -71.6127,
      transferSide: "unknown",
      stepFree: "unknown",
      notes: "Ejemplo no verificado para comprobar el mapa de Chile.",
      pending: false,
      demo: true,
    },
    {
      id: "demo-concepcion",
      name: "Punto demo — Concepción",
      location: "Referencia ficticia de acceso norte",
      latitude: -36.8201,
      longitude: -73.0444,
      transferSide: "both",
      stepFree: "yes",
      notes: "Ejemplo no verificado. Los datos reales deben describir condiciones observables.",
      pending: false,
      demo: true,
    },
    {
      id: "demo-temuco",
      name: "Punto demo — Temuco",
      location: "Referencia ficticia para probar geolocalización",
      latitude: -38.7359,
      longitude: -72.5904,
      transferSide: "left",
      stepFree: "yes",
      notes: "Ejemplo no verificado para evaluar lista, mapa y navegación.",
      pending: false,
      demo: true,
    },
    {
      id: "demo-puerto-montt",
      name: "Punto demo — Puerto Montt",
      location: "Referencia ficticia junto a una entrada accesible",
      latitude: -41.4693,
      longitude: -72.9424,
      transferSide: "right",
      stepFree: "unknown",
      notes: "Ejemplo no verificado. No debe utilizarse para tomar una decisión real.",
      pending: false,
      demo: true,
    },
  ];

  const elements = {
    map: document.getElementById("map"),
    mapHelp: document.getElementById("map-help"),
    search: document.getElementById("search"),
    locate: document.getElementById("locate"),
    pinMode: document.getElementById("pin-mode"),
    showChile: document.getElementById("show-chile"),
    status: document.getElementById("live-status"),
    list: document.getElementById("parking-list"),
    count: document.getElementById("result-count"),
    empty: document.getElementById("empty-state"),
    workspace: document.getElementById("workspace"),
    formDialog: document.getElementById("parking-dialog"),
    form: document.getElementById("parking-form"),
    latitude: document.getElementById("point-latitude"),
    longitude: document.getElementById("point-longitude"),
    coordinateSummary: document.getElementById("dialog-coordinates"),
    coordinateError: document.getElementById("coordinate-error"),
    detailDialog: document.getElementById("detail-dialog"),
    detailTitle: document.getElementById("detail-title"),
    detailStatus: document.getElementById("detail-status"),
    detailBody: document.getElementById("detail-body"),
    accessibilityDialog: document.getElementById("accessibility-dialog"),
    accessibilityForm: document.getElementById("accessibility-form"),
    accessibilityOpen: document.getElementById("accessibility-open"),
    accessibilityReset: document.getElementById("accessibility-reset"),
    toast: document.getElementById("toast"),
  };

  const state = {
    localPoints: readJson(STORAGE_KEY, []),
    preferences: readJson(PREFERENCES_KEY, DEFAULT_PREFERENCES),
    visible: [],
    markers: new Map(),
    selectedId: null,
    pinMode: false,
    pendingCoordinates: null,
    userMarker: null,
    map: null,
    markerLayer: null,
    lastFocusedElement: null,
  };

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      if (value === null) return Array.isArray(fallback) ? [...fallback] : { ...fallback };
      return value;
    } catch (_error) {
      return Array.isArray(fallback) ? [...fallback] : { ...fallback };
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function allPoints() {
    return [...state.localPoints, ...demoPoints];
  }

  function insideChile(latitude, longitude) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    return Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= CHILE.latMin && lat <= CHILE.latMax
      && lng >= CHILE.lngMin && lng <= CHILE.lngMax;
  }

  function motionAllowed() {
    return !state.preferences.reduceMotion;
  }

  function setStatus(message) {
    elements.status.textContent = message;
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function createButton(label, className, handler) {
    const button = createElement("button", `button ${className}`, label);
    button.type = "button";
    button.addEventListener("click", handler);
    return button;
  }

  function transferLabel(value) {
    return {
      right: "Transferencia derecha",
      left: "Transferencia izquierda",
      both: "Transferencia por ambos lados",
      unknown: "Transferencia no informada",
    }[value] || "Transferencia no informada";
  }

  function routeLabel(value) {
    return {
      yes: "Ruta sin escalones",
      no: "Ruta con escalones u obstáculo",
      unknown: "Ruta no informada",
    }[value] || "Ruta no informada";
  }

  function markerIcon(point, index) {
    const className = point.pending ? "map-pin map-pin--pending" : "map-pin";
    const label = point.pending ? "P" : String(index + 1);
    return window.L.divIcon({
      className: "",
      html: `<span class="${className}" aria-hidden="true"><span>${label}</span></span>`,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  }

  function userIcon() {
    return window.L.divIcon({
      className: "",
      html: '<span class="map-pin map-pin--user" aria-hidden="true"><span>Tú</span></span>',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  }

  function popupContent(point) {
    const container = createElement("div", "popup-content");
    container.append(
      createElement("strong", "", point.name),
      document.createElement("br"),
      createElement("span", "", point.location),
    );
    return container;
  }

  function initialiseMap() {
    if (!window.L || !elements.map) {
      setStatus("El mapa no pudo cargarse. La lista continúa disponible.");
      return;
    }
    state.map = window.L.map(elements.map, {
      scrollWheelZoom: false,
      zoomControl: true,
      preferCanvas: true,
    });
    state.map.setMaxBounds(window.L.latLngBounds([[-58, -112], [-15, -64]]));
    state.map.options.maxBoundsViscosity = 0.55;
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(state.map);
    state.markerLayer = window.L.layerGroup().addTo(state.map);
    state.map.on("click", (event) => {
      if (!state.pinMode) return;
      cancelPinMode("Punto marcado. Completa la información del estacionamiento.");
      startPointForm(event.latlng.lat, event.latlng.lng);
    });
    showChile();
  }

  function showChile() {
    if (!state.map || !window.L) return;
    state.map.fitBounds(window.L.latLngBounds([[-56.5, -76.5], [-17, -66]]), {
      padding: [28, 28],
      animate: motionAllowed(),
    });
  }

  function render() {
    const query = elements.search.value.trim().toLocaleLowerCase("es-CL");
    state.visible = allPoints().filter((point) => {
      if (!query) return true;
      return `${point.name} ${point.location} ${point.notes}`.toLocaleLowerCase("es-CL").includes(query);
    });

    elements.list.replaceChildren();
    state.markerLayer?.clearLayers();
    state.markers.clear();
    elements.empty.hidden = state.visible.length > 0;
    elements.count.textContent = `${state.visible.length} ${state.visible.length === 1 ? "punto mostrado" : "puntos mostrados"}`;

    state.visible.forEach((point, index) => {
      if (state.markerLayer && window.L) {
        const marker = window.L.marker([point.latitude, point.longitude], {
          icon: markerIcon(point, index),
          keyboard: true,
          title: point.name,
          alt: point.name,
        }).addTo(state.markerLayer);
        marker.bindPopup(popupContent(point));
        marker.on("click", () => selectPoint(point, false));
        state.markers.set(point.id, marker);
      }

      const item = createElement("li", `parking-card${state.selectedId === point.id ? " is-selected" : ""}`);
      item.style.setProperty("--index", index);
      item.dataset.id = point.id;

      const badges = createElement("div", "card-row");
      const statusBadge = createElement(
        "span",
        `badge${point.pending ? " badge--pending" : point.demo ? " badge--warning" : ""}`,
        point.pending ? "Pendiente local" : point.demo ? "Dato demo no verificado" : "Comunitario",
      );
      badges.appendChild(statusBadge);

      const title = createElement("h3", "", point.name);
      const location = createElement("p", "", point.location);
      const features = createElement("div", "feature-list");
      [transferLabel(point.transferSide), routeLabel(point.stepFree)].forEach((label) => {
        features.appendChild(createElement("span", "badge", label));
      });

      const actions = createElement("div", "card-actions");
      actions.append(
        createButton("Ver detalle", "button--secondary", () => openDetails(point)),
        createButton("Ver en mapa", "button--quiet", () => focusPoint(point)),
        createButton("Cómo llegar", "button--primary", () => openNavigation(point, "google")),
      );

      item.append(badges, title, location, features, actions);
      item.addEventListener("mouseenter", () => selectPoint(point, false));
      item.addEventListener("focusin", () => selectPoint(point, false));
      elements.list.appendChild(item);
    });
  }

  function selectPoint(point, openPopup = true) {
    state.selectedId = point.id;
    document.querySelectorAll(".parking-card").forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.id === point.id);
    });
    const marker = state.markers.get(point.id);
    if (marker && openPopup) marker.openPopup();
    elements.mapHelp.replaceChildren(
      createElement("strong", "", point.name),
      createElement("span", "", point.location),
    );
  }

  function focusPoint(point) {
    setMobileView("map");
    state.map?.setView([point.latitude, point.longitude], 17, { animate: motionAllowed() });
    selectPoint(point, true);
  }

  function openNavigation(point, provider) {
    const destination = `${point.latitude},${point.longitude}`;
    const url = provider === "waze"
      ? `https://www.waze.com/ul?ll=${destination}&navigate=yes`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function detailItem(label, value) {
    const item = createElement("div", "detail-item");
    item.append(createElement("span", "", label), createElement("strong", "", value));
    return item;
  }

  function openDetails(point) {
    elements.detailTitle.textContent = point.name;
    elements.detailStatus.textContent = point.pending ? "Pendiente local" : "Dato demo no verificado";
    elements.detailBody.replaceChildren();

    const grid = createElement("div", "detail-grid");
    grid.append(
      detailItem("Referencia", point.location),
      detailItem("Geotag", `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`),
      detailItem("Transferencia", transferLabel(point.transferSide)),
      detailItem("Ruta", routeLabel(point.stepFree)),
    );

    const notes = createElement("section", "detail-notes");
    notes.append(
      createElement("h3", "", "Observación"),
      createElement("p", "", point.notes || "Sin observación adicional."),
    );

    const actions = createElement("div", "sheet__actions");
    actions.append(
      createButton("Google Maps", "button--primary", () => openNavigation(point, "google")),
      createButton("Waze", "button--secondary", () => openNavigation(point, "waze")),
      createButton("Ver en el mapa", "button--quiet", () => {
        closeDialog(elements.detailDialog);
        focusPoint(point);
      }),
    );
    if (point.pending) {
      actions.append(createButton("Eliminar punto local", "button--quiet", () => removeLocalPoint(point.id)));
    }

    elements.detailBody.append(grid, notes, actions);
    openDialog(elements.detailDialog);
  }

  function removeLocalPoint(id) {
    state.localPoints = state.localPoints.filter((point) => point.id !== id);
    writeJson(STORAGE_KEY, state.localPoints);
    closeDialog(elements.detailDialog);
    state.selectedId = null;
    render();
    showToast("Punto local eliminado.");
  }

  function openDialog(dialog) {
    state.lastFocusedElement = document.activeElement;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    state.lastFocusedElement?.focus?.();
  }

  function cancelPinMode(message = "Modo geotag cancelado.") {
    state.pinMode = false;
    elements.pinMode.setAttribute("aria-pressed", "false");
    elements.map.classList.remove("is-pin-mode");
    setStatus(message);
  }

  function activatePinMode() {
    if (state.pinMode) {
      cancelPinMode();
      return;
    }
    state.pinMode = true;
    elements.pinMode.setAttribute("aria-pressed", "true");
    elements.map.classList.add("is-pin-mode");
    setMobileView("map");
    setStatus("Modo geotag activo. Toca el mapa donde está el estacionamiento. Presiona Escape para cancelar.");
  }

  function updateCoordinateFields(latitude, longitude, announce = true) {
    elements.latitude.value = Number(latitude).toFixed(6);
    elements.longitude.value = Number(longitude).toFixed(6);
    validateCoordinates(announce);
  }

  function validateCoordinates(announce = false) {
    const latitude = Number(elements.latitude.value);
    const longitude = Number(elements.longitude.value);
    const valid = insideChile(latitude, longitude);
    const message = valid ? "" : "Marca coordenadas dentro de Chile antes de guardar.";
    elements.latitude.setCustomValidity(message);
    elements.longitude.setCustomValidity(message);
    elements.coordinateError.hidden = valid;
    elements.coordinateError.textContent = message;
    elements.coordinateSummary.textContent = valid
      ? `Geotag: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      : "Todavía no hay un geotag válido dentro de Chile.";
    if (valid) state.pendingCoordinates = { latitude, longitude };
    if (announce && message) elements.coordinateError.focus?.();
    return valid;
  }

  function startPointForm(latitude, longitude) {
    elements.form.reset();
    updateCoordinateFields(latitude, longitude, false);
    openDialog(elements.formDialog);
    window.setTimeout(() => elements.form.elements.name.focus(), 50);
  }

  function savePoint(event) {
    event.preventDefault();
    if (!validateCoordinates(true) || !elements.form.reportValidity()) return;
    const data = new FormData(elements.form);
    const point = {
      id: `local-${Date.now()}`,
      name: String(data.get("name") || "Estacionamiento accesible pendiente").trim(),
      location: String(data.get("location") || "Sin referencia").trim(),
      latitude: Number(data.get("latitude")),
      longitude: Number(data.get("longitude")),
      transferSide: String(data.get("transferSide") || "unknown"),
      stepFree: String(data.get("stepFree") || "unknown"),
      notes: String(data.get("notes") || "").trim(),
      pending: true,
      demo: false,
    };
    state.localPoints.unshift(point);
    const persisted = writeJson(STORAGE_KEY, state.localPoints);
    closeDialog(elements.formDialog);
    state.pendingCoordinates = null;
    state.selectedId = point.id;
    render();
    focusPoint(point);
    showToast(persisted
      ? "Punto guardado en este navegador como aporte pendiente."
      : "Punto visible en esta sesión, pero el navegador bloqueó el guardado local.");
  }

  function requestLocation(callback) {
    if (!navigator.geolocation) {
      setStatus("Este dispositivo no permite obtener la ubicación. Puedes marcar manualmente o escribir coordenadas.");
      return;
    }
    setStatus("Buscando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      (position) => callback(position.coords.latitude, position.coords.longitude),
      (error) => {
        const message = {
          1: "No diste permiso para usar la ubicación.",
          2: "El dispositivo no pudo determinar la ubicación.",
          3: "La búsqueda de ubicación tardó demasiado.",
        }[error.code] || "No fue posible obtener tu ubicación.";
        setStatus(`${message} Puedes marcar manualmente o escribir coordenadas.`);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  function locateUser() {
    requestLocation((latitude, longitude) => {
      if (!insideChile(latitude, longitude)) {
        setStatus("Tu ubicación actual está fuera del área de Chile configurada para esta preview.");
        return;
      }
      if (state.userMarker) state.userMarker.remove();
      if (state.map && window.L) {
        state.userMarker = window.L.marker([latitude, longitude], {
          icon: userIcon(),
          keyboard: true,
          title: "Tu ubicación aproximada",
          alt: "Tu ubicación aproximada",
        }).addTo(state.map).bindPopup("Tu ubicación aproximada");
        state.map.setView([latitude, longitude], 16, { animate: motionAllowed() });
        state.userMarker.openPopup();
      }
      setStatus("Ubicación encontrada. Puedes marcar un estacionamiento cercano.");
      setMobileView("map");
    });
  }

  function useLocationForPoint() {
    requestLocation((latitude, longitude) => {
      if (!insideChile(latitude, longitude)) {
        elements.coordinateError.hidden = false;
        elements.coordinateError.textContent = "La ubicación detectada está fuera de Chile.";
        return;
      }
      updateCoordinateFields(latitude, longitude);
      setStatus("Ubicación agregada al aporte. Puedes ajustarla con los botones.");
    });
  }

  function useMapCenter() {
    const center = state.map?.getCenter();
    if (!center) return;
    updateCoordinateFields(center.lat, center.lng);
  }

  function nudgePoint(direction) {
    const latitude = Number(elements.latitude.value) || state.map?.getCenter().lat;
    const longitude = Number(elements.longitude.value) || state.map?.getCenter().lng;
    const offsets = {
      north: [NUDGE_STEP, 0],
      south: [-NUDGE_STEP, 0],
      east: [0, NUDGE_STEP],
      west: [0, -NUDGE_STEP],
    }[direction];
    if (!offsets) return;
    updateCoordinateFields(latitude + offsets[0], longitude + offsets[1]);
  }

  function setMobileView(view) {
    elements.workspace.dataset.view = window.matchMedia("(max-width: 900px)").matches ? view : "split";
    document.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (view === "map") window.setTimeout(() => state.map?.invalidateSize(), 40);
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3600);
  }

  function applyPreferences() {
    const preferences = { ...DEFAULT_PREFERENCES, ...state.preferences };
    state.preferences = preferences;
    document.documentElement.dataset.textScale = preferences.textScale;
    document.documentElement.dataset.highContrast = String(Boolean(preferences.highContrast));
    document.documentElement.dataset.reduceMotion = String(Boolean(preferences.reduceMotion));
    document.documentElement.dataset.mapStyle = preferences.mapStyle;
    document.documentElement.dataset.spacing = preferences.spacing;
  }

  function populateAccessibilityForm() {
    const form = elements.accessibilityForm;
    form.elements.textScale.value = state.preferences.textScale;
    form.elements.highContrast.checked = Boolean(state.preferences.highContrast);
    form.elements.reduceMotion.checked = Boolean(state.preferences.reduceMotion);
    form.elements.mapStyle.value = state.preferences.mapStyle;
    form.elements.comfortableSpacing.checked = state.preferences.spacing === "comfortable";
  }

  function saveAccessibilityPreferences(close = false) {
    const form = elements.accessibilityForm;
    state.preferences = {
      textScale: form.elements.textScale.value,
      highContrast: form.elements.highContrast.checked,
      reduceMotion: form.elements.reduceMotion.checked,
      mapStyle: form.elements.mapStyle.value,
      spacing: form.elements.comfortableSpacing.checked ? "comfortable" : "standard",
    };
    writeJson(PREFERENCES_KEY, state.preferences);
    applyPreferences();
    if (close) closeDialog(elements.accessibilityDialog);
  }

  elements.search.addEventListener("input", render);
  elements.locate.addEventListener("click", locateUser);
  elements.pinMode.addEventListener("click", activatePinMode);
  elements.showChile.addEventListener("click", () => {
    showChile();
    setMobileView("map");
    setStatus("Mostrando Chile continental. Los puntos también están disponibles en la lista.");
  });
  elements.form.addEventListener("submit", savePoint);
  elements.latitude.addEventListener("input", () => validateCoordinates(false));
  elements.longitude.addEventListener("input", () => validateCoordinates(false));
  document.getElementById("point-use-location").addEventListener("click", useLocationForPoint);
  document.getElementById("point-use-center").addEventListener("click", useMapCenter);
  document.querySelectorAll("[data-nudge]").forEach((button) => {
    button.addEventListener("click", () => nudgePoint(button.dataset.nudge));
  });
  elements.accessibilityOpen.addEventListener("click", () => {
    populateAccessibilityForm();
    openDialog(elements.accessibilityDialog);
  });
  elements.accessibilityForm.addEventListener("change", () => saveAccessibilityPreferences(false));
  elements.accessibilityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveAccessibilityPreferences(true);
  });
  elements.accessibilityReset.addEventListener("click", () => {
    state.preferences = { ...DEFAULT_PREFERENCES };
    populateAccessibilityForm();
    writeJson(PREFERENCES_KEY, state.preferences);
    applyPreferences();
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setMobileView(button.dataset.view));
  });
  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => closeDialog(button.closest("dialog")));
  });
  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.pinMode) cancelPinMode();
  });

  applyPreferences();
  initialiseMap();
  setMobileView("list");
  render();
})();
