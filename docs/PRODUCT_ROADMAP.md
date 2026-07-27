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

## Hito 2 — Calidad y confianza de los datos

- [x] Separar confirmaciones positivas de incidencias.
- [x] Señal temporal de incidencia reciente sin prometer disponibilidad en tiempo real.
- [x] Evitar verificaciones repetidas mediante identificador irreversible por sesión y ventana temporal.
- [x] Detectar posibles duplicados por proximidad antes de crear un aporte.
- [x] Exponer incidencias y agregados de confianza en Django Admin.
- [x] Flujo administrativo para aceptar, editar, reabrir, fusionar o rechazar aportes.
- [x] Historial editorial inmutable con actor, fecha, motivo y snapshot de cambios.
- [x] Fusión segura que conserva verificaciones, evita fingerprints duplicados y enlaza el registro canónico.
- [ ] Evidencia fotográfica con almacenamiento seguro.
- [ ] Difuminado de rostros y patentes antes de publicar.
- [ ] Historial de cambios visible para usuarios públicos.
- [ ] Puntaje de confianza calibrado y validado con usuarios.
- [ ] Verificación institucional diferenciada.

## Hito 3 — Chile y geotagging

- [x] Mapa inicial centrado en Chile.
- [x] Paleta cartográfica neutral para reducir sobrecarga visual.
- [x] Modo “Marcar en el mapa” desde la vista principal.
- [x] Selector cartográfico dentro del formulario de aporte.
- [x] Marcador arrastrable sincronizado con latitud y longitud.
- [x] Geolocalización del dispositivo para proponer un punto.
- [x] Marcador local pendiente mientras el aporte espera moderación.
- [x] Preview funcional de Chile con puntos guardados localmente.
- [x] Geocodificación real de destinos chilenos mediante búsqueda explícita, caché y límites de uso.
- [x] Búsqueda por radio desde un destino, limitada a registros aprobados.
- [ ] Catálogo inicial con estacionamientos reales y evidencia moderada.

## Hito 4 — Búsqueda y operación resiliente

- [x] Entrada accesible georreferenciada y recorrido peatonal corto como dato estructurado.
- [x] Lugares guardados en el dispositivo sin historial de desplazamiento.
- [x] Enlaces compartibles hacia un estacionamiento concreto.
- [x] Caché de la última lista pública y navegación básica sin conexión.
- [x] Borradores de aportes y verificaciones encoladas para sincronización.
- [x] Base PWA instalable y service worker de alcance global.
- [x] Readiness endpoint para aplicación y base de datos.
- [x] Animaciones accesibles con preferencia de reducción de movimiento.
- [x] Arquitectura de despliegue costo cero preparada con Render Free y PostgreSQL externo persistente.
- [x] Bootstrap administrativo idempotente mediante variables secretas.
- [ ] Notificaciones opcionales para verificar después de utilizar el lugar.
- [ ] Sincronización visible y editable de la cola offline.

## Hito 5 — Piloto municipal visible

- [x] Página pública para gobiernos locales con métricas del catálogo aprobado.
- [x] Resumen agregado público sin datos personales.
- [x] Panel interno para filtrar cobertura, vigencia e incidencias.
- [x] Exportación CSV institucional con coordenadas y señales de confianza.
- [x] Demo municipal interactiva con datos ficticios y exportación local.
- [ ] Territorio estructurado por región, comuna y código oficial.
- [ ] Perfiles institucionales y permisos por municipalidad.
- [ ] Flujo para que una institución proponga correcciones firmadas.
- [ ] Informe imprimible por comuna y zona piloto.
- [ ] Acuerdo editorial y protocolo de respuesta a incidencias.

## Hito 6 — Validación real

- [ ] Pruebas con usuarios de silla manual y eléctrica.
- [ ] Personas con bastón, andador, dolor o fatiga.
- [ ] Baja visión y lectores de pantalla.
- [ ] Dificultad motora de manos y uso por voz.
- [ ] Conductores y acompañantes.
- [ ] Equipos municipales de discapacidad, tránsito y planificación.
- [ ] Objetivo: encontrar opción en ≤45 s, cero errores de entrada y confianza ≥4/5.

## Hito 7 — Expansión controlada

- [ ] Baños accesibles.
- [ ] Rampas, ascensores y entradas alternativas.
- [ ] Rutas interiores y lugares de descanso.
- [ ] Paneles para clínicas y comercios.
- [ ] API pública documentada.

## Riesgos actuales antes de producción

1. Render declara una rama que no coincide con la historia principal del repositorio.
2. Se debe revocar o restringir la clave de Google Maps expuesta en commits antiguos.
3. OpenStreetMap y Nominatim son servicios comunitarios best effort; el proveedor debe seguir siendo intercambiable.
4. Falta almacenamiento y moderación de fotografías.
5. La disponibilidad continúa siendo comunitaria, no tiempo real.
6. La cola offline depende del almacenamiento local del navegador y requiere pruebas en iOS/Android reales.
7. La detección de duplicados por radio debe evolucionar a PostGIS cuando aumente el volumen.
8. La política editorial ya está instrumentada, pero debe documentarse y probarse con un equipo real antes de producción.
9. Los puntos incluidos en la preview son ficticios y nunca deben presentarse como datos reales.
10. El plan gratuito de Render puede dormir; el primer acceso después de inactividad tendrá latencia de arranque.
11. El filtro territorial municipal todavía es textual; antes de un convenio debe migrarse a región y comuna estructuradas.
