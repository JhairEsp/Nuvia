# Disponibilidad pública y guardado real de horarios

## Fallos encontrados y corregidos

1. **Ajustes → Guardar horarios** solamente mostraba `toast.success`: no persistía ninguna fila. La API pública recibía un negocio sin horario operativo aunque la interfaz hubiese anunciado un guardado.
2. **Guardar reglas** tenía el mismo problema. Anticipación e intervalo tampoco se cargaban desde `business_settings`.
3. El editor de sucursales leía únicamente filas específicas de la sucursal. Ignoraba horarios generales heredados y podía presentar todos los días cerrados, sobrescribiendo la herencia si se guardaba así.

No se ha identificado la configuración concreta del negocio remoto del usuario. Estas son causas verificadas en el código, no una afirmación de haber inspeccionado sus citas ni horarios privados.

## Implementación

- `web/src/features/settings/BookingSettings.tsx`: sustituye los controles de horarios/reglas que no persistían. Selección explícita de sucursal, siete días, apertura/cierre, carga, errores y reintentos. Solo anuncia éxito tras respuesta del servidor.
- Horarios mediante `save_branch` existente: lee metadatos actuales de la sucursal y envía los siete días. El RPC valida tenant, permiso `settings.manage` y coherencia temporal, y reemplaza los horarios de esa sucursal en una transacción. No se borran clientes/citas ni horarios de otros negocios/sucursales.
- Reglas leídas y guardadas en `business_settings` mediante el cliente autenticado, con RLS existente por negocio/permiso. Se conservan las columnas no editadas. La anticipación 0 es una elección válida y explícita del administrador; no se cambia automáticamente.
- `booking-hours.ts`: cálculo compartido de horario efectivo por día: fila de sucursal primero, general después. Un cierre explícito de sucursal siempre prevalece sobre un horario general abierto. Si no existe ninguna fila no inventa una apertura.
- `BranchesPage.tsx`: el editor utiliza ese mismo cálculo, captura fallos de carga y permite reintentar sin guardar un estado vacío accidental.
- Avisos en Ajustes si faltan profesionales visibles o servicios asignados; enlace a Equipo. No se asignan servicios automáticamente ni se supone que cualquier profesional pueda realizar cualquier trabajo.
- Formulario público: aclara que los horarios dependen de atención, asignaciones y anticipación, no solamente de las citas ocupadas. No se modifica la RPC de disponibilidad ni se fabrican horas en frontend.
- Controles de hora adaptados al móvil con etiquetas y espacio para AM/PM cuando el navegador usa formato de 12 horas.

## Qué hacer en el negocio

1. Abrir **Ajustes → Horarios de atención** y seleccionar la sucursal.
2. Activar los días que realmente atiende el negocio, indicar apertura y cierre y pulsar **Guardar horarios**. Si se utilizó el antiguo botón, volver a guardar: ese botón no persistía los cambios.
3. Revisar **Reglas de reserva → Anticipación mínima**. Una anticipación grande puede ocultar horarios libres de hoy o de días próximos. Elegir la regla real del negocio y guardar.
4. En **Equipo → Editar → Servicios que ofrece**, asignar cada servicio a los profesionales que lo atienden. Deben estar activos, visibles y en la misma sucursal. Para una reserva con varios servicios, un mismo profesional debe poder realizar todos.
5. Reabrir la reserva pública o pulsar **Actualizar horarios**. No es necesario republicar contenido para que una configuración guardada de horarios/reglas afecte al motor de reservas.

No se abren todos los días automáticamente ni se eliminan bloqueos reales: turnos del profesional, ausencias, citas, duración y anticipación siguen vigentes.

## Pruebas ejecutadas

**PostgreSQL local real (Auth/Storage simulados; datos de prueba en transacción con ROLLBACK):**

- `supabase/tests/booking-availability.local.sql`: **25 PASS**. Reproduce el caso de día sin citas pero sin horario guardado. Después de guardar por `save_branch`, ofrece cuatro intervalos reales. Crear una reserva persiste cita PENDING/LANDING e items, bloquea solo su intervalo y rechaza duplicarlo. Cancelación libera la hora. Anticipación, cierres, turnos, ausencias y asignaciones se respetan. RLS y RPC impiden cambiar reglas/horarios de otro negocio o sin permiso.
- Regresión planes: **77 PASS**.
- Regresión editor web: **29 PASS**.
- Regresión medios/ventas: **23 PASS**.

**Navegador aislado (APIs interceptadas solo en tests):**

- `web/tests/booking-settings-ui.local.mjs`: **11 PASS**. Guardado real del cliente HTTP, persistencia del fixture tras recarga, errores sin éxito falso, herencia, separación de sucursales, reintento, permisos, avisos de asignaciones y móvil.
- Flujo público de reservas: **13 PASS**.
- Medios/ventas/equipo: **17 PASS**.
- Editor web: **13 PASS**.
- Plantillas Barbería: **9 PASS**.

Typecheck y build: **PASS**. Permanece la advertencia previa del tamaño del bundle. Captura móvil final inspeccionada: `.pgtest/booking-settings-mobile.png`.

Logs: `.pgtest/booking-availability-sql.log`, `.pgtest/booking-settings-ui.log`, `.pgtest/booking-settings-build.log`, `.pgtest/availability-*-sql.log`, `.pgtest/availability-*-ui.log`.

## Estado de entrega

- Corregido en los archivos y en el preview local de Nuvia, puerto 5173.
- **No requiere migración SQL nueva**: usa las tablas y `save_branch` ya existentes.
- Para la web desplegada se necesita desplegar el frontend actualizado. No se realizó despliegue remoto ni se cambió el horario real de ningún negocio desde esta sesión.
- No se crearon citas de prueba en Supabase remoto. La persistencia de citas descrita arriba se verificó exclusivamente en PostgreSQL local.
