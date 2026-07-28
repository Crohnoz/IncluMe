(() => {
    "use strict";

    const app = document.getElementById("parking-app");
    if (!app || typeof window.fetch !== "function") return;

    const KEYS = {
        snapshot: "inclume.parkings.snapshot.v3",
        verificationQueue: "inclume.verifications.queue.v2",
        contributionDraft: "inclume.contribution.draft.v2",
        savedPlaces: "inclume.saved-places.v2",
    };
    const nativeFetch = window.fetch.bind(window);
    const apiPath = new URL(app.dataset.apiUrl, location.origin).pathname;
    const submitPath = new URL(app.dataset.submitUrl, location.origin).pathname;
    const parkingById = new Map();
    let selectedParkingId = null;

    function getJson(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key)) ?? fallback;
        } catch (_error) {
            return fallback;
        }
    }

    function setJson(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (_error) {
            return false;
        }
    }

    function remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (_error) {
            // Storage is optional.
        }
    }

    function csrfToken() {
        const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : "";
    }

    function asUrl(input) {
        if (typeof input === "string") return new URL(input, location.origin);
        if (input instanceof URL) return input;
        return new URL(input.url, location.origin);
    }

    function methodOf(input, init) {
        return String(init?.method || input?.method || "GET").toUpperCase();
    }

    function verificationParkingId(pathname) {
        return Number(pathname.match(/\/api\/parkings\/(\d+)\/verify\/?$/)?.[1] || 0);
    }

    function indexPayload(payload) {
        if (!Array.isArray(payload?.parkings)) return;
        payload.parkings.forEach((parking) => parkingById.set(Number(parking.id), parking));
    }

    function snapshot() {
        const cached = getJson(KEYS.snapshot, null);
        if (cached?.payload) indexPayload(cached.payload);
        return cached;
    }

    function saveSnapshot(payload) {
        if (!Array.isArray(payload?.parkings)) return;
        indexPayload(payload);
        setJson(KEYS.snapshot, { cachedAt: new Date().toISOString(), payload });
        window.dispatchEvent(new CustomEvent("inclume:parkings", { detail: { payload, source: "network" } }));
    }

    function cachedResponse() {
        const cached = snapshot();
        if (!cached?.payload) return null;
        const payload = { ...cached.payload, offline_snapshot: true, cached_at: cached.cachedAt };
        window.dispatchEvent(new CustomEvent("inclume:parkings", { detail: { payload, source: "cache" } }));
        return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "Content-Type": "application/json; charset=utf-8" },
        });
    }

    function updateCachedParking(parking) {
        if (!parking?.id) return;
        parkingById.set(Number(parking.id), parking);
        const cached = snapshot();
        if (!cached?.payload?.parkings) return;
        const index = cached.payload.parkings.findIndex((item) => Number(item.id) === Number(parking.id));
        if (index >= 0) cached.payload.parkings[index] = parking;
        cached.cachedAt = new Date().toISOString();
        setJson(KEYS.snapshot, cached);
    }

    function queueVerification(url, body, parkingId) {
        const queue = getJson(KEYS.verificationQueue, []);
        const key = `${url.pathname}:${body}`;
        if (!queue.some((item) => item.key === key)) {
            queue.push({ key, url: url.pathname, body, parkingId, queuedAt: new Date().toISOString() });
            setJson(KEYS.verificationQueue, queue.slice(-20));
        }
        updateConnectionBanner();
    }

    function queuedVerificationResponse(parking) {
        return new Response(
            JSON.stringify({
                ok: true,
                queued: true,
                message: "Guardamos la verificación y la enviaremos cuando vuelva la conexión.",
                parking,
            }),
            { status: 202, headers: { "Content-Type": "application/json; charset=utf-8" } },
        );
    }

    window.fetch = async (input, init = {}) => {
        const url = asUrl(input);
        const method = methodOf(input, init);
        const parkingId = verificationParkingId(url.pathname);
        const isParkingGet = method === "GET" && url.pathname === apiPath;

        if (!navigator.onLine && isParkingGet) return cachedResponse() || nativeFetch(input, init);
        if (!navigator.onLine && method === "POST" && parkingId && typeof init.body === "string") {
            const parking = parkingById.get(parkingId) || snapshot()?.payload?.parkings?.find(
                (item) => Number(item.id) === parkingId,
            );
            if (parking) {
                queueVerification(url, init.body, parkingId);
                return queuedVerificationResponse(parking);
            }
        }

        try {
            const response = await nativeFetch(input, init);
            if (isParkingGet && response.ok) saveSnapshot(await response.clone().json());
            if (isParkingGet && response.status >= 500) return cachedResponse() || response;
            if (method === "POST" && parkingId && response.ok) {
                const payload = await response.clone().json();
                updateCachedParking(payload.parking);
            }
            if (method === "POST" && url.pathname === submitPath) {
                if (response.ok) remove(KEYS.contributionDraft);
                if (response.status === 409) {
                    const payload = await response.clone().json();
                    if (payload.code === "possible_duplicate") showDuplicateWarning(payload);
                }
            }
            return response;
        } catch (error) {
            if (isParkingGet) return cachedResponse() || Promise.reject(error);
            if (method === "POST" && parkingId && typeof init.body === "string") {
                const parking = parkingById.get(parkingId) || snapshot()?.payload?.parkings?.find(
                    (item) => Number(item.id) === parkingId,
                );
                if (parking) {
                    queueVerification(url, init.body, parkingId);
                    return queuedVerificationResponse(parking);
                }
            }
            throw error;
        }
    };

    async function flushQueue() {
        if (!navigator.onLine) return;
        const queue = getJson(KEYS.verificationQueue, []);
        if (!queue.length) return;
        const remaining = [];
        let sent = 0;
        for (const item of queue) {
            try {
                const response = await nativeFetch(item.url, {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "X-CSRFToken": csrfToken(),
                    },
                    body: item.body,
                });
                if (response.ok) {
                    updateCachedParking((await response.json()).parking);
                    sent += 1;
                } else if (response.status !== 409) {
                    remaining.push(item);
                }
            } catch (_error) {
                remaining.push(item);
            }
        }
        if (remaining.length) setJson(KEYS.verificationQueue, remaining);
        else remove(KEYS.verificationQueue);
        updateConnectionBanner(sent ? `${sent} verificación${sent === 1 ? "" : "es"} sincronizada${sent === 1 ? "" : "s"}.` : "");
    }

    function updateConnectionBanner(message = "") {
        let banner = document.getElementById("resilience-banner");
        if (!banner) {
            banner = document.createElement("div");
            banner.id = "resilience-banner";
            banner.className = "resilience-banner";
            banner.setAttribute("role", "status");
            banner.setAttribute("aria-live", "polite");
            document.querySelector(".parking-toolbar")?.appendChild(banner);
        }
        const queued = getJson(KEYS.verificationQueue, []).length;
        banner.classList.toggle("is-offline", !navigator.onLine);
        banner.classList.toggle("is-syncing", Boolean(message));
        banner.textContent = message || (!navigator.onLine
            ? `Sin conexión. Mostraremos datos guardados${queued ? ` y hay ${queued} aporte${queued === 1 ? "" : "s"} pendiente${queued === 1 ? "" : "s"}` : ""}.`
            : queued
                ? `${queued} verificación${queued === 1 ? "" : "es"} pendiente${queued === 1 ? "" : "s"} de sincronización.`
                : "Conexión disponible. La ubicación se solicita solo cuando tú la autorizas.");
    }

    function formDataObject(form) {
        const value = {};
        new FormData(form).forEach((item, key) => {
            value[key] = item;
        });
        return value;
    }

    function restoreForm(form, values) {
        Object.entries(values || {}).forEach(([name, value]) => {
            const control = form.elements.namedItem(name);
            if (!control) return;
            if (control instanceof RadioNodeList) {
                Array.from(control).forEach((item) => {
                    if (item.type === "checkbox" || item.type === "radio") item.checked = item.value === value || value === "on";
                });
            } else if (control.type === "checkbox") control.checked = value === true || value === "on";
            else control.value = value ?? "";
        });
    }

    function setupContributionDraft() {
        const form = document.getElementById("contribute-form");
        if (!form) return;
        restoreForm(form, getJson(KEYS.contributionDraft, {}));
        let timer = null;
        form.addEventListener("input", () => {
            clearTimeout(timer);
            timer = setTimeout(() => setJson(KEYS.contributionDraft, formDataObject(form)), 250);
        });
    }

    function showDuplicateWarning(payload) {
        const form = document.getElementById("contribute-form");
        if (!form) return;
        form.querySelector(".duplicate-warning")?.remove();
        const warning = document.createElement("section");
        warning.className = "duplicate-warning";
        warning.setAttribute("role", "alert");
        const title = document.createElement("h3");
        title.textContent = "Puede que este lugar ya exista";
        const copy = document.createElement("p");
        copy.textContent = "Revisa los registros cercanos para evitar información duplicada.";
        const list = document.createElement("ul");
        (payload.duplicates || []).forEach((item) => {
            const row = document.createElement("li");
            row.textContent = `${item.name} — ${item.location} (${item.distance_m} m)`;
            list.appendChild(row);
        });
        const actions = document.createElement("div");
        actions.className = "duplicate-warning__actions";
        const confirm = document.createElement("button");
        confirm.type = "button";
        confirm.className = "button button--primary";
        confirm.textContent = "Es un lugar distinto: enviar igualmente";
        confirm.addEventListener("click", () => {
            let field = form.elements.namedItem("confirm_duplicate");
            if (!field) {
                field = document.createElement("input");
                field.type = "hidden";
                field.name = "confirm_duplicate";
                form.appendChild(field);
            }
            field.value = "true";
            warning.remove();
            form.requestSubmit();
        });
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "button button--secondary";
        cancel.textContent = "Volver a revisar";
        cancel.addEventListener("click", () => warning.remove());
        actions.append(confirm, cancel);
        warning.append(title, copy, list, actions);
        form.querySelector(".dialog-actions")?.insertAdjacentElement("beforebegin", warning);
    }

    function savedIds() {
        return new Set(getJson(KEYS.savedPlaces, []).map(Number));
    }

    function toggleSaved(id) {
        const ids = savedIds();
        if (ids.has(id)) ids.delete(id);
        else ids.add(id);
        setJson(KEYS.savedPlaces, Array.from(ids));
        decorateCards();
        updateSavedButton();
    }

    function ensureSavedButton() {
        if (document.getElementById("saved-places-button")) return;
        const button = document.createElement("button");
        button.id = "saved-places-button";
        button.type = "button";
        button.className = "view-switch saved-places-button";
        button.addEventListener("click", openSavedPlaces);
        document.querySelector(".parking-view-switch")?.appendChild(button);
        updateSavedButton();
    }

    function updateSavedButton() {
        const button = document.getElementById("saved-places-button");
        if (!button) return;
        const count = savedIds().size;
        button.textContent = `Guardados${count ? ` (${count})` : ""}`;
    }

    function ensureSavedDialog() {
        let dialog = document.getElementById("saved-places-dialog");
        if (dialog) return dialog;
        dialog = document.createElement("dialog");
        dialog.id = "saved-places-dialog";
        dialog.className = "inclume-dialog";
        dialog.setAttribute("aria-labelledby", "saved-places-title");
        dialog.innerHTML = '<div class="dialog-header"><div><span class="status-chip">Solo en este dispositivo</span><h2 id="saved-places-title">Lugares guardados</h2></div><button class="icon-button" type="button" aria-label="Cerrar">×</button></div><div id="saved-places-list" class="saved-places-list"></div>';
        dialog.querySelector("button").addEventListener("click", () => dialog.close());
        document.body.appendChild(dialog);
        return dialog;
    }

    function genericNavigationUrl(parking) {
        const destination = `${parking.latitude},${parking.longitude}`;
        if (/Android/i.test(navigator.userAgent)) return `geo:${destination}?q=${destination}`;
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return `https://maps.apple.com/?daddr=${destination}&dirflg=d`;
        return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    }

    function openSavedPlaces() {
        const dialog = ensureSavedDialog();
        const container = dialog.querySelector("#saved-places-list");
        container.replaceChildren();
        const saved = Array.from(savedIds()).map((id) => parkingById.get(id)).filter(Boolean);
        if (!saved.length) {
            const empty = document.createElement("p");
            empty.className = "saved-places-empty";
            empty.textContent = "Aún no guardas lugares. Usa Guardar en una opción.";
            container.appendChild(empty);
        }
        saved.forEach((parking) => {
            const article = document.createElement("article");
            article.className = "saved-place";
            const title = document.createElement("h3");
            title.textContent = parking.name;
            const locationText = document.createElement("p");
            locationText.textContent = parking.location;
            const actions = document.createElement("div");
            actions.className = "saved-place__actions";
            const navigate = document.createElement("a");
            navigate.className = "button button--primary";
            navigate.href = genericNavigationUrl(parking);
            navigate.textContent = "Cómo llegar";
            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "button button--secondary";
            removeButton.textContent = "Quitar";
            removeButton.addEventListener("click", () => {
                toggleSaved(Number(parking.id));
                openSavedPlaces();
            });
            actions.append(navigate, removeButton);
            article.append(title, locationText, actions);
            container.appendChild(article);
        });
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
    }

    function relativeDate(value) {
        if (!value) return "sin fecha";
        const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
        if (minutes < 60) return `hace ${minutes || 1} min`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `hace ${hours} h`;
        const days = Math.round(hours / 24);
        return `hace ${days} ${days === 1 ? "día" : "días"}`;
    }

    function decorateCards() {
        const ids = savedIds();
        document.querySelectorAll(".parking-card[data-parking-id]").forEach((card) => {
            const id = Number(card.dataset.parkingId);
            const parking = parkingById.get(id);
            const actions = card.querySelector(".parking-card__actions");
            let save = actions?.querySelector(".save-place-button");
            if (actions && !save) {
                save = document.createElement("button");
                save.type = "button";
                save.className = "button button--secondary save-place-button";
                save.addEventListener("click", () => toggleSaved(id));
                actions.appendChild(save);
            }
            if (save) {
                save.textContent = ids.has(id) ? "Guardado" : "Guardar";
                save.setAttribute("aria-pressed", String(ids.has(id)));
            }
            card.querySelector(".parking-card__issue")?.remove();
            if (parking?.availability_signal === "issue_reported") {
                const issue = document.createElement("div");
                issue.className = "parking-card__issue";
                issue.setAttribute("role", "note");
                const strong = document.createElement("strong");
                strong.textContent = "Incidencia reciente";
                const detail = document.createElement("span");
                detail.textContent = `${parking.last_issue_type_label}. Último reporte ${relativeDate(parking.last_reported_at)}.`;
                issue.append(strong, detail);
                actions?.insertAdjacentElement("beforebegin", issue);
            }
        });
    }

    async function shareParking(parking) {
        const url = new URL(location.href);
        url.searchParams.set("parking", String(parking.id));
        url.hash = "";
        const data = { title: `${parking.name} | IncluMe`, text: `${parking.name} — ${parking.location}`, url: url.toString() };
        if (navigator.share) return navigator.share(data);
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(data.url);
        else window.prompt("Copia este enlace", data.url);
        document.getElementById("parking-status").textContent = "Enlace del estacionamiento copiado.";
    }

    function decorateDetail() {
        const actions = document.querySelector("#detail-content .detail-actions");
        if (!actions || actions.querySelector(".share-place-button")) return;
        const parking = parkingById.get(Number(selectedParkingId));
        if (!parking) return;
        const share = document.createElement("button");
        share.type = "button";
        share.className = "button button--secondary share-place-button";
        share.textContent = "Compartir";
        share.addEventListener("click", () => shareParking(parking).catch(() => {}));
        actions.appendChild(share);
    }

    function handleDeepLink() {
        const id = Number(new URL(location.href).searchParams.get("parking"));
        const card = id ? document.querySelector(`.parking-card[data-parking-id="${id}"]`) : null;
        if (!card || card.dataset.deepLinkOpened) return;
        card.dataset.deepLinkOpened = "true";
        selectedParkingId = id;
        card.querySelector(".parking-card__actions .button")?.click();
        card.scrollIntoView({ block: "center" });
    }

    function observeApp() {
        const list = document.getElementById("parking-list");
        const detail = document.getElementById("detail-content");
        if (list) new MutationObserver(() => {
            decorateCards();
            handleDeepLink();
        }).observe(list, { childList: true, subtree: true });
        if (detail) new MutationObserver(decorateDetail).observe(detail, { childList: true, subtree: true });
        document.addEventListener("click", (event) => {
            const card = event.target.closest?.(".parking-card[data-parking-id]");
            if (card) selectedParkingId = Number(card.dataset.parkingId);
        }, true);
    }

    function registerWorker() {
        if (!("serviceWorker" in navigator)) return;
        window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch(() => {}));
    }

    snapshot();
    ensureSavedButton();
    ensureSavedDialog();
    setupContributionDraft();
    observeApp();
    updateConnectionBanner();
    registerWorker();

    window.addEventListener("online", () => {
        updateConnectionBanner();
        flushQueue();
    });
    window.addEventListener("offline", updateConnectionBanner);
    window.addEventListener("inclume:parkings", (event) => {
        indexPayload(event.detail.payload);
        setTimeout(() => {
            decorateCards();
            handleDeepLink();
            if (event.detail.source === "cache") {
                document.getElementById("parking-status").textContent = "Mostrando la última información guardada en este dispositivo.";
            }
        }, 30);
    });

    if (navigator.onLine) flushQueue();
})();
