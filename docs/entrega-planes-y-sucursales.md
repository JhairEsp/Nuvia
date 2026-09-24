# Entrega · dos planes y multisucursal

**24 de septiembre de 2026 · código y pruebas locales. No se aplicaron migraciones, despliegues ni escrituras al Supabase remoto.**

## 1. Contrato implementado

| | STARTER | BUSINESS |
|---|---:|---:|
| Precio inicial mensual | S/79 | S/299 |
| Trabajadores | 5 | Ilimitados (`null`) |
| Citas mensuales | 300 | Ilimitadas (`null`) |
| Almacenamiento | 500 MB | 10 240 MB / 10 GB |
| Sucursales | 1 | Ilimitadas (`null`) |
| Web, fidelización, IA y WhatsApp | Sí | Sí |
| Multisucursal | No | Sí |

La diferencia comercial es operación individual frente a crecimiento/múltiples ubicaciones, no retirar módulos compartidos. Catálogo con dos tarjetas, comparativa y CTAs «Comenzar con Starter» / «Elegir Business». Mi plan muestra capacidades, precio y consumo obtenido del servidor.

Los precios/límites/capacidades se administran en el Super Admin. Solo se admiten los códigos STARTER y BUSINESS; no existe un tercer código comercial que pueda crearse por API. Desactivar un plan impide nuevas asignaciones; no elimina automáticamente suscripciones o datos históricos.

## 2. Qué cambia

### Fuente de verdad y controles

- `plans.limits` + `plans.modules`; el frontend no asigna su propio plan ni guarda límites por negocio.
- `get_plan_catalog`, `get_plan_usage`, `require_plan_capability`: contratos del catálogo y capacidades. Sin suscripción operativa no hay permisos implícitos.
- Validación de cuotas mediante triggers/RPC y bloqueo de la fila del negocio. También aplica a escrituras directas, upserts, cambios de IDs y solicitudes concurrentes.
- Referencias de tenant y sucursal coherentes; `business_id` inmutable en los recursos protegidos. RLS/RBAC no se sustituyen por el plan.
- El cambio solicitado desde Mi plan queda pendiente; únicamente Super Admin asigna/aprueba. Un downgrade con exceso se rechaza sin borrar datos.

### Sucursales y operación

Crear/editar/activar/desactivar sucursales y sus siete horarios. Equipo, servicios, citas, productos/existencias y ventas se asocian a ubicación. Clientes e historial se comparten dentro del negocio, nunca entre tenants. Selector de sucursal o vista consolidada; operaciones nuevas requieren una ubicación válida. POS transaccional con precios del servidor, stock, pagos registrados, comisiones y puntos.

Reporte agregado en PostgreSQL por sucursal, sin depender de cuántas filas carga el navegador. Los filtros de fecha se interpretan en la zona horaria del negocio, incluidos cambios de horario de verano.

### Módulos compartidos

- Web: publicación/consulta pública y reservas sujetas a capacidades y cuotas, con selección de sucursal.
- Fidelización: acceso para ambos planes, puntos y canje atómico, niveles según puntos acumulados, historial paginado y promociones persistidas. El canje rechaza saldo insuficiente y no puede duplicarse por concurrencia. Se conserva el programa existente: POS otorga un punto por sol entero, niveles en 250/500/800 puntos acumulados y canje manual de 100 puntos desde el cliente; no se ha creado una pasarela externa de recompensas ni un nuevo motor configurable de reglas.
- WhatsApp: configuración de plantillas, activación de automatizaciones y registro real en cola. La UI espera confirmación y distingue **QUEUED** de una entrega **SENT**. Un usuario no puede falsificar `sent_at`/`provider_ref` o marcar el mensaje enviado por escritura directa.
- IA: frontend → `ai-copilot` → RPC con JWT del usuario. Valida autenticación, acceso al negocio, `ai.use` y capacidad; cada herramienta exige además el permiso de sus datos. Allowlist de herramientas y parámetros; el modelo no elige el tenant ni ejecuta SQL. No hay clave Groq en el código del navegador ni respuestas numéricas simuladas cuando falla el servicio.
- Job `ai-insights`: RPC `system_ai_metrics` exclusiva de `service_role`, con comprobación de capacidad, y endpoint POST protegido por `INSIGHTS_CRON_SECRET`. No accesible con un token de usuario común.

