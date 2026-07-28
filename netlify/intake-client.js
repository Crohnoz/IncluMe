(() => {
  "use strict";

  const ENDPOINT = "https://azdrxkabzldwcmotzaor.supabase.co/functions/v1/inclume-intake";
  const form = document.querySelector("form[data-intake-kind]");
  if (!form) return;

  const status = document.querySelector("[data-intake-status]");
  const submitButton = form.querySelector('button[type="submit"]');
  let fallbackButton = null;

  const setStatus = (message, isError = false) => {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = isError ? "error" : "ok";
    status.focus?.();
  };

  const enableSubmit = () => {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
    }
  };

  const showFallback = () => {
    if (fallbackButton) return;
    fallbackButton = document.createElement("button");
    fallbackButton.type = "button";
    fallbackButton.className = "button secondary";
    fallbackButton.textContent = "Enviar por canal alternativo";
    fallbackButton.addEventListener("click", () => {
      form.dataset.nativeSubmit = "true";
      fallbackButton.disabled = true;
      setStatus("Enviando mediante el canal alternativo…");
      form.submit();
    });
    submitButton?.insertAdjacentElement("afterend", fallbackButton);
  };

  form.addEventListener("submit", async (event) => {
    if (form.dataset.nativeSubmit === "true") return;
    event.preventDefault();

    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.kind = form.dataset.intakeKind;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");
    }
    setStatus("Guardando el envío de forma segura…");

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        const detail = Array.isArray(data.errors) ? ` ${data.errors.join(" ")}` : "";
        throw new Error(`${data.message || "No fue posible guardar el envío."}${detail}`.trim());
      }

      const destination = new URL(form.action, window.location.origin);
      if (data.reference) destination.searchParams.set("ref", data.reference);
      window.location.assign(destination.toString());
    } catch (error) {
      enableSubmit();
      const message = error instanceof Error ? error.message : "No fue posible guardar el envío.";
      setStatus(`${message} Puedes reintentar o usar el canal alternativo.`, true);
      showFallback();
    }
  });
})();
