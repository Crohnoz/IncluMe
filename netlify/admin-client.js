(() => {
  "use strict";

  const ENDPOINT = "https://azdrxkabzldwcmotzaor.supabase.co/functions/v1/inclume-admin";
  const SESSION_KEY = "inclume.moderator.key.v1";

  const loginView = document.getElementById("login-view");
  const dashboardView = document.getElementById("dashboard-view");
  const loginForm = document.getElementById("login-form");
  const keyInput = document.getElementById("admin-key");
  const loginStatus = document.getElementById("login-status");
  const globalStatus = document.getElementById("global-status");
  const moderatorLabel = document.getElementById("moderator-label");
  const refreshButton = document.getElementById("refresh");
  const logoutButton = document.getElementById("logout");
  const summary = document.getElementById("summary");

  let adminKey = sessionStorage.getItem(SESSION_KEY) || "";
  let loading = false;

  const statusLabels = {
    pending: "Pendiente",
    triaged: "En revisión",
    needs_clarification: "Requiere aclaración",
    rejected: "Rechazado",
    archived: "Archivado",
    accepted: "Aceptado",
    new: "Nueva",
    contacted: "Contacto iniciado",
    meeting_scheduled: "Reunión coordinada",
    pilot_scoping: "Definiendo piloto",
    closed: "Cerrada",
    approved: "Aprobado",
  };

  const reportTypeLabels = {
    nuevo_estacionamiento: "Nuevo estacionamiento",
    informacion_incorrecta: "Información incorrecta",
    acceso_bloqueado: "Acceso bloqueado",
    senalizacion_ausente: "Señalización ausente",
    ruta_con_barrera: "Ruta con barrera",
    otro_cambio_observable: "Otro cambio observable",
  };

  const objectiveLabels = {
    catastro_estacionamientos: "Catastro de estacionamientos",
    validacion_ciudadana: "Validación ciudadana",
    rutas_entradas: "Rutas y entradas",
    panel_exportacion: "Panel y exportación",
    otro_piloto: "Otro piloto",
  };

  function element(tag, options = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(options).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      if (key === "className") node.className = value;
      else if (key === "text") node.textContent = String(value);
      else if (key === "checked") node.checked = Boolean(value);
      else if (key === "disabled") node.disabled = Boolean(value);
      else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
      else node.setAttribute(key, String(value));
    });
    const normalized = Array.isArray(children) ? children : [children];
    normalized.forEach((child) => {
      if (child === null || child === undefined) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function formatDate(value) {
    if (!value) return "Sin fecha";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Fecha no disponible";
    return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function setGlobal(message, isError = false) {
    globalStatus.textContent = message;
    globalStatus.dataset.state = isError ? "error" : "ok";
  }

  function setLogin(message, isError = false) {
    loginStatus.textContent = message;
    loginStatus.dataset.state = isError ? "error" : "ok";
  }

  async function api(resource, options = {}) {
    if (!adminKey) throw new Error("No existe una sesión administrativa activa.");
    const url = new URL(ENDPOINT);
    if (resource) url.searchParams.set("resource", resource);
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      closeSession();
      throw new Error("La clave administrativa no es válida o fue revocada.");
    }
    if (!response.ok || !payload.ok) throw new Error(payload.message || "No fue posible completar la operación.");
    return payload;
  }

  function openDashboard(label) {
    loginView.hidden = true;
    dashboardView.hidden = false;
    moderatorLabel.textContent = `Sesión: ${label}`;
    moderatorLabel.hidden = false;
    refreshButton.hidden = false;
    logoutButton.hidden = false;
  }

  function closeSession() {
    adminKey = "";
    sessionStorage.removeItem(SESSION_KEY);
    keyInput.value = "";
    dashboardView.hidden = true;
    loginView.hidden = false;
    moderatorLabel.hidden = true;
    refreshButton.hidden = true;
    logoutButton.hidden = true;
    setLogin("Sesión cerrada.");
  }

  function detail(label, value) {
    return element("div", { className: "detail" }, [
      element("span", { text: label }),
      element("strong", { text: value ?? "Sin informar" }),
    ]);
  }

  function chip(value) {
    return element("span", { className: "chip", text: statusLabels[value] || value || "Sin estado" });
  }

  function reference(value) {
    return element("span", { className: "reference", text: value });
  }

  function option(value, label, selectedValue) {
    return element("option", { value, text: label, selected: value === selectedValue ? "selected" : null });
  }

  function notesField(label = "Nota interna") {
    const textarea = element("textarea", { maxlength: "2000", placeholder: "Motivo breve, objetivo y verificable." });
    return { wrapper: element("label", { className: "field" }, [element("span", { text: label }), textarea]), textarea };
  }

  async function runAction(button, payload, successMessage) {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    setGlobal("Guardando decisión auditada…");
    try {
      await api(null, { method: "POST", body: JSON.stringify(payload) });
      setGlobal(successMessage);
      await loadAll();
    } catch (error) {
      setGlobal(error instanceof Error ? error.message : "No fue posible completar la acción.", true);
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }

  function metric(value, label) {
    return element("article", { className: "metric" }, [
      element("strong", { text: value ?? 0 }),
      element("span", { text: label }),
    ]);
  }

  function renderSummary(metrics) {
    summary.replaceChildren(
      metric(metrics.publishedLocations, "lugares publicados"),
      metric(metrics.citizenReportsReceived, "reportes recibidos"),
      metric(metrics.citizenReportsInReview, "reportes en revisión"),
      metric(metrics.citizenReportsAccepted, "reportes aceptados"),
      metric(metrics.communesReported, "comunas con reportes"),
    );
  }

  function renderCitizen(items) {
    const container = document.getElementById("citizen-list");
    document.getElementById("citizen-count").textContent = String(items.length);
    container.replaceChildren();
    if (!items.length) {
      container.append(element("p", { className: "empty", text: "No hay reportes ciudadanos pendientes." }));
      return;
    }

    items.forEach((item) => {
      const header = element("div", { className: "item__head" }, [
        element("div", {}, [reference(item.public_reference), element("h3", { text: item.place_name }), element("span", { className: "muted", text: reportTypeLabels[item.report_type] || item.report_type })]),
        chip(item.status),
      ]);

      const coordinates = item.latitude !== null && item.longitude !== null
        ? `${item.latitude}, ${item.longitude}`
        : "Sin coordenadas";
      const details = element("div", { className: "details" }, [
        detail("Comuna", item.commune),
        detail("Referencia", item.exact_reference),
        detail("Coordenadas", coordinates),
        detail("Correo de contacto", item.contact_email || "No informado"),
        detail("Recibido", formatDate(item.created_at)),
        detail("Última actualización", formatDate(item.updated_at)),
      ]);

      const statusSelect = element("select");
      [
        ["pending", "Pendiente"],
        ["triaged", "En revisión"],
        ["needs_clarification", "Requiere aclaración"],
        ["rejected", "Rechazado"],
        ["archived", "Archivado"],
      ].forEach(([value, label]) => statusSelect.append(option(value, label, item.status)));
      const statusNotes = notesField();
      const statusButton = element("button", { className: "button secondary", type: "button", text: "Guardar estado" });
      statusButton.addEventListener("click", () => runAction(statusButton, {
        action: "citizen_status",
        reference: item.public_reference,
        status: statusSelect.value,
        notes: statusNotes.textarea.value,
      }, `Estado de ${item.public_reference} actualizado.`));
      const statusBox = element("section", { className: "action-box" }, [
        element("h4", { text: "Clasificación" }),
        element("label", { className: "field" }, [element("span", { text: "Estado" }), statusSelect]),
        statusNotes.wrapper,
        statusButton,
      ]);

      const actionBoxes = [statusBox];
      if (item.latitude !== null && item.longitude !== null) {
        const transfer = element("select");
        [["unknown", "No informado"], ["right", "Derecho"], ["left", "Izquierdo"], ["both", "Ambos lados"]].forEach(([value, label]) => transfer.append(option(value, label, "unknown")));
        const stepFree = element("select");
        [["unknown", "No informado"], ["yes", "Sin escalones"], ["no", "Con barrera"]].forEach(([value, label]) => stepFree.append(option(value, label, "unknown")));
        const confidence = element("select");
        [["community_reviewed", "Revisión comunitaria"], ["institutional", "Confirmación institucional"], ["field_audit", "Auditoría en terreno"]].forEach(([value, label]) => confidence.append(option(value, label, "community_reviewed")));
        const publicationNotes = notesField("Justificación de publicación");
        const publishButton = element("button", { className: "button primary", type: "button", text: "Aprobar y publicar" });
        publishButton.addEventListener("click", () => runAction(publishButton, {
          action: "publish_report",
          reference: item.public_reference,
          transferSide: transfer.value,
          stepFree: stepFree.value,
          confidenceLabel: confidence.value,
          notes: publicationNotes.textarea.value,
        }, `${item.public_reference} fue incorporado al catálogo.`));
        actionBoxes.push(element("section", { className: "action-box" }, [
          element("h4", { text: "Publicación" }),
          element("label", { className: "field" }, [element("span", { text: "Transferencia" }), transfer]),
          element("label", { className: "field" }, [element("span", { text: "Ruta" }), stepFree]),
          element("label", { className: "field" }, [element("span", { text: "Confianza" }), confidence]),
          publicationNotes.wrapper,
          publishButton,
        ]));
      }

      container.append(element("article", { className: "item" }, [
        header,
        details,
        element("p", { className: "observation", text: item.observation }),
        item.moderator_notes ? element("p", { className: "security-note", text: `Nota previa: ${item.moderator_notes}` }) : null,
        element("div", { className: "action-grid" }, actionBoxes),
      ]));
    });
  }

  function renderMunicipal(items) {
    const container = document.getElementById("municipal-list");
    document.getElementById("municipal-count").textContent = String(items.length);
    container.replaceChildren();
    if (!items.length) {
      container.append(element("p", { className: "empty", text: "No hay solicitudes municipales abiertas." }));
      return;
    }

    items.forEach((item) => {
      const select = element("select");
      [
        ["new", "Nueva"], ["contacted", "Contacto iniciado"], ["meeting_scheduled", "Reunión coordinada"],
        ["pilot_scoping", "Definiendo piloto"], ["closed", "Cerrada"], ["archived", "Archivada"],
      ].forEach(([value, label]) => select.append(option(value, label, item.status)));
      const notes = notesField();
      const button = element("button", { className: "button primary", type: "button", text: "Guardar seguimiento" });
      button.addEventListener("click", () => runAction(button, {
        action: "municipal_status",
        reference: item.public_reference,
        status: select.value,
        notes: notes.textarea.value,
      }, `Solicitud ${item.public_reference} actualizada.`));

      container.append(element("article", { className: "item" }, [
        element("div", { className: "item__head" }, [
          element("div", {}, [reference(item.public_reference), element("h3", { text: item.institution }), element("span", { className: "muted", text: item.territory })]),
          chip(item.status),
        ]),
        element("div", { className: "details" }, [
          detail("Contacto", item.contact_name),
          detail("Cargo o unidad", item.contact_role),
          detail("Correo", item.institutional_email),
          detail("Teléfono", item.phone || "No informado"),
          detail("Objetivo", objectiveLabels[item.objective] || item.objective),
          detail("Recibida", formatDate(item.created_at)),
        ]),
        element("p", { className: "observation", text: item.problem_description }),
        item.internal_notes ? element("p", { className: "security-note", text: `Nota previa: ${item.internal_notes}` }) : null,
        element("div", { className: "action-grid" }, [element("section", { className: "action-box" }, [
          element("h4", { text: "Seguimiento institucional" }),
          element("label", { className: "field" }, [element("span", { text: "Estado" }), select]),
          notes.wrapper,
          button,
        ])]),
      ]));
    });
  }

  function renderCatalog(items) {
    const container = document.getElementById("catalog-list");
    document.getElementById("catalog-count").textContent = String(items.length);
    container.replaceChildren();
    if (!items.length) {
      container.append(element("p", { className: "empty", text: "El catálogo real todavía no tiene lugares aprobados." }));
      return;
    }

    items.forEach((item) => {
      const select = element("select");
      [["approved", "Aprobado"], ["pending", "Pendiente"], ["rejected", "Rechazado"], ["archived", "Archivado"]].forEach(([value, label]) => select.append(option(value, label, item.moderation_status)));
      const published = element("input", { type: "checkbox", checked: item.is_published });
      const enforceState = () => {
        if (select.value !== "approved") {
          published.checked = false;
          published.disabled = true;
        } else published.disabled = false;
      };
      select.addEventListener("change", enforceState);
      enforceState();
      const notes = notesField("Motivo del cambio");
      const button = element("button", { className: "button primary", type: "button", text: "Guardar catálogo" });
      button.addEventListener("click", () => runAction(button, {
        action: "parking_status",
        parkingId: item.id,
        status: select.value,
        isPublished: published.checked,
        notes: notes.textarea.value,
      }, `El lugar ${item.name} fue actualizado.`));

      const mapLink = element("a", {
        className: "button secondary",
        href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.latitude},${item.longitude}`)}`,
        target: "_blank",
        rel: "noopener noreferrer",
        text: "Revisar coordenadas",
      });

      container.append(element("article", { className: "item" }, [
        element("div", { className: "item__head" }, [
          element("div", {}, [element("h3", { text: item.name }), element("span", { className: "muted", text: `${item.commune} · ${item.location_reference}` })]),
          chip(item.moderation_status),
        ]),
        element("div", { className: "details" }, [
          detail("Coordenadas", `${item.latitude}, ${item.longitude}`),
          detail("Transferencia", item.transfer_side),
          detail("Ruta", item.step_free),
          detail("Confianza", item.confidence_label),
          detail("Publicado", item.is_published ? "Sí" : "No"),
          detail("Actualizado", formatDate(item.updated_at)),
        ]),
        mapLink,
        element("div", { className: "action-grid" }, [element("section", { className: "action-box" }, [
          element("h4", { text: "Estado del catálogo" }),
          element("label", { className: "field" }, [element("span", { text: "Moderación" }), select]),
          element("label", { className: "field" }, [element("span", { text: "Publicación" }), element("span", {}, [published, document.createTextNode(" Visible en el mapa")])]),
          notes.wrapper,
          button,
        ])]),
      ]));
    });
  }

  function renderEvents(items) {
    const container = document.getElementById("events-list");
    document.getElementById("events-count").textContent = String(items.length);
    container.replaceChildren();
    if (!items.length) {
      container.append(element("p", { className: "empty", text: "Todavía no existen decisiones auditadas." }));
      return;
    }
    items.forEach((item) => {
      container.append(element("article", { className: "event" }, [
        item.public_reference ? reference(item.public_reference) : chip(item.entity_type),
        element("div", {}, [
          element("strong", { text: item.action }),
          element("span", { className: "muted", text: `${item.previous_status || "—"} → ${item.new_status || "—"}` }),
          item.notes ? element("span", { text: item.notes }) : null,
          element("span", { className: "muted", text: `Actor: ${item.actor_label}` }),
        ]),
        element("time", { datetime: item.created_at, text: formatDate(item.created_at) }),
      ]));
    });
  }

  async function loadAll() {
    if (loading || !adminKey) return;
    loading = true;
    refreshButton.disabled = true;
    setGlobal("Actualizando centro de moderación…");
    try {
      const [summaryData, citizenData, municipalData, catalogData, eventsData] = await Promise.all([
        api("summary"), api("citizen_queue"), api("municipal_queue"), api("catalog"), api("events"),
      ]);
      renderSummary(summaryData.metrics || {});
      renderCitizen(citizenData.items || []);
      renderMunicipal(municipalData.items || []);
      renderCatalog(catalogData.items || []);
      renderEvents(eventsData.items || []);
      setGlobal("Centro actualizado.");
    } catch (error) {
      setGlobal(error instanceof Error ? error.message : "No fue posible actualizar el centro.", true);
    } finally {
      loading = false;
      refreshButton.disabled = false;
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const candidate = keyInput.value.trim();
    if (candidate.length < 32) {
      setLogin("La clave no tiene un formato válido.", true);
      return;
    }
    adminKey = candidate;
    setLogin("Verificando acceso…");
    try {
      const session = await api("session");
      sessionStorage.setItem(SESSION_KEY, adminKey);
      openDashboard(session.moderator.label);
      setLogin("");
      await loadAll();
    } catch (error) {
      adminKey = "";
      sessionStorage.removeItem(SESSION_KEY);
      setLogin(error instanceof Error ? error.message : "No fue posible iniciar sesión.", true);
    }
  });

  document.querySelectorAll("[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach((candidate) => candidate.setAttribute("aria-selected", String(candidate === tab)));
      document.querySelectorAll('[role="tabpanel"]').forEach((panel) => { panel.hidden = panel.id !== `panel-${tab.dataset.tab}`; });
    });
  });

  refreshButton.addEventListener("click", loadAll);
  logoutButton.addEventListener("click", closeSession);

  if (adminKey) {
    api("session").then((session) => {
      openDashboard(session.moderator.label);
      loadAll();
    }).catch(() => closeSession());
  }
})();
