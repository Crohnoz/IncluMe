# IncluMe v4 — auditoría funcional y de accesibilidad

Fecha: 27 de julio de 2026  
Rama: `feature/parking-community-mvp`  
Estado: preview validada automáticamente; producción no modificada.

## 1. Alcance

Esta auditoría revisa el núcleo actual de IncluMe Estaciona:

- búsqueda y listado de estacionamientos;
- mapa de Chile y geotags;
- aporte comunitario moderado;
- coordenadas manuales y geolocalización;
- navegación externa;
- preferencias de presentación;
- diseño móvil, tablet y escritorio;
- estados de foco, movimiento, contraste, errores y persistencia;
- validación de servidor, CI, PWA y seguridad básica.

La auditoría utiliza WCAG 2.2 como referencia. No constituye una certificación formal de conformidad ni sustituye pruebas con personas usuarias y tecnologías asistivas.

## 2. Hallazgos corregidos

### 2.1 El mapa predeterminado estaba excesivamente desaturado

**Riesgo:** la interfaz se percibía monótona y la cartografía perdía reconocimiento visual.

**Corrección:**

- modo predeterminado más claro y colorido;
- modo simplificado opcional para reducir carga visual;
- azul para puntos mostrados;
- violeta para aportes pendientes;
- turquesa para ubicación de la persona;
- ámbar/coral exclusivamente para advertencias;
- estados expresados también mediante texto y forma.

### 2.2 Los recursos de geotag no estaban integrados de forma verificable en la página Django

**Riesgo:** el código existía, pero la aplicación real podía renderizar sin cargar el comportamiento de marcado.

**Corrección:** los estilos y scripts v4 se enlazan desde la plantilla base y una prueba Django comprueba que estén presentes.

### 2.3 Marcar un punto dependía demasiado del mapa o del arrastre

**Riesgo:** barrera para personas que utilizan teclado, voz, switch, trackball o presentan dificultad motora fina.

**Corrección:** ahora se puede definir el punto mediante:

- toque/clic en el mapa;
- ubicación del dispositivo;
- latitud y longitud editables;
- centro actual del mapa;
- botones Norte, Sur, Este y Oeste;
- arrastre opcional, nunca obligatorio;
- Escape para cancelar el modo de marcado.

### 2.4 Las coordenadas de Chile solo se validaban en cliente

**Riesgo:** una solicitud construida manualmente podía almacenar coordenadas fuera del alcance inicial.

**Corrección:** el formulario Django valida en servidor el estacionamiento y la entrada accesible dentro de límites amplios de Chile. Existe cobertura para aceptación dentro de Chile y rechazo fuera de Chile.

### 2.5 Existían dos controles de reducción de movimiento

**Riesgo:** preferencias contradictorias y una experiencia confusa.

**Corrección:** todas las preferencias visuales utilizan un único panel y almacenamiento local:

- texto estándar, grande o extra grande;
- alto contraste;
- mayor espaciado;
- reducción de movimiento;
- mapa colorido o simplificado.

El sistema también respeta `prefers-reduced-motion`.

### 2.6 Un contenedor recibía `aria-pressed`

**Riesgo:** semántica ARIA crítica incorrecta detectada por axe.

**Corrección:** solo los botones de vista reciben `aria-pressed`; el área de resultados mantiene semántica de sección.

### 2.7 Un distintivo de advertencia no alcanzaba contraste AA

**Riesgo:** texto pequeño con relación 3,73:1.

**Corrección:** se ajustó a texto `#6d3f00` sobre `#fff6df`, relación calculada aproximada 8,26:1.

### 2.8 El almacenamiento estático con manifiesto bloqueaba tests y desarrollo antes de `collectstatic`

**Riesgo:** la página de estacionamientos fallaba al renderizar fuera del despliegue productivo.

**Corrección:** desarrollo y CI usan `StaticFilesStorage`; producción conserva `CompressedManifestStaticFilesStorage`.

### 2.9 Contenido comunitario dinámico

**Riesgo:** insertar texto aportado mediante HTML dinámico dificulta controlar seguridad y semántica.

**Corrección:** la preview v4 construye nombres, referencias y observaciones con nodos DOM y `textContent`.

## 3. Sistema visual v4

La interfaz usa superficies cálidas y una paleta funcional:

| Rol | Color principal | Uso |
|---|---:|---|
| Acción | `#075fc4` | botones principales y puntos mostrados |
| Ubicación/éxito | `#007c70` | ubicación de la persona y señales positivas |
| Pendiente | `#6846bd` | aportes todavía no moderados |
| Advertencia | `#6d3f00` / ámbar | datos no verificados o incidencias |
| Error | coral oscuro | validación y problemas |
| Fondo | marfil y azul muy claro | reducir monotonía sin competir con el mapa |

