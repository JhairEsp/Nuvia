# 03 · Roles y permisos (RBAC) — Nuvia

Tres niveles (§2–4 del brief) · Roles sembrados en `roles`/`permissions`/`role_permissions` ·
resueltos en RLS por `has_permission(business_id, 'clave')` (DECISIÓN 7). Escalable a nuevos roles
sin migraciones (§4 "preparar arquitectura para roles futuros").

## Niveles

| Nivel | Quién | Alcance |
|---|---|---|
| **SUPER_ADMIN** | Dueño de la plataforma (`users.platform_role='SUPER_ADMIN'`) | Todos los tenants + `/admin` |
| **BUSINESS_ADMIN** | 1 por negocio (`business_users.role_code`) | Su negocio completo (jamás otros tenants ni config global) |
| **WORKERS** | ≤5 por negocio (límite de plan) | Solo lo que su rol permita; opcionalmente solo su agenda |

## Roles (semilla + futuros ya contemplados)

| code | Fase | Descripción |
|---|---|---|
| `BUSINESS_ADMIN` | ✅ hoy | Administrador principal del negocio |
| `RECEPTIONIST` | ✅ hoy | Recepción: agenda, clientes, ventas |
| `BARBER` | ✅ hoy | Trabajador (barbería) |
| `STYLIST` | ✅ hoy | Trabajador (estilista) |
| `THERAPIST` | ✅ hoy | Trabajador (spa/masaje) |
| `CASHIER` | ✅ hoy | Caja y ventas |
| *(nuevos)* | futuro | Filas nuevas en `roles` + `role_permissions`, cero código |

## Permisos (catálogo)

| Clave | Describe |
|---|---|
| `dashboard.view` | Ver dashboard inteligente |
| `calendar.view_all` / `calendar.view_own` | Ver agenda completa / solo la propia |
| `calendar.manage` | Crear, reprogramar, cancelar, estados de cita |
| `clients.view` / `clients.manage` | Ver / crear-editar clientes (incluye Beauty History) |
| `services.view` / `services.manage` | Ver / gestionar catálogo de servicios |
| `team.view` / `team.manage` | Ver equipo / crear-editar-desactivar trabajadores |
| `sales.view` / `sales.manage` | Ver ventas / operar POS y cobrar |
| `cash.manage` | Caja: arqueos, cierres |
| `inventory.view` / `inventory.manage` | Ver stock / gestionar productos y movimientos |
| `loyalty.manage` | Fidelización, referidos, promociones |
| `commissions.view_own` / `commissions.view_all` | Ver propia / todas las comisiones |
| `website.manage` | Editor de página, galería, publicar |
| `reports.view` | Reportes y analítica |
| `ai.use` | Copiloto IA e insights |
| `whatsapp.manage` | Centro WhatsApp y automatizaciones |
| `settings.manage` | Ajustes del negocio, marca, horarios |

## Matriz

| Permiso | BUSINESS_ADMIN | RECEPTIONIST | BARBER/STYLIST/THERAPIST | CASHIER |
|---|:---:|:---:|:---:|:---:|
| dashboard.view | ✅ | ✅ | ✅ | ✅ |
| calendar.view_all | ✅ | ✅ | — | — |
| calendar.view_own | ✅ | ✅ | ✅ | — |
| calendar.manage | ✅ | ✅ | ✅ (suya) | — |
| clients.view | ✅ | ✅ | ✅ | ✅ |
| clients.manage | ✅ | ✅ | ✅ | — |
| services.view | ✅ | ✅ | ✅ | ✅ |
| services.manage | ✅ | — | — | — |
| team.view | ✅ | ✅ | ✅ (solo perfil propio) | ✅ |
| team.manage | ✅ | — | — | — |
| sales.view | ✅ | ✅ | ✅ (propias) | ✅ |
| sales.manage | ✅ | ✅ | ✅ | ✅ |
| cash.manage | ✅ | ✅ | — | ✅ |
| inventory.view | ✅ | ✅ | — | ✅ |
| inventory.manage | ✅ | — | — | ✅ |
| loyalty.manage | ✅ | ✅ | — | — |
| commissions.view_own | ✅ | — | ✅ | — |
| commissions.view_all | ✅ | — | — | — |
| website.manage | ✅ | — | — | — |
| reports.view | ✅ | — | — | — |
| ai.use | ✅ | — | — | — |
| whatsapp.manage | ✅ | ✅ | — | — |
| settings.manage | ✅ | — | — | — |

## Reglas de aislamiento (nunca violables)

1. **Business A jamás lee/escribe datos de Business B** — RLS con `business_id` del membership, no del request.
2. **Un BUSINESS_ADMIN no puede**: crear otros Business Admin, crear negocios, ver otros tenants,
   tocar config global, ni cambiar `plans`/`subscriptions` (solo ver la propia).
3. **Un worker sin `team.manage` no edita** a otros trabajadores; con `calendar.view_own` solo ve su agenda
   (policy filtra por `employee_id = current_employee_id()`).
4. **`platform_role` y `roles` del sistema** solo los modifica Super Admin (policies dedicadas).
5. **Límites de plan** (5 workers, etc.) se validan server-side en la RPC de alta (`plans.limits`).
6. Todo cambio sensible genera fila en **audit_logs** (antes/después, usuario, fecha).

## Super Admin (`/admin`)

Acceso global vía `is_super_admin()`: Negocios (crear/suspender/activar), Usuarios, Planes, Suscripciones,
Módulos, Actividad, Auditoría (lectura de `audit_logs` de todos los tenants), Configuración de plataforma,
dashboard con MRR, churn, negocios activos/suspendidos, consumo.

## Permisos en el frontend (UX, no seguridad)

`usePermission('sales.manage')` oculta/muestra acciones; **la seguridad real es siempre RLS + RPC**.
Toda pantalla sin permiso muestra el estado *"Permission denied"* diseñado (§49).