## 3. Datos existentes y migración

Primero revisar [alcance e inspección](planes-alcance-migracion.md) y ejecutar `supabase/INSPECCION_PLANES.sql` en el proyecto real. La inspección realizada aquí corresponde al esquema fuente local, no garantiza que una base remota modificada manualmente sea idéntica.

- UUID existentes de Starter/Business conservados.
- Suscripciones conservan su UUID. Las referencias Pro se trasladan a Business después de guardar el plan y la suscripción anteriores en `subscription_plan_history`; no se elimina automáticamente una suscripción histórica.
- Pro desaparece del catálogo/tabla comercial. Sus menciones en fixtures y snapshots son historia de migración, no un plan utilizable.
- No hay cobros ni ajustes de proveedor de pagos en el SQL.
- No se eliminan trabajadores, citas, clientes o ubicaciones para hacerlos encajar.
- **Preflight:** si un Starter existente excede trabajadores, sucursales, almacenamiento o citas de un mes actual/futuro, toda la migración aborta. Resolverlo explícitamente antes de reintentar; nunca borrar registros de oficio.
- Planes con códigos desconocidos también abortan. No se aplica una conversión adivinada.
- La migración es transaccional y **no idempotente**. Si falla, revisar el error y el estado; no ejecutar repetidamente el paquete completo.

### Archivos a ejecutar

| Situación | Archivo |
|---|---|
| Inspección previa, solo lectura | `supabase/INSPECCION_PLANES.sql` |
| Proyecto existente con esquema inicial y administración instalados | `supabase/PLANES_Y_SUCURSALES.sql` |
| Alternativa versionada al anterior (no aplicar ambos) | `supabase/migrations/20260924000003_two_plans.sql` |
| Proyecto nuevo sin Nuvia | `supabase/SUPABASE.sql` |

`PLANES_Y_SUCURSALES.sql` es una copia exacta de la migración 03. `SUPABASE.sql` fue regenerado: esquema + RBAC + administración + planes, **sin usuarios/contraseñas ni datos demo**. Bloquea su ejecución sobre un proyecto Nuvia existente.

No ejecutar fixtures/test SQL, el antiguo `FIX_AUTH.sql` ni inserts en tablas de Auth para activar esta entrega. El diagnóstico pendiente del error remoto de Auth es independiente: estas pruebas no certifican ni reparan GoTrue.

## 4. Activación en el proyecto real

1. **Respaldo y staging.** Comparar el resultado de inspección con el esquema fuente; revisar los excesos y suscripciones históricas. Mantener una ventana de mantenimiento para coordinar SQL y frontend.
2. **SQL.** Con las migraciones 01/02 ya instaladas, aplicar una vez `PLANES_Y_SUCURSALES.sql`. Para una base nueva, usar el procedimiento específico del README.
3. **Copiloto.** Configurar `GROQ_API_KEY` en Supabase Edge Secrets y desplegar `ai-copilot`:
   ```bash
   npx supabase functions deploy ai-copilot --project-ref TU_PROJECT_REF --no-verify-jwt
   ```
   La verificación se hace dentro de la función con `auth.getUser()` y las RPC. No queda abierta por desactivar el verificador legado del gateway. Si una clave estuvo antes en `VITE_GROQ_API_KEY`, revocarla/rotarla y quitarla del entorno del frontend.
4. **Job opcional.** Configurar un secreto aleatorio `INSIGHTS_CRON_SECRET`, desplegar `ai-insights` y configurar el scheduler para POST con `x-cron-secret`. Mantener el secreto en el servidor/Vault. Sin secreto, la función responde 403 por diseño.
5. **Cuentas.** Si se utiliza la administración de usuarios, actualizar la función existente `quick-service` con el código de `platform-users`, conforme a [su guía](activar-administracion.md). Nunca colocar `service_role` en Vite. El alias del proyecto actual es `VITE_PLATFORM_USERS_FUNCTION=quick-service`.
6. **Frontend.** Compilar y publicar el build de `web`. No publicar los archivos de tests ni entornos locales. Cerrar/reabrir sesión para cargar permisos vigentes.
7. **Integraciones.** Configurar un proveedor real de WhatsApp y su procesador de colas/automatizaciones antes de esperar envíos o recordatorios. Registrar una fila QUEUED no equivale a entrega. Esta entrega no implementa ese proveedor/worker.
8. **Prueba autenticada en staging.** Repetir casos de cuotas/API, tenant y permisos; verificar carga/sobrescritura real en Storage, login real, llamadas Groq y, si se conectó proveedor, entrega WhatsApp. Solo entonces promover a producción.

