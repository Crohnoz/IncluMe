from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "preview-v2"
DESTINATION = ROOT / "netlify-ciudadania-dist"


def build() -> None:
    if DESTINATION.exists():
        shutil.rmtree(DESTINATION)
    shutil.copytree(SOURCE, DESTINATION)

    municipal = DESTINATION / "municipalidades.html"
    if municipal.exists():
        municipal.unlink()

    index = DESTINATION / "index.html"
    html = index.read_text(encoding="utf-8")
    html = html.replace("../static/", "static/")
    html = html.replace("Preview funcional · Chile", "Beta pública · Chile")
    html = html.replace(
        '<button class="button button--quiet" id="accessibility-open"',
        '<a class="button button--secondary" href="/feedback/">Reportar o corregir</a>\n      <button class="button button--quiet" id="accessibility-open"',
        1,
    )
    index.write_text(html, encoding="utf-8")

    feedback_dir = DESTINATION / "feedback"
    feedback_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "netlify" / "citizen-feedback.html", feedback_dir / "index.html")

    thanks_dir = DESTINATION / "gracias"
    thanks_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "netlify" / "thanks-citizen.html", thanks_dir / "index.html")

    feedback = (feedback_dir / "index.html").read_text(encoding="utf-8")
    assert 'data-netlify="true"' in feedback
    assert 'netlify-honeypot="bot-field"' in feedback
    assert 'name="form-name" value="reporte-ciudadano"' in feedback


if __name__ == "__main__":
    build()
