(() => {
  "use strict";

  const CHILE_BOUNDS = L.latLngBounds([[-56.5, -76.5], [-17, -66]]);
  const STORAGE_KEY = "inclume.preview.chile.points.v2";
  const MOTION_KEY = "inclume.preview.reduce-motion";

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
    formCoordinates: document.getElementById("dialog-coordinates"),
    detailDialog: document.getElementById("detail-dialog"),
    detailTitle: document.getElementById("detail-title"),
    detailStatus: document.getElementById("detail-status"),
    detailBody: document.getElementById("detail-body"),
    toast: document.getElementById("toast"),
    motionToggle: document.getElementById("motion-toggle"),
  };

  const state = {
    localPoints: loadLocalPoints(),
    visible: [],
    markers: new Map(),
    selectedId: null,
    pinMode: false,
    pendingCoordinates: null,
    userMarker: null,
  };

  const map = L.map(elements.map, {
    scrollWheelZoom: false,
    zoomControl: true,
    preferCanvas: true,
  });
  map.setMaxBounds(L.latLngBounds([[-58, -112], [-15, -64]]));
  map.options.maxBoundsViscosity = 0.5;
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
  const markerLayer = L.layerGroup().addTo(map);
  showChile();

  function loadLocalPoints() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  function saveLocalPoints() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.localPoints));
    } catch (_error) {
      showToast("El navegador no permitió guardar el punto, pero seguirá visible durante esta sesión.");
    }
  }

  function allPoints() {
    return [...state.localPoints, ...demoPoints];
  }

  function showChile() {
    map.fitBounds(CHILE_BOUNDS, { padding: [28, 28], animate: !document.documentElement.classList.contains("reduce-motion") });
  }

  function escapeText(value) {
    return String(value ?? "");
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
    return L.divIcon({
      className: "",
      html: `<span class="${className}" aria-hidden="true">${label}</span>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }

  function createButton(label, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button ${className}`;
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function render() {
    const query = elements.search.value.trim().toLocaleLowerCase("es-CL");
    state.visible = allPoints().filter((point) => {
      if (!query) return true;
      return `${point.name} ${point.location} ${point.notes}`.toLocaleLowerCase("es-CL").includes(query);
    });

    elements.list.replaceChildren();
    markerLayer.clearLayers();
    state.markers.clear();
    elements.empty.hidden = state.visible.length > 0;
    elements.count.textContent = `${state.visible.length} ${state.visible.length === 1 ? "punto mostrado" : "puntos mostrados"}`;

    state.visible.forEach((point, index) => {
      const marker = L.marker([point.latitude, point.longitude], {
        icon: markerIcon(point, index),
        keyboard: true,
        title: point.name,
      }).addTo(markerLayer);
      marker.bindPopup(`<strong>${escapeText(point.name)}</strong><br>${escapeText(point.location)}`);
      marker.on("click", () => selectPoint(point, false));
      state.markers.set(point.id, marker);

      const item = document.createElement("li");
      item.className = `parking-card${state.selectedId === point.id ? " is-selected" : ""}`;
      item.style.setProperty("--index", index);
      item.dataset.id = point.id;

      const badges = document.createElement("div");
      badges.className = "card-row";
      const badge = document.createElement("span");
      badge.className = `badge${point.pending ? " badge--pending" : point.demo ? " badge--warning" : ""}`;
      badge.textContent = point.pending ? "Pendiente local" : point.demo ? "Dato demo no verificado" : "Comunitario";
      badges.appendChild(badge);

      const title = document.createElement("h3");
      title.textContent = point.name;
      const location = document.createElement("p");
      location.textContent = point.location;

      const features = document.createElement("div");
      features.className = "feature-list";
      [transferLabel(point.transferSide), routeLabel(point.stepFree)].forEach((text) => {
        const feature = document.createElement("span");
        feature.className = "badge";
        feature.textContent = text;
        features.appendChild(feature);
      });

      const actions = document.createElement("div");
      actions.className = "card-actions";
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
    elements.mapHelp.innerHTML = `<strong>${escapeText(point.name)}</strong><span>${escapeText(point.location)}</span>`;
  }

  function focusPoint(point) {
    setMobileView("map");
    map.setView([point.latitude, point.longitude], 17, { animate: true });
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
    const item = document.createElement("div");
    item.className = "detail-item";
    const term = document.createElement("span");
    term.textContent = label;
    const data = document.createElement("strong");
    data.textContent = value;
    item.append(term, data);
    return item;
  }

  function openDetails(point) {
    elements.detailTitle.textContent = point.name;
    elements.detailStatus.textContent = point.pending ? "Pendiente local" : "Dato demo no verificado";
    elements.detailBody.replaceChildren();

    const grid = document.createElement("div");
    grid.className = "detail-grid";
    grid.append(
      detailItem("Referencia", point.location),
      detailItem("Geotag", `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`),
      detailItem("Transferencia", transferLabel(point.transferSide)),
      detailItem("Ruta", routeLabel(point.stepFree)),
    );

    const notes = document.createElement("section");
    notes.className = "detail-notes";
    const notesTitle = document.createElement("h3");
    notesTitle.textContent = "Observación";
    const notesText = document.createElement("p");
    notesText.textContent = point.notes || "Sin observación adicional.";
    notes.append(notesTitle, notesText);

    const actions = document.createElement("div");
    actions.className = "sheet__actions";
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
    saveLocalPoints();
    closeDialog(elements.detailDialog);
    state.selectedId = null;
    render();
    showToast("Punto local eliminado.");
  }

  function openDialog(dialog) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function activatePinMode() {
    state.pinMode = !state.pinMode;
    elements.pinMode.setAttribute("aria-pressed", String(state.pinMode));
    elements.map.classList.toggle("is-pin-mode", state.pinMode);
    setMobileView("map");
    elements.status.textContent = state.pinMode
      ? "Modo geotag activo. Toca el mapa donde está el estacionamiento accesible."
      : "Modo geotag cancelado.";
  }

  function startPointForm(latitude, longitude) {
    state.pendingCoordinates = { latitude, longitude };
    elements.form.reset();
    elements.formCoordinates.textContent = `Geotag: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    openDialog(elements.formDialog);
  }

  function savePoint(event) {
    event.preventDefault();
    if (!state.pendingCoordinates) return;
    const data = new FormData(elements.form);
    const point = {
      id: `local-${Date.now()}`,
      name: String(data.get("name") || "Estacionamiento accesible pendiente").trim(),
      location: String(data.get("location") || "Sin referencia").trim(),
      latitude: state.pendingCoordinates.latitude,
      longitude: state.pendingCoordinates.longitude,
      transferSide: String(data.get("transferSide") || "unknown"),
      stepFree: String(data.get("stepFree") || "unknown"),
      notes: String(data.get("notes") || "").trim(),
      pending: true,
      demo: false,
    };
    state.localPoints.unshift(point);
    saveLocalPoints();
    closeDialog(elements.formDialog);
    state.pendingCoordinates = null;
    state.selectedId = point.id;
    render();
    focusPoint(point);
    showToast("Punto guardado en este navegador como aporte pendiente.");
  }

  function locateUser() {
    if (!navigator.geolocation) {
      elements.status.textContent = "Este dispositivo no permite obtener la ubicación.";
      return;
    }
    elements.status.textContent = "Buscando tu ubicación…";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = [position.coords.latitude, position.coords.longitude];
        if (state.userMarker) state.userMarker.remove();
        state.userMarker = L.marker(point, {
          icon: L.divIcon({
            className: "",
            html: '<span class="map-pin map-pin--user" aria-hidden="true">Tú</span>',
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          }),
          title: "Tu ubicación aproximada",
        }).addTo(map).bindPopup("Tu ubicación aproximada");
        map.setView(point, 16);
        state.userMarker.openPopup();
        elements.status.textContent = "Ubicación encontrada. Puedes marcar un estacionamiento cercano.";
        setMobileView("map");
      },
      (error) => {
        const message = {
          1: "No diste permiso para usar la ubicación.",
          2: "El dispositivo no pudo determinar la ubicación.",
          3: "La búsqueda de ubicación tardó demasiado.",
        }[error.code] || "No fue posible obtener tu ubicación.";
        elements.status.textContent = `${message} Puedes marcar manualmente en el mapa.`;
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  function setMobileView(view) {
    elements.workspace.dataset.view = window.matchMedia("(max-width: 900px)").matches ? view : "split";
    document.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (view === "map") window.setTimeout(() => map.invalidateSize(), 40);
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3200);
  }

  function applyMotionPreference() {
    const reduced = localStorage.getItem(MOTION_KEY) === "true";
    document.documentElement.classList.toggle("reduce-motion", reduced);
    elements.motionToggle.setAttribute("aria-pressed", String(reduced));
    elements.motionToggle.textContent = reduced ? "Activar movimiento suave" : "Reducir movimiento";
  }

  map.on("click", (event) => {
    if (!state.pinMode) return;
    state.pinMode = false;
    elements.pinMode.setAttribute("aria-pressed", "false");
    elements.map.classList.remove("is-pin-mode");
    elements.status.textContent = "Punto marcado. Completa la información del estacionamiento.";
    startPointForm(event.latlng.lat, event.latlng.lng);
  });

  elements.search.addEventListener("input", render);
  elements.locate.addEventListener("click", locateUser);
  elements.pinMode.addEventListener("click", activatePinMode);
  elements.showChile.addEventListener("click", () => {
    showChile();
    setMobileView("map");
    elements.status.textContent = "Mostrando Chile continental. Los marcadores fuertes corresponden a los puntos de la lista.";
  });
  elements.form.addEventListener("submit", savePoint);
  elements.motionToggle.addEventListener("click", () => {
    const next = !document.documentElement.classList.contains("reduce-motion");
    localStorage.setItem(MOTION_KEY, String(next));
    applyMotionPreference();
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setMobileView(button.dataset.view));
  });
  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => closeDialog(button.closest("dialog")));
  });
  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      const rect = dialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) closeDialog(dialog);
    });
  });

  applyMotionPreference();
  setMobileView("list");
  render();
})();