Las solicitudes/asignaciones de plan son administrativas. **No se ha implementado ni probado un cobro recurrente de S/79 o S/299.** No se presenta una solicitud de cambio como pago confirmado.

## 5. Evidencia local

| Verificación | Resultado |
|---|---|
| TypeScript y build de producción | PASS |
| SQL funcional/seguridad | **76 comprobaciones PASS** |
| Concurrencia, conexiones PostgreSQL separadas | **5 PASS** |
| Interfaz Playwright con Supabase interceptado | **10 PASS** |
| Edge Functions de IA con red sustituida | **12 PASS** |
| Regresión aislada de la función de cuentas | **16 PASS** |
| Typecheck Deno de ambas funciones IA | PASS |
| Preflight y bloqueo del paquete en base existente | **2 PASS** |
| Instalación nueva del paquete SQL | PASS: solo STARTER/BUSINESS, 0 cuentas Auth y 0 negocios |

El build advierte un chunk mayor de 500 kB; no es un error, queda como optimización de carga.

### Cobertura destacada

- Starter: trabajador 1/5 y rechazo del 6 por tabla/RPC; inactivos y upserts no evitan la regla.
- Citas 300/301, meses futuros independientes, cancelación, reactivación, protección de citas atendidas y reserva pública con rollback del cliente si falla la cuota.
- Starter: sucursal 1/2; almacenamiento 500 MB exactos, exceso, sobrescritura, rutas con UUID en mayúsculas y cambio de tenant.
- Business: **55 trabajadores y 20 001 citas** sin un máximo artificial; varias sucursales, POS, stock, puntos y reportes.
- Catálogo con dos códigos, UUID conservados e historial Pro; restricciones a escalación de rol/cambio de plan/IDOR, autorización de IA y helpers privados.
- Canje y acumulación de puntos/historial en Starter; rechazo de saldo insuficiente/cliente ajeno; carreras entre dos canjes.
- Reportes con cambio DST, rechazo de período inválido y tenant ajeno. Eliminación explícita de negocio por Super Admin mantiene sus cascadas.
- UI: consumos del backend, ilimitados, sucursal por RPC, `null` preservado en editor de planes, rechazo backend de WhatsApp sin falso éxito, cola y plantilla guardadas.
- IA Edge: CORS, Auth inválido, capacidad/tenant denegado, secreto ausente, inyección de tenant/parámetros por el modelo, herramientas no permitidas, permisos de datos e insights con JWT.

**Límite de esta evidencia:** PostgreSQL local utiliza stubs de Auth/Storage y fixtures exclusivos de prueba. Playwright intercepta Supabase; las pruebas de Edge no contactan Groq ni Supabase. No son E2E remotas, prueba de pago, prueba de GoTrue ni prueba del almacenamiento binario/entrega externa.

### Reproducir en el entorno local de pruebas

```bash
# PostgreSQL LOCAL de esta sesión: socket /var/run/postgresql, puerto 55432.
# Este comando elimina/recrea exclusivamente beautyos_plans_test.
bash .pgtest/rebuild-plans.sh
sudo -u postgres psql -h /var/run/postgresql -p 55432 \
  -d beautyos_plans_test -v ON_ERROR_STOP=1 < supabase/tests/two-plans.local.sql
python3 supabase/tests/plan-concurrency.local.py
bash supabase/tests/migration-preflight.local.sh

# Vite en 5173 y Playwright/Chromium instalados localmente.
node web/tests/plans-ui.local.mjs
npx deno test --allow-env --allow-net \
  supabase/functions/ai-copilot/index_test.ts supabase/functions/ai-insights/index_test.ts
npx deno check supabase/functions/ai-copilot/index.ts supabase/functions/ai-insights/index.ts
npm run build --prefix web
```

El SQL de la suite hace rollback. La prueba de concurrencia deja fixtures locales: reconstruir antes de repetirla. El cluster/procesos/dependencias locales no forman parte de un despliegue ni deben subirse a producción.