Contrastes calculados de combinaciones esenciales:

- texto principal sobre blanco: 15,72:1;
- texto secundario sobre blanco: 7,02:1;
- blanco sobre azul principal: 6,10:1;
- blanco sobre turquesa: 5,10:1;
- blanco sobre violeta: 6,56:1;
- advertencia oscura sobre amarillo claro: 8,26:1.

## 4. Matriz de validación

| Función | Resultado automatizado | Validación manual pendiente |
|---|---|---|
| Página Django y recursos v4 | Aprobado | revisión visual en navegadores reales |
| Migraciones y `manage.py check` | Aprobado | ninguna |
| API y moderación de aportes | Aprobado | operación administrativa real |
| Geotag dentro de Chile | Aprobado | precisión GPS física |
| Rechazo fuera de Chile | Aprobado | casos limítrofes y territorios especiales |
| Búsqueda en lista | Aprobado en Chromium | Safari/iOS y Android WebView |
| Cambio lista/mapa móvil | Aprobado en 390 px | dispositivos con barras y safe areas diferentes |
| Crear geotag | Aprobado | toque en teléfono real |
| Persistir y eliminar punto local | Aprobado | almacenamiento privado/restringido en iOS |
| Coordenadas y botones sin arrastrar | Aprobado | uso con switch control y voz |
| Preferencias visuales | Aprobado y persistente | zoom 200–400% en dispositivos reales |
| Reducción de movimiento | Aprobado por estado y CSS | evaluación vestibular con usuarios |
| Axe: contenido principal | Sin violaciones serias o críticas | auditoría manual completa |
| Mapa equivalente a lista | Aprobado estructuralmente | VoiceOver, TalkBack, NVDA y JAWS |
| Geolocalización | Flujo y errores implementados | permisos GPS físicos |
| Google Maps/Waze | URL exacta implementada | apertura real en Android/iOS |
| Offline/PWA | sintaxis, manifiesto y caché aprobados | instalación y reconexión en teléfonos reales |
| Fotos y difuminado | No implementado | requisito futuro |

## 5. Pruebas automatizadas ejecutadas

### Django

- compilación de Python;
- migraciones sin cambios pendientes;
- `python manage.py check`;
- 16 pruebas Django;
- aceptación de coordenadas chilenas;
- rechazo de coordenadas fuera de Chile;
- moderación, duplicados, confianza, health check y service worker.

### JavaScript y preview

- validación de sintaxis de scripts productivos y preview;
- validación estructural de ambas previews;
- manifiesto PWA válido.

### Playwright + axe

Cinco escenarios en Chromium:

1. Escaneo axe sin violaciones serias o críticas en el contenido principal.
2. Preferencias de accesibilidad aplicadas y persistentes.
3. Crear, describir, persistir y eliminar un geotag chileno.
4. Ajustar coordenadas sin usar arrastre.
5. Buscar y cambiar entre lista y mapa en viewport móvil.

El mapa Leaflet interno se excluye del escaneo axe automático por contener controles de terceros. El contenedor propio del mapa sí se comprueba como región descrita, y la lista equivalente permanece dentro del análisis.

## 6. Limitaciones y trabajo manual obligatorio

Antes de declarar conformidad o desplegar como versión pública se debe realizar:

- recorrido completo solo con teclado;
- VoiceOver en iPhone/iPad;
- TalkBack en Android;
- NVDA o JAWS en Windows;
- zoom de navegador 200% y 400%;
- texto extra grande y reflujo a 320 px;
- prueba de contraste forzado del sistema;
- prueba con movilidad reducida de manos y control por voz;
- geolocalización en exterior e interior;
- apertura de Waze, Google Maps y Apple Maps;
- PWA offline y sincronización en iOS/Android;
- sesiones con personas usuarias de silla de ruedas, bastón, andador, baja visión, dolor o fatiga.

Automatización no equivale a experiencia inclusiva validada por personas.

## 7. Estado de despliegue

- La rama de trabajo está separada de producción.
- El PR permanece como borrador.
- Render no fue modificado.
- Los puntos iniciales de la preview son ficticios y están etiquetados como no verificados.
- Los puntos agregados en la preview se guardan solo en el navegador local.

## 8. Próximas prioridades

1. Pruebas físicas y con tecnologías asistivas.
2. Preview Django aislada con base de datos temporal.
3. Flujo administrativo para aceptar, fusionar o rechazar aportes.
4. Geocodificación por dirección y búsqueda por radio.
5. Fotografías seguras, almacenamiento externo y difuminado.
6. Definir límites geográficos más precisos que el bounding box inicial.
7. Cargar datos reales verificados en una zona piloto de Chile.

## 9. Referencias normativas

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Accesibilidad móvil del W3C: https://www.w3.org/WAI/standards-guidelines/mobile/
- WAI-ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
