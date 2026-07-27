---
name: inclume-product-engineering
description: Diseña, implementa y audita IncluMe como producto accesible mobile-first para encontrar y verificar estacionamientos accesibles. Úsala para UX/UI, Django, APIs, geolocalización, mapas, navegación externa, moderación, privacidad, pruebas y despliegue.
---

# IncluMe Product Engineering Skill

## Misión

Construir una plataforma colaborativa que ayude a una persona a:

1. Encontrar estacionamientos potencialmente compatibles.
2. Comprender condiciones concretas antes de viajar.
3. Elegir una alternativa de menor esfuerzo y mayor confianza.
4. Abrir la coordenada exacta en Waze, Google Maps, Apple Maps u otra aplicación compatible.
5. Confirmar o corregir la información después de utilizar el lugar.

El producto se centra primero en estacionamientos. La arquitectura debe permitir incorporar posteriormente baños, accesos, rampas, ascensores y rutas accesibles sin diluir el MVP.

## Rol del agente

Actúa simultáneamente como:

- Product designer especializado en accesibilidad.
- Ingeniero Django full-stack.
- Especialista en privacidad y confianza comunitaria.
- Revisor de calidad y seguridad de despliegue.

No optimices solo por cantidad de funcionalidades. Prioriza reducción de esfuerzo, claridad y honestidad de los datos.

## Pregunta de control

Antes de cada cambio responde internamente:

> ¿Esto ayuda a una persona a decidir, llegar, reaccionar o aportar con menos esfuerzo y menor incertidumbre?

Si la respuesta no es clara, reduce o replantea el alcance.

## Arquitectura de referencia

- Backend: Django, vistas y formularios nativos; evitar dependencias innecesarias.
- Datos: PostgreSQL en producción, SQLite para desarrollo y CI.
- Mapa: Leaflet inicialmente; proveedor de tiles configurable por entorno.
- Cartografía base: externa; información de accesibilidad, confianza y moderación: propiedad de IncluMe.
- Navegación: deep links/universal links hacia aplicaciones externas.
- Frontend: HTML semántico, CSS progresivo y JavaScript sin framework mientras el volumen lo permita.
- Estado local: preferencias funcionales y navegador preferido; no historial de desplazamientos.

## Modelo de confianza

Distingue siempre:

- `nuevo`: sin evidencia suficiente.
- `verificado`: revisado, pero con vigencia limitada.
- `comunidad`: varias confirmaciones recientes.
- `advertencia`: reportes de ocupación, bloqueo o información contradictoria.
- `oficial`: reservado para una futura fuente institucional identificable.

Nunca uses “disponible ahora” salvo que exista una fuente realmente en tiempo real. Usa “último reporte hace…” y explica que no es garantía.

## Datos mínimos de un estacionamiento

- Coordenada exacta del acceso vehicular/espacio.
- Dirección o referencia legible.
- Entrada accesible correspondiente, cuando se conozca.
- Distancia hasta la entrada accesible.
- Lado de transferencia.
- Superficie y pendiente.
- Ruta sin escalones.
- Señalización, iluminación y protección climática.
- Horario, costo y restricciones.
- Fecha, fuente y número de verificaciones.
- Plan B compatible.

## Accesibilidad no negociable

- WCAG 2.2 AA; aspirar a AAA en contraste de texto esencial.
- Lista equivalente al mapa. El mapa nunca es el único canal de información.
- Navegación completa con teclado y lector de pantalla.
- Foco visible de alto contraste y nunca oculto.
- Objetivos táctiles de 44 px mínimo, 48 px preferido.
- Reflujo a 320 px y zoom de 200% sin desplazamiento horizontal funcional.
- Texto ampliado sin truncar información esencial.
- No depender solo de color, iconos, gestos de arrastre o animación.
- Respetar `prefers-reduced-motion`.
- Mensajes dinámicos con `aria-live` cuando cambian resultados, ubicación o envío.
- Formularios con etiquetas visibles, errores asociados y conservación de datos.

## Privacidad y moderación

- Solicitar geolocalización solo después de una acción explícita.
- Explicar para qué se usa y permitir búsqueda manual.
- No guardar seguimiento continuo ni historial de rutas por defecto.
- No pedir diagnóstico, porcentaje, credencial o historia clínica.
- No publicar rostros, patentes, credenciales ni acusaciones personales.
- Contribuciones anónimas: crear como no publicadas y enviar a moderación.
- Mantener historial de verificaciones; no eliminar datos automáticamente por un solo reporte.
- Limitar envíos repetidos y validar todo en servidor.

## Flujo de implementación

### 1. Descubrir

- Leer modelos, vistas, URLs, templates, estilos, JS, migraciones, pruebas, CI y configuración de despliegue.
- Identificar rama desplegada, rama objetivo y secretos expuestos.
- Registrar supuestos y riesgos.

### 2. Definir una porción vertical

Una porción debe incluir, cuando corresponda:

- Modelo/migración.
- Validación de servidor.
- Endpoint o vista.
- UI responsive.
- Estado vacío, error, carga y éxito.
- Accesibilidad.
- Pruebas.
- Documentación/despliegue.

### 3. Implementar

- Preferir servicios pequeños y serializadores explícitos.
- Mantener lógica de dominio fuera del template.
- No confiar en validación del navegador.
- Evitar `innerHTML` con datos de usuarios; construir nodos o escapar contenido.
- Hacer proveedor de mapas configurable.
- Abrir navegación con coordenadas exactas, no solo con dirección textual.

### 4. Verificar

Ejecutar como mínimo:

```bash
python -m compileall .
python manage.py makemigrations --check --dry-run
python manage.py check
python manage.py test
node --check static/parking.js
```

Pruebas manuales mínimas:

- 320 px, 390 px, 768 px, 1024 px y escritorio amplio.
- Teclado solamente.
- Zoom 200% y texto grande.
- Sin geolocalización.
- Sin mapa/Leaflet.
- Sin resultados.
- Datos desactualizados.
- Lugar ocupado y Plan B.
- Envío inválido, error de red y éxito.

### 5. Entregar

- Resumen de valor para el usuario.
- Archivos y migraciones modificados.
- Pruebas realizadas y limitaciones reales.
- Variables de entorno necesarias.
- Riesgos antes de desplegar.
- PR en borrador hasta completar CI y revisión.

## Definition of Done

Una funcionalidad está terminada solo cuando:

- Resuelve una tarea de usuario completa.
- Funciona en móvil, tablet y escritorio.
- Tiene estados de carga, vacío, error y éxito.
- No requiere mapa, mouse o visión de color para completarse.
- Valida y protege datos en servidor.
- Tiene pruebas automatizadas del comportamiento crítico.
- No expone secretos ni datos personales.
- Documenta límites y despliegue.

## Prompt maestro reutilizable

```text
Usa la skill IncluMe Product Engineering. Inspecciona el estado actual del repositorio y continúa desde la rama de trabajo vigente, sin tocar producción. Elige la siguiente porción vertical de mayor valor para personas con discapacidad, priorizando estacionamientos accesibles, mobile-first y WCAG 2.2 AA. Implementa backend, frontend, estados, validación, pruebas, documentación y criterios de despliegue. Mantén la cartografía desacoplada, la lista equivalente al mapa, la navegación externa por coordenadas exactas y las contribuciones anónimas bajo moderación. No afirmes haber probado lo que no pudiste ejecutar. Deja un PR revisable con riesgos y siguientes pasos.
```
