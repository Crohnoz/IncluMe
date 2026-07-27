# IncluMe — roadmap de producto

## Norte del producto

IncluMe debe ayudar a elegir y utilizar un estacionamiento accesible con menos esfuerzo y menor incertidumbre. La expansión a otros tipos de accesibilidad se realizará después de validar este núcleo.

## Hito 1 — Vertical slice funcional

- [x] Modelo georreferenciado y criterios observables.
- [x] API pública de estacionamientos publicados.
- [x] Geolocalización solicitada por acción explícita.
- [x] Orden por menor esfuerzo, confianza o cercanía.
- [x] Preferencias funcionales guardadas localmente.
- [x] Lista y mapa equivalentes.
- [x] Plan B compatible.
- [x] Selector de Waze, Google Maps, Apple Maps o app compatible.
- [x] Verificación rápida comunitaria.
- [x] Aporte anónimo retenido para moderación.
- [x] Diseño responsive y texto grande.
- [x] CI básico.

## Hito 2 — Calidad de datos

- [ ] Flujo administrativo para aceptar, fusionar o rechazar aportes.
- [ ] Detección de duplicados por proximidad y nombre.
- [ ] Evidencia fotográfica con almacenamiento seguro.
- [ ] Difuminado de rostros y patentes antes de publicar.
- [ ] Historial de cambios visible.
- [ ] Puntaje de confianza con decaimiento temporal.
- [ ] Verificación institucional diferenciada.

## Hito 3 — Búsqueda y operación

- [ ] Geocodificación de destinos con proveedor respetuoso de cuotas y privacidad.
- [ ] Búsqueda por radio desde ubicación o destino.
- [ ] Entrada accesible georreferenciada y recorrido peatonal corto.
- [ ] Lugares guardados y recientes sin historial sensible.
- [ ] Funcionamiento offline parcial y borradores sincronizables.
- [ ] Notificaciones opcionales para verificar después de utilizar el lugar.

## Hito 4 — Validación real

- [ ] Pruebas con usuarios de silla manual y eléctrica.
- [ ] Personas con bastón, andador, dolor o fatiga.
- [ ] Baja visión y lectores de pantalla.
- [ ] Dificultad motora de manos y uso por voz.
- [ ] Conductores y acompañantes.
- [ ] Objetivo: encontrar opción en ≤45 s, cero errores de entrada y confianza ≥4/5.

## Hito 5 — Expansión controlada

- [ ] Baños accesibles.
- [ ] Rampas, ascensores y entradas alternativas.
- [ ] Rutas interiores y lugares de descanso.
- [ ] Paneles para municipios, clínicas y comercios.
- [ ] API pública documentada.

## Riesgos actuales antes de producción

1. Render declara una rama que no coincide con la historia principal del repositorio.
2. Se debe revocar o restringir la clave de Google Maps expuesta en commits antiguos.
3. El proveedor de tiles debe configurarse para carga de producción y SLA adecuado.
4. Falta almacenamiento y moderación de fotografías.
5. La disponibilidad continúa siendo comunitaria, no tiempo real.
