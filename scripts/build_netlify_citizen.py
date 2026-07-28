from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "preview-v2"
DESTINATION = ROOT / "netlify-ciudadania-dist"
CATALOG_ENDPOINT = "https://azdrxkabzldwcmotzaor.supabase.co/functions/v1/inclume-catalog"
INTAKE_ENDPOINT = "https://azdrxkabzldwcmotzaor.supabase.co/functions/v1/inclume-intake"


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"No se pudo aplicar {label}: se esperó 1 coincidencia y se encontraron {count}.")
    return content.replace(old, new, 1)


def patch_public_html() -> None:
    index = DESTINATION / "index.html"
    html = index.read_text(encoding="utf-8")
    html = html.replace("../static/", "static/")
    html = html.replace("Preview funcional · Chile", "Beta pública · Chile")
    html = replace_once(
        html,
        '<button class="button button--quiet" id="accessibility-open"',
        '<a class="button button--secondary" href="/feedback/">Reportar o corregir</a>\n      <button class="button button--quiet" id="accessibility-open"',
        "el acceso ciudadano a reportes",
    )
    html = replace_once(
        html,
        '''        <label class="field">
          <span>Nombre o destino</span>
          <input name="name" maxlength="120" required placeholder="Ej.: Hospital Regional de Temuco">
        </label>
        <label class="field">
          <span>Referencia exacta</span>''',
        '''        <label class="field">
          <span>Nombre o destino</span>
          <input name="name" maxlength="120" required placeholder="Ej.: Hospital Regional de Temuco">
        </label>
        <label class="field">
          <span>Comuna</span>
          <input name="commune" maxlength="80" required autocomplete="address-level2" placeholder="Ej.: Temuco">
        </label>
        <label class="field">
          <span>Referencia exacta</span>''',
        "el campo comuna del geotag",
    )
    html = html.replace(
        "Esta preview guarda el punto solamente en tu navegador. En la aplicación real quedará pendiente de moderación antes de publicarse.",
        "IncluMe enviará el punto a revisión y conservará una copia local si la red no está disponible. Nunca se publica automáticamente.",
    )
    index.write_text(html, encoding="utf-8")


