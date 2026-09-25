# Reservas públicas sin cuenta

## Corrección implementada

- El botón Reservar del sitio publicado siempre abre el formulario. Ya no depende de que el snapshot publicado contenga servicios ni muestra «Reservas próximamente».
- Al abrir se consulta `get_public_branches` para obtener sucursales, servicios y equipo actuales. No se utiliza el snapshot como catálogo alternativo ante fallos.
- Todos los precios son seleccionables: servicios menores a S/25 y gratuitos incluidos. Se pueden seleccionar varios servicios. La preselección desde una tarjeta publicada se resuelve por ID usando precio y duración actuales.
- Cuatro pasos: servicio/sucursal/profesional, fecha y hora, datos de contacto, resumen y confirmación.
- Nombre, teléfono o WhatsApp y nota opcional. Teléfono peruano de nueve dígitos empezando en 9, o internacional con +código. Se quitan espacios/separadores, sin añadir automáticamente un código de país que cambie los teléfonos ya usados por el negocio.
- Disponibilidad real por día, incluyendo hoy y otras fechas elegidas por calendario; fechas y horas en zona del negocio, no del navegador. Se deduplican horarios de varios profesionales.
- Cambiar servicio, profesional, fecha o sucursal invalida la hora elegida. Las respuestas tardías se descartan. Los estados de carga, error y ausencia de horarios son distintos y tienen reintento cuando corresponde.
- `create_booking` recibe sucursal, servicios, profesional opcional, inicio ISO, nombre, teléfono y nota. El backend existente vuelve a comprobar disponibilidad y cuotas; crea cliente/cita/items en una transacción. El frontend no inventa IDs ni registra una confirmación local.
- El éxito requiere respuesta con appointment_id, importe y fechas; muestra el código e importe devueltos. El estado real creado por el backend es PENDING, por eso se informa «pendiente de confirmación por el negocio», no «cita confirmada».
- Doble clic bloqueado con ref inmediata; cierre y edición bloqueados durante envío. Un conflicto refresca horarios y conserva el contacto. Si se pierde la respuesta o llega una confirmación inválida, no se muestra éxito ni se reenvía automáticamente: se pide verificar con el negocio para evitar duplicados. Esto no incorpora idempotencia nueva en el servidor.
- Cierre sin timeout de reset, reapertura limpia, etiquetas accesibles, nombre del diálogo, navegación de teclado contenida y restauración de foco. Drawer incorpora una prop opcional `labelledBy`, sin cambiar el comportamiento de los otros consumidores.
- La vista previa privada del editor conserva su comportamiento de demostración; las reservas operan en el enlace público publicado.

## Configuración necesaria del negocio

Si no aparecen servicios u horas, no se rellenan con datos falsos. Revisar:
1. Página publicada, negocio habilitado y sucursal activa.
2. Servicios activos y visibles en la web, con sucursal y duración válidas.
3. Profesionales activos y visibles en esa sucursal, asignados a los servicios. Para una reserva con varios servicios debe existir un profesional que atienda todos.
4. Horario operativo del negocio y, si se definieron, turnos del profesional. Se respetan descansos, ausencias, citas existentes y anticipación mínima configurada.
5. Cuota de citas del plan correspondiente, validada por backend.

No se modificaron SQL, planes, pagos, fidelización ni WhatsApp. El formulario no envía WhatsApp automáticamente y no realiza cobros.

## Comprobaciones realizadas

- `npm run typecheck`: PASS.
- `npm run build`: PASS; advertencia de tamaño del bundle preexistente.
- `web/tests/public-booking-ui.local.mjs`: **13 PASS**. Incluye snapshot vacío, servicio económico/gratuito, preselección con precio vigente, validación de contacto, notas, hoy en Lima desde navegador Tokio, cambio de sucursal/profesional/día, respuesta tardía, reintentos, catálogo sin datos, conflicto, cuota rechazada, respuesta nula, fallo de red, doble clic, cierre durante envío, reapertura y móvil sin overflow.
- Regresión editor: **13 PASS** (`web/tests/website-ui.local.mjs`).
- Regresión tres plantillas Barbería: **9 PASS** (`web/tests/barber-templates-ui.local.mjs`).
- Captura móvil del resumen inspeccionada: `.pgtest/booking-review-mobile.png`.
- Logs: `.pgtest/public-booking-ui-results.log`, `booking-build.log`, `booking-website-regression.log`, `booking-barber-regression.log`.

Las pruebas de navegador interceptan Supabase exclusivamente dentro del test; no hay mocks en el producto. Verifican flujo y contrato HTTP, no persistencia real en producción. Se comprobó de forma no destructiva que las RPCs remotas `get_public_branches` y `get_public_availability` responden HTTP 200 y [] a un slug inexistente. No se crearon clientes ni citas de prueba en el Supabase remoto.

## Entrega

Cambios disponibles en el preview local de Nuvia, puerto 5173. Para que se vean en una web ya desplegada hay que desplegar el frontend actualizado. Este trabajo no constituye un despliegue remoto ni necesita una migración SQL nueva.

Ejecutar pruebas locales con Vite activo:

```sh
PLAYWRIGHT_BROWSERS_PATH=/home/user/.cache/ms-playwright node web/tests/public-booking-ui.local.mjs
npm run build --prefix web
```


## Corrección posterior: disponibilidad y guardado de horarios

Se encontró un fallo independiente del formulario público: en Ajustes, «Guardar horarios» y «Guardar reglas» solo mostraban un aviso y no persistían los cambios. Además, el editor de sucursales ignoraba horarios generales heredados. Corregido con `BookingSettings.tsx` y `booking-hours.ts`; detalles y pruebas en [disponibilidad-horarios.md](disponibilidad-horarios.md). No se cambiaron RPCs ni cuotas.
