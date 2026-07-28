from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "netlify-municipal-dist"

FORM_STYLES = """
<style>
.pilot-request{background:linear-gradient(135deg,#eef7ff,#fbf8ff 52%,#effcf8)}.pilot-card{background:#fff;border:1px solid var(--line);border-radius:24px;padding:clamp(1.2rem,4vw,2rem);box-shadow:0 20px 55px rgba(11,37,80,.1)}.pilot-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}.pilot-card textarea{width:100%;min-height:130px;border:2px solid #b8c9de;border-radius:12px;padding:.7rem .8rem;font:inherit;background:#fff;resize:vertical}.pilot-card input,.pilot-card select{width:100%;min-height:48px;border:2px solid #b8c9de;border-radius:12px;padding:.65rem .8rem;font:inherit;background:#fff}.pilot-card input:focus,.pilot-card select:focus,.pilot-card textarea:focus{outline:4px solid #ffd463;outline-offset:2px;border-color:var(--blue)}.pilot-check{display:flex;align-items:flex-start;gap:.7rem;margin-top:1rem}.pilot-check input{width:22px;height:22px;min-height:22px}.pilot-note{background:#fff5dc;border:1px solid #edca79;color:#633b00;padding:.9rem 1rem;border-radius:14px}.honeypot{position:absolute;left:-9999px}.intake-status{min-height:1.5rem;color:var(--teal);font-weight:700}.intake-status[data-state="error"]{color:#9d2f26}.pilot-card button[disabled]{opacity:.65;cursor:wait}@media(max-width:680px){.pilot-grid{grid-template-columns:1fr}}
</style>
"""

FORM_SECTION = """
<section class="section pilot-request" id="solicitar-piloto"><div class="shell"><div class="section-head"><div><span class="eyebrow">Conversación institucional</span><h2>Solicita una evaluación de piloto municipal.</h2></div><p>Sin costo de licencia durante la etapa de exploración.</p></div><div class="pilot-card"><p>Indica el territorio y el problema que el equipo necesita observar. IncluMe no solicita diagnósticos ni credenciales de discapacidad.</p><div class="pilot-note" role="note"><strong>No incluyas datos sensibles de vecinos, pacientes o funcionarios.</strong> Esta solicitud sirve únicamente para coordinar una conversación institucional.</div><form name="solicitud-piloto-municipal" method="POST" action="/gracias/" data-netlify="true" netlify-honeypot="bot-field" data-intake-kind="municipal_request"><input type="hidden" name="form-name" value="solicitud-piloto-municipal"><p class="honeypot"><label>No completes este campo: <input name="bot-field" tabindex="-1" autocomplete="off"></label></p><div class="pilot-grid"><label class="field"><span>Municipalidad u organización</span><input name="institucion" maxlength="160" required autocomplete="organization"></label><label class="field"><span>Comuna o territorio</span><input name="territorio" maxlength="100" required autocomplete="address-level2"></label><label class="field"><span>Nombre de contacto</span><input name="nombre" maxlength="120" required autocomplete="name"></label><label class="field"><span>Cargo o unidad</span><input name="cargo" maxlength="140" required autocomplete="organization-title"></label><label class="field"><span>Correo institucional</span><input name="email" type="email" maxlength="180" required autocomplete="email"></label><label class="field"><span>Teléfono (opcional)</span><input name="telefono" type="tel" maxlength="40" autocomplete="tel"></label></div><label class="field"><span>Objetivo inicial</span><select name="objetivo" required><option value="">Selecciona</option><option>Catastro de estacionamientos accesibles</option><option>Validación ciudadana de datos</option><option>Revisión de rutas y entradas accesibles</option><option>Panel territorial y exportación</option><option>Otro piloto de accesibilidad urbana</option></select></label><label class="field"><span>¿Qué problema territorial quieren resolver?</span><textarea name="descripcion" minlength="20" maxlength="1800" required></textarea></label><label class="pilot-check"><input name="consentimiento" type="checkbox" required value="acepto"><span>Acepto que IncluMe use estos datos para responder esta solicitud y coordinar una reunión exploratoria.</span></label><p class="intake-status" data-intake-status role="status" aria-live="polite" tabindex="-1"></p><div class="actions"><button class="button primary" type="submit">Enviar solicitud</button><a class="button secondary" href="https://inclume-chile.netlify.app/">Ver aplicación ciudadana</a></div></form></div></div></section>
"""


def build() -> None:
    if DESTINATION.exists():
        shutil.rmtree(DESTINATION)
    (DESTINATION / "static" / "images").mkdir(parents=True, exist_ok=True)

    source = ROOT / "preview-v2" / "municipalidades.html"
    html = source.read_text(encoding="utf-8")
    html = html.replace("href=\"index.html\"", 'href="https://inclume-chile.netlify.app/"')
    html = html.replace("</head>", FORM_STYLES + "\n</head>", 1)
    html = html.replace(
        '<div class="actions"><a class="button primary" href="#panel">Abrir panel demo</a>',
        '<div class="actions"><a class="button primary" href="#panel">Abrir panel demo</a><a class="button secondary" href="#solicitar-piloto">Solicitar piloto</a>',
        1,
    )
    html = html.replace('<section class="governance section">', FORM_SECTION + '\n<section class="governance section">', 1)
    html = html.replace("</body>", '<script src="/intake-client.js"></script>\n</body>', 1)
    (DESTINATION / "index.html").write_text(html, encoding="utf-8")

    shutil.copy2(
        ROOT / "preview-v2" / "static" / "images" / "inclume-app-icon.svg",
        DESTINATION / "static" / "images" / "inclume-app-icon.svg",
    )
    shutil.copy2(ROOT / "netlify" / "intake-client.js", DESTINATION / "intake-client.js")

    thanks_dir = DESTINATION / "gracias"
    thanks_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "netlify" / "thanks-municipal.html", thanks_dir / "index.html")

    built = (DESTINATION / "index.html").read_text(encoding="utf-8")
    assert 'data-netlify="true"' in built
    assert 'netlify-honeypot="bot-field"' in built
    assert 'name="form-name" value="solicitud-piloto-municipal"' in built
    assert 'data-intake-kind="municipal_request"' in built
    assert '/intake-client.js' in built
    assert (DESTINATION / "intake-client.js").exists()


if __name__ == "__main__":
    build()
