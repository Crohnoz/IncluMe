(() => {
    "use strict";

    const STORAGE_KEY = "inclume.interface.preferences.v4";
    const DEFAULTS = {
        textScale: "standard",
        highContrast: false,
        reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        mapStyle: "vivid",
        spacing: "standard",
    };

    const dialog = document.getElementById("accessibility-dialog");
    const openButton = document.getElementById("accessibility-button");
    const form = document.getElementById("accessibility-form");
    const resetButton = document.getElementById("accessibility-reset");
    const closeButtons = document.querySelectorAll("[data-close-accessibility]");
    if (!dialog || !openButton || !form) return;

    function readPreferences() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            return stored && typeof stored === "object" ? { ...DEFAULTS, ...stored } : { ...DEFAULTS };
        } catch (_error) {
            return { ...DEFAULTS };
        }
    }

    function writePreferences(preferences) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
        } catch (_error) {
            // The controls still apply for the current session when storage is unavailable.
        }
    }

    function applyPreferences(preferences) {
        document.body.dataset.textScale = preferences.textScale;
        document.body.dataset.highContrast = String(Boolean(preferences.highContrast));
        document.body.dataset.mapStyle = preferences.mapStyle;
        document.body.dataset.spacing = preferences.spacing;
        document.documentElement.dataset.reduceMotion = String(Boolean(preferences.reduceMotion));

        openButton.setAttribute(
            "aria-label",
            preferences.highContrast || preferences.textScale !== "standard" || preferences.reduceMotion
                ? "Accesibilidad, preferencias personalizadas activas"
                : "Abrir preferencias de accesibilidad",
        );
    }

    function populateForm(preferences) {
        form.elements.textScale.value = preferences.textScale;
        form.elements.highContrast.checked = Boolean(preferences.highContrast);
        form.elements.reduceMotion.checked = Boolean(preferences.reduceMotion);
        form.elements.mapStyle.value = preferences.mapStyle;
        form.elements.comfortableSpacing.checked = preferences.spacing === "comfortable";
    }

    function preferencesFromForm() {
        return {
            textScale: form.elements.textScale.value,
            highContrast: form.elements.highContrast.checked,
            reduceMotion: form.elements.reduceMotion.checked,
            mapStyle: form.elements.mapStyle.value,
            spacing: form.elements.comfortableSpacing.checked ? "comfortable" : "standard",
        };
    }

    function openDialog() {
        populateForm(readPreferences());
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
    }

    function closeDialog() {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
        openButton.focus();
    }

    let preferences = readPreferences();
    applyPreferences(preferences);

    openButton.addEventListener("click", openDialog);
    form.addEventListener("change", () => {
        preferences = preferencesFromForm();
        writePreferences(preferences);
        applyPreferences(preferences);
    });
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        preferences = preferencesFromForm();
        writePreferences(preferences);
        applyPreferences(preferences);
        closeDialog();
    });
    resetButton?.addEventListener("click", () => {
        preferences = { ...DEFAULTS };
        writePreferences(preferences);
        populateForm(preferences);
        applyPreferences(preferences);
    });
    closeButtons.forEach((button) => button.addEventListener("click", closeDialog));
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeDialog();
    });
})();
