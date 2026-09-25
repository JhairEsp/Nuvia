# Alcance previo · ventas, fidelización, equipo y Copiloto (24/09/2026)

Inspección del código/esquema realizada antes de modificar:

- Ventas: Yape/Plin solo cambia el método. No hay QR configurado. Cliente inicial puede quedar vacío al cargar clientes de forma asíncrona.
- Fidelización: `customers.loyalty_accounts` tiene relación 1:1 por UNIQUE(customer_id), pero el mapper espera un array. PostgREST puede devolver objeto y la UI muestra cero aunque haya saldo. `create_branch_sale` ya otorga floor(total) puntos por venta pagada con cliente; no se cambiará la regla ni se duplicarán puntos por completar una cita sin cobro.
- Equipo: `employees.photo_url` existe y el mapper lo lee; UI no permite subir y `save_team_member`/store no lo persisten.
- Copiloto: Groq fijo, con JWT del usuario, ocho herramientas autorizadas y RLS/RBAC. Se conservará esa seguridad al hacer configurable Hugging Face o un endpoint propio compatible.

Cambios previstos no destructivos:

1. Nueva migración 05 (posterior a 04): tabla `business_payment_qrs` con dos métodos YAPE/PLIN, RLS y RPCs para lectura y guardado; restricción de escritura sobre nuevas rutas Storage payments/team según permiso. Los buckets existentes y cuotas se conservan. QR y retratos son imágenes públicas: UI lo advertirá.
2. Sustituir `save_team_member` para aceptar foto con validación HTTP(S), preservando foto si un cliente antiguo no envía el campo. Mantener tenant, permisos, límite de empleados y asignación de servicios.
3. Ajustes: panel de subida/guardado de QR; Ventas: modal por método, reapertura, titular y monto, estados de QR ausente/error y confirmación humana de recepción. No integración bancaria ni afirmación automática de pago recibido.
4. Mapper de fidelización acepta objeto/array y carga puntos/nivel/lifetime; Ventas exige elección explícita de cliente o venta sin cliente, con aviso sobre puntos. No adjudicar automáticamente ventas históricas sin cliente ni modificar saldos históricos a ciegas.
5. Equipo: subir/quitar foto, preview y guardado real mediante RPC.
6. Copiloto: configuración servidor de proveedor/modelo, secretos solo Edge, límites honestos y errores de cuota visibles; no rotación de cuentas ni elusión de límites. Selección investigada: Qwen3-8B, modelo abierto con herramientas; API alojada tiene créditos/cuotas, autoalojamiento necesita hardware. Sin activar pagos ni proveedor remoto automáticamente.

No se borran negocios, usuarios, ventas, puntos, fotos ni releases. No se modifican planes comerciales ni capacidades. No hay acceso de despliegue/credenciales nuevas: SQL, frontend y Edge Functions requerirán instalación remota. Pruebas locales separadas de producción.
