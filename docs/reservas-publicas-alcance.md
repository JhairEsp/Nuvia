# Reparación de reservas públicas · alcance antes de cambios

Inspección:
- SiteRenderer deshabilita Reservar y lo sustituye por «Reservas próximamente» cuando `snapshot.services` está vacío. Ese snapshot puede ser anterior al catálogo actual.
- BookingDrawer ya usa RPCs de reservas sin cuenta, pero excluye servicios menores a S/25 del paso principal (si todos son económicos, no se puede elegir ninguno), utiliza el objeto de servicio del snapshot como preselección, consulta únicamente mañana a siete días y muestra horas en zona del dispositivo.
- Faltan estados claros de carga/reintento/vacío; pueden quedar horarios antiguos durante otra consulta. Confirmar comprueba error pero no el ID de reserva devuelto; un fallo de red puede quedar sin capturar. El cierre usa un timeout susceptible a restablecer una nueva apertura.
- Las RPCs get_public_branches y get_public_availability existen en el Supabase configurado: consulta de solo lectura con slug inexistente devolvió HTTP 200 y []. No se consultaron datos privados ni se crearon citas remotas.

Cambios previstos no destructivos:
1. CTA público siempre abre reserva; no depender del catálogo congelado en el release. Preview privado sigue sin generar citas.
2. Formulario público sin cuenta: sucursal, servicios actuales de cualquier precio, profesional opcional, fecha/hora real, nombre, teléfono y nota opcional; resumen y confirmación por RPC.
3. Consultar catálogo al abrir y disponibilidad por día, incluyendo hoy; fechas y horas con zona del negocio. Descarta respuestas tardías al cambiar servicio/profesional/fecha/sucursal o cerrar.
4. Confirmar únicamente con appointment_id devuelto por create_booking; evitar doble clic, no vaciar datos ante error y refrescar disponibilidad si el horario ya se ocupó.
5. No inventar servicios, trabajadores ni horarios cuando el negocio no está configurado. Mensajes claros y alternativa de contacto. Mantener las validaciones/cuotas del backend.
6. Sin SQL nuevo, sin modificar ventas/puntos/planes ni introducir pagos o WhatsApp automáticos. Tests de navegador con APIs interceptadas y build. No se declara una reserva real en producción como prueba.
