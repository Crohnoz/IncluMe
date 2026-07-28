# IncluMe — instrucciones para agentes de desarrollo

Antes de modificar este repositorio, lee y aplica:

- `.agents/skills/inclume-product-engineering/SKILL.md`
- `docs/PRODUCT_ROADMAP.md`

## Regla principal

IncluMe no es un mapa genérico. Es una herramienta de decisión para personas con discapacidad y movilidad reducida. Cada cambio debe reducir esfuerzo, incertidumbre o riesgo sin exigir que la persona revele un diagnóstico.

## Flujo obligatorio

1. Inspecciona el código y el comportamiento existente.
2. Explica el problema en términos de usuario y riesgo.
3. Implementa una porción vertical pequeña pero completa.
4. Mantén lista y mapa funcionalmente equivalentes.
5. Agrega o actualiza pruebas.
6. Ejecuta `python manage.py check`, `python manage.py test` y validación de sintaxis JS.
7. Documenta decisiones, límites y pasos de despliegue.
8. Trabaja en una rama; no despliegues ni fusiones sin autorización explícita.

## No negociables

- WCAG 2.2 AA como mínimo.
- Mobile first, teclado, lector de pantalla, texto ampliado y movimiento reducido.
- Objetivos táctiles de 44 px como mínimo; 48 px preferidos.
- Ningún dato comunitario se presenta como disponibilidad garantizada.
- No almacenar diagnósticos, credenciales, patentes, rostros ni historial de desplazamiento por defecto.
- Las contribuciones anónimas requieren moderación antes de publicarse.