def patch_public_javascript() -> None:
    script_path = DESTINATION / "app-v4.js"
    script = script_path.read_text(encoding="utf-8")

    script = replace_once(
        script,
        '  const NUDGE_STEP = 0.0001;\n',
        f'''  const NUDGE_STEP = 0.0001;
  const CATALOG_ENDPOINT = "{CATALOG_ENDPOINT}";
  const INTAKE_ENDPOINT = "{INTAKE_ENDPOINT}";
''',
        "los endpoints persistentes",
    )
    script = replace_once(
        script,
        '''  const state = {
    localPoints: readJson(STORAGE_KEY, []),
    preferences: readJson(PREFERENCES_KEY, DEFAULT_PREFERENCES),''',
        '''  const state = {
    localPoints: readJson(STORAGE_KEY, []),
    remotePoints: [],
    catalogLoaded: false,
    preferences: readJson(PREFERENCES_KEY, DEFAULT_PREFERENCES),''',
        "el estado del catálogo",
    )
    script = replace_once(
        script,
        '''  function allPoints() {
    return [...state.localPoints, ...demoPoints];
  }

  function insideChile''',
        '''  function allPoints() {
    const reviewedCatalog = state.remotePoints.length ? state.remotePoints : demoPoints;
    return [...state.localPoints, ...reviewedCatalog];
  }

  async function loadRemoteCatalog() {
    try {
      const response = await fetch(CATALOG_ENDPOINT, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !Array.isArray(payload.points)) {
        throw new Error(payload.message || "No fue posible cargar el catálogo revisado.");
      }
      state.remotePoints = payload.points.filter((point) => insideChile(point.latitude, point.longitude));
      state.catalogLoaded = true;
      render();
      if (state.remotePoints.length) {
        setStatus(`${state.remotePoints.length} ${state.remotePoints.length === 1 ? "punto revisado cargado" : "puntos revisados cargados"}. Los aportes locales continúan visibles en este navegador.`);
      } else {
        setStatus("El catálogo revisado aún no tiene puntos publicados. Mostramos datos demo claramente identificados para probar la aplicación.");
      }
    } catch (_error) {
      state.catalogLoaded = false;
      render();
      setStatus("No pudimos actualizar el catálogo. Se muestran los aportes locales y los puntos demo disponibles.");
    }
  }

  function reportObservation(point) {
    if (point.notes && point.notes.trim().length >= 10) return point.notes.trim();
    return `Aporte georreferenciado desde el mapa. ${transferLabel(point.transferSide)}. ${routeLabel(point.stepFree)}.`;
  }

  async function submitPointReport(point) {
    const payload = {
      kind: "citizen_report",
      tipo: "Nuevo estacionamiento",
      comuna: point.commune,
      lugar: point.name,
      referencia: point.location,
      latitud: point.latitude,
      longitud: point.longitude,
      observacion: reportObservation(point),
      declaracion: "confirmado",
      "bot-field": "",
    };

    try {
      const response = await fetch(INTAKE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const detail = Array.isArray(result.errors) ? ` ${result.errors.join(" ")}` : "";
        throw new Error(`${result.message || "No fue posible enviar el aporte."}${detail}`.trim());
      }
      point.synced = true;
      point.publicReference = result.reference || "RECIBIDO";
      point.syncError = "";
      writeJson(STORAGE_KEY, state.localPoints);
      render();
      showToast(`Aporte enviado a revisión. Referencia ${point.publicReference}.`);
    } catch (error) {
      point.synced = false;
      point.syncError = error instanceof Error ? error.message : "No fue posible enviar el aporte.";
      writeJson(STORAGE_KEY, state.localPoints);
      render();
      showToast("El punto quedó guardado localmente. Se podrá reenviar cuando exista conexión.");
    }
  }

  function insideChile''',
        "la carga y envío persistentes",
    )
    script = replace_once(
        script,
        '''        `badge${point.pending ? " badge--pending" : point.demo ? " badge--warning" : ""}`,
        point.pending ? "Pendiente local" : point.demo ? "Dato demo no verificado" : "Comunitario",''',
        '''        `badge${point.pending ? " badge--pending" : point.demo ? " badge--warning" : ""}`,
        point.pending
          ? point.synced ? "Enviado a revisión" : "Pendiente local"
          : point.demo ? "Dato demo no verificado" : "Catálogo revisado",''',
        "los estados de las tarjetas",
    )
    script = replace_once(
        script,
        '''    elements.detailStatus.textContent = point.pending ? "Pendiente local" : "Dato demo no verificado";''',
        '''    elements.detailStatus.textContent = point.pending
      ? point.synced ? "Enviado a revisión" : "Pendiente local"
      : point.demo ? "Dato demo no verificado" : "Catálogo revisado";''',
        "el estado del detalle",
    )
    script = replace_once(
        script,
        '''      id: `local-${Date.now()}`,
      name: String(data.get("name") || "Estacionamiento accesible pendiente").trim(),
      location: String(data.get("location") || "Sin referencia").trim(),''',
        '''      id: `local-${Date.now()}`,
      name: String(data.get("name") || "Estacionamiento accesible pendiente").trim(),
      commune: String(data.get("commune") || "Sin comuna").trim(),
      location: String(data.get("location") || "Sin referencia").trim(),''',
        "la comuna del aporte local",
    )
    script = replace_once(
        script,
        '''      pending: true,
      demo: false,
    };''',
        '''      pending: true,
      demo: false,
      synced: false,
      publicReference: "",
      syncError: "",
    };''',
        "el estado de sincronización del aporte",
    )
    script = replace_once(
        script,
        '''    showToast(persisted
      ? "Punto guardado en este navegador como aporte pendiente."
      : "Punto visible en esta sesión, pero el navegador bloqueó el guardado local.");
  }''',
        '''    showToast(persisted
      ? "Punto guardado localmente. Intentando enviarlo a revisión…"
      : "Punto visible en esta sesión. Intentando enviarlo a revisión…");
    submitPointReport(point);
  }''',
        "el envío del geotag a moderación",
    )
    script = replace_once(
        script,
        '''  render();
})();''',
        '''  render();
  loadRemoteCatalog();
})();''',
        "la carga inicial del catálogo",
    )

    script_path.write_text(script, encoding="utf-8")


def build() -> None:
    if DESTINATION.exists():
        shutil.rmtree(DESTINATION)
    shutil.copytree(SOURCE, DESTINATION)

    municipal = DESTINATION / "municipalidades.html"
    if municipal.exists():
        municipal.unlink()

    patch_public_html()
    patch_public_javascript()

    feedback_dir = DESTINATION / "feedback"
    feedback_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "netlify" / "citizen-feedback.html", feedback_dir / "index.html")
    shutil.copy2(ROOT / "netlify" / "intake-client.js", DESTINATION / "intake-client.js")

    thanks_dir = DESTINATION / "gracias"
    thanks_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "netlify" / "thanks-citizen.html", thanks_dir / "index.html")

    feedback = (feedback_dir / "index.html").read_text(encoding="utf-8")
    assert 'data-netlify="true"' in feedback
    assert 'netlify-honeypot="bot-field"' in feedback
    assert 'name="form-name" value="reporte-ciudadano"' in feedback
    assert 'data-intake-kind="citizen_report"' in feedback
    assert '/intake-client.js' in feedback
    assert (DESTINATION / "intake-client.js").exists()

    public_html = (DESTINATION / "index.html").read_text(encoding="utf-8")
    public_js = (DESTINATION / "app-v4.js").read_text(encoding="utf-8")
    assert 'name="commune"' in public_html
    assert CATALOG_ENDPOINT in public_js
    assert INTAKE_ENDPOINT in public_js
    assert "loadRemoteCatalog" in public_js
    assert "submitPointReport" in public_js
    assert 'data.get("commune")' in public_js


if __name__ == "__main__":
    build()
