# Starter / Business: inspección y decisiones antes de migrar

## Esquema inspeccionado
Fuente disponible: `20260921000001_init.sql`, `20260922000002_platform_admin.sql`, store, pantallas y Edge Functions locales. No se dispone de credenciales de DDL ni de sesión administrativa remota. Ejecutar primero `supabase/INSPECCION_PLANES.sql` en el proyecto real para comparar con este esquema.

- `plans`: UUID, code text unique, price_monthly numeric, limits/modules JSONB, is_active.
- `subscriptions`: UUID, business_id, plan_id, status, períodos; puede haber más de una por negocio. Se considera vigente la última por created_at/id, no una suscripción histórica activa anterior.
- `locations`: business_id, dirección, is_default; falta estado activo.
- `employees`, `appointments`, `sales`, `business_hours`: ya tienen location_id opcional.
- `services`, `products`, `customers`: no tienen location_id. Clientes continuarán compartidos dentro del negocio para preservar historial; servicios y existencias tendrán sucursal.
- Límite UI fijo de 5 en TeamPage. No hay enforcement de cuotas en la base.
- `plans`/`subscriptions` tienen RLS de escritura solo Super Admin. Algunas tools IA SECURITY DEFINER carecen de autorización explícita: deben protegerse antes de reutilizarlas.

## Cambios implementados en código (sin ejecución remota)
- Migración nueva transaccional: `20260924000003_two_plans.sql`, copia instalable `PLANES_Y_SUCURSALES.sql`.
- `plans.limits` + `plans.modules` son la única fuente de capacidades. `null` JSON significa ilimitado. No copiar límites por tenant.
- Solo dos códigos válidos: STARTER, BUSINESS. UUID existentes de ambos se conservan. Pro se elimina de la tabla comercial una vez referenciado en un historial inmutable, sin borrar suscripciones ni su UUID.
- `subscription_plan_history` guarda snapshots previos. PRO vigente o histórico se referencia a BUSINESS en `subscriptions`; el snapshot conserva la identidad y precio anteriores. No hay integración de cobro ejecutada por esta migración.
- No se borran trabajadores, citas, clientes ni sucursales. Excesos existentes deben detectarse antes de migrar; un downgrade se bloquea mientras el consumo exceda el destino.
- Sucursales: mantener entidades existentes, asignar filas sin ubicación a la principal y añadir controles de tenant/referencias. Clientes compartidos por negocio; la actividad, stock y reportes se segmentan por ubicación.
- UI: `AdminPages`, `TeamPage`, `CalendarPage`, `SettingsPage`, `AppShell`, `db.ts`, tipos, módulo central de capacidades y pantallas de plan/sucursales. No rehacer funcionalidades ajenas a planes.

## Reglas de consumo
- Trabajadores: todos los registros (también inactivos) consumen cuota, evitando crear cuentas indefinidamente alternando active. Eliminarlos libera cuota; desactivar no. La UI debe indicarlo.
- Citas: mes calendario de `scheduled_start` en `businesses.timezone`. Cada mes futuro tiene su propio cupo; crear citas futuras no consume el mes actual. Estados PENDING, CONFIRMED, IN_SERVICE, COMPLETED y NO_SHOW consumen; CANCELLED no consume si nunca se completó. Una cita completada no puede cancelarse, borrarse ni moverse a otro mes para reducir consumo.
- Sucursales: todas las ubicaciones, incluidas inactivas, consumen cuota; desactivar no permite saltarse el límite.
- Almacenamiento: suma de bytes de objetos del negocio en buckets administrados; 1 MB = 1,048,576 bytes. 10 GB = 10,240 MB. Se valida en Storage antes de confirmar metadatos; no se introducen contadores elegidos por React.
- Concurrencia: las mutaciones con consumo serializan por negocio mediante bloqueo de fila, no conteos UI. Cambios de suscripción participan del mismo bloqueo.
- Sin suscripción operativa o negocio suspendido: no se conceden capacidades por defecto. TRIALING y ACTIVE permiten operar; PAST_DUE conserva acceso de gracia, CANCELLED no permite nuevas operaciones sujetas a cuotas.
- Cambiar plan desde una cuenta de negocio genera una solicitud; no cambia su suscripción. Solo Super Admin puede asignar el plan.

## Antes de ejecutar en producción
1. Respaldo/snapshot del proyecto.
2. Ejecutar inspección de solo lectura y revisar códigos desconocidos, tenants con varias suscripciones/ubicaciones y excesos Starter.
3. Aplicar migraciones en el orden documentado. Si la inspección real difiere, adaptar antes de ejecutar.
4. Validar almacenamiento real con Supabase Storage y transacciones autenticadas en staging. Las pruebas locales usan stubs de Auth/Storage: no sustituyen esa comprobación.

## Inventario final de impacto

| Capa | Archivos/tablas/funciones relevantes |
|---|---|
| Migración | `20260924000003_two_plans.sql`, copia exacta `PLANES_Y_SUCURSALES.sql` |
| Catálogo y suscripciones | `plans`, `subscriptions`, `subscription_plan_history`, `plan_change_requests`; `get_plan_catalog`, `get_plan_usage`, `request_plan_change`, `admin_save_plan`, `admin_plan_businesses`, `admin_resolve_plan_request` |
| Cuotas/tenancy | Helpers privados, triggers de empleados/citas/ubicaciones/Storage, referencias y coherencia de sucursal |
| Multisucursal | `locations`, `business_hours`, `employees`, `employee_services`, `services`, `appointments`/items, `sales`/items, `products`, inventario; `save_branch`, `save_team_member`, `save_calendar_appointment`, `create_branch_sale`, `adjust_branch_stock`, `get_branch_report_dates` |
| Módulos compartidos | Policies restrictivas de web, fidelización, IA y WhatsApp; `adjust_loyalty_points`, tools IA autorizadas, `system_ai_metrics`, wrappers de reservas/métricas |
| Interfaz | `store/capabilities.ts`, `store/session.ts`, `store/db.ts`, `PlanPage`, `BranchesPage`, `PlanFeatureGuard`, `AppShell`, `AdminPages`; pantallas de equipo/agenda/servicios/inventario/POS/reservas, fidelización y WhatsApp |
| IA | `web/src/lib/ai.ts`, `ai-copilot/index.ts`, `ai-insights/index.ts`; secretos solo en Edge, JWT por usuario |
| Instalación/pruebas | `compose_sql.py`, `SUPABASE.sql`, seed solo RBAC; suites SQL, concurrencia, Playwright y Edge aisladas |

La inspección remota sigue pendiente. El detalle de activación, resultados exactos y alcance de proveedores externos está en [la guía de entrega](entrega-planes-y-sucursales.md).
