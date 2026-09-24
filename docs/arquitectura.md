# 01 · Arquitectura — Nuvia

> Cada decisión importante se documenta como **DECISIÓN / RAZÓN / IMPACTO** (§59 del brief).

## Visión general

```
┌────────────────────────── SPA Vite (React 19 + TS) ──────────────────────────┐
│  /app/* (Admin+Workers)   /admin/* (Super Admin)   /b/:slug (público)        │
│  Zustand · RHF+Zod · Framer Motion · Recharts · cmdk · Tailwind v4          │
└──────────────┬───────────────────────────────────────────────┬───────────────┘
               │ supabase-js (RLS)                             │ RPC públicas
┌──────────────▼───────────────────────────────────────────────▼───────────────┐
│                            S U P A B A S E                                   │
│  Auth ── PostgreSQL 15+ (RLS en TODAS las tablas) ── Storage (imágenes)      │
│  Edge Functions: ai-copilot · ai-insights · bookings · whatsapp (futuro)      │
└──────────────┬───────────────────────────────────────────────────────────────┘
               │ tool calling (server-side, API key en secrets)
┌──────────────▼───────────┐        ┌──────────────────────────┐
│  GROQ · Llama 3.3 70B    │        │ WhatsApp API (futuro)     │
│  métricas REALES vía RPC │        │ Meta Cloud / Evolution    │
└──────────────────────────┘        └──────────────────────────┘
```

---

## DECISIÓN 1 — Supabase como backend completo (sin Node.js aparte)

**RAZÓN:** El brief exige RLS, multi-tenant estricto, auth segura, storage de imágenes y auditoría.
Supabase entrega Postgres + RLS + Auth + Storage + Functions serverless en una sola plataforma;
un servidor Node duplicaría auth, validación y despliegue sin aportar capacidad que hoy falte.
**IMPACTO:** Menos infraestructura y superficie de ataque; la seguridad vive en la capa de datos
(un usuario de Business A **jamás** lee filas de Business B, aunque manipule IDs — anti-IDOR por diseño).
Cuando una lógica exija más potencia, una Edge Function (Deno/TS) o un worker dedicado entra sin romper nada.

## DECISIÓN 2 — Multi-tenant *shared database* con `business_id` + RLS

**RAZÓN:** Hasta 100 000 negocios, *schema-per-tenant* o *db-per-tenant* son inviables operativamente.
El estándar SaaS B2B es shared schema + aislamiento por fila. El brief pide literalmente "Row Level Security".
**IMPACTO:** Toda tabla tenant-scoped lleva `business_id NOT NULL` + índice compuesto; toda policy usa
helpers `has_business_access()` / `has_permission()`. Escala horizontal de lectura con Réplicas de Supabase cuando toque.

## DECISIÓN 3 — Denegar por defecto + helpers `SECURITY DEFINER`

**RAZÓN:** Sin policy ⇒ sin acceso (Postgres). Helpers inmutables (`is_super_admin`, `has_business_access`,
`get_business_role`, `has_permission`, `current_employee_id`) centralizan el criterio y evitan policies divergentes.
**IMPACTO:** RBAC auditable en un solo lugar; los tests de aislamiento ("Business A no accede a Business B") se
ejecutan contra el mismo mecanismo que producción.

## DECISIÓN 4 — El público solo ve snapshots publicados (`website_releases`)

**RAZÓN:** El flujo DRAFT → PUBLICAR del brief exige que los borradores jamás se filtren. Editar tablas vivas y
"esconder" con flags es frágil. Serializar el sitio completo (branding + secciones + media + servicios visibles)
en un snapshot inmutable al publicar es atómico, versionado y ultrarrápido de servir.
**IMPACTO:** RPCs `get_public_site(slug)` leen solo el último release. Rollback gratis (re-publicar un release
anterior). El website builder edita tablas de trabajo; el visitante nunca las toca.

## DECISIÓN 5 — IA Groq con *tool calling* sobre métricas reales

**RAZÓN:** "Nunca inventar métricas" (brief §30). El modelo responde **solo** con datos que le entregan tools;
cada tool es una RPC SQL agregada (`ai_tool_revenue`, `ai_tool_at_risk_clients`, …). La `GROQ_API_KEY` vive en
secrets de Supabase; jamás en el bundle del frontend.
**IMPACTO:** Copiloto confiable y auditable (cada tool call queda registrado en `ai_messages.tool_calls`);
respuestas con cifras exactas del tenant del JWT — nunca de otro negocio.

## DECISIÓN 6 — Modo demo con mocks tipados en el frontend

**RAZÓN:** §55 pide datos de demostración para "evaluar visualmente el SaaS". Un switch `VITE_DEMO_MODE`
alimenta la UI con *BLACK HOUSE BARBER* sin credenciales: el producto se puede ver y usar de inmediato.
**IMPACTO:** Demo comercial instantánea; la capa `src/lib/api/` define contratos que cambian mock→Supabase
sin tocar componentes (Clean Architecture pragmática).

## DECISIÓN 7 — Roles/permisos normalizados y escalables

**RAZÓN:** El brief exige ampliar hacia RECEPTIONIST, BARBER, STYLIST, THERAPIST, CASHIER… Un enum congelaría
el modelo. Tablas `roles` + `permissions` + `role_permissions` (semilla del sistema, editables por Super Admin)
mantienen el RBAC vivo sin migraciones.
**IMPACTO:** `business_users.role_code` referencia `roles(code)`; `has_permission(business_id, 'sales.manage')`
resuelve todo. Nuevos roles = filas nuevas, cero código.

## DECISIÓN 8 — Website builder: un solo engine de componentes, themes como tokens

**RAZÓN:** §44: "No hacer cuatro sistemas diferentes". LUXURY / MODERN / MINIMAL / DARK / SOFT / ELEGANT son
paletas + tipografía + radios (tokens), no plantillas distintas. El orden y alta/baja de secciones es data
(`website_sections.position/active`), renderizado por un único `<SectionsRenderer/>`.
**IMPACTO:** Mantenibilidad ×1 engine; cada negocio se ve único sin fragmentar el código.

## DECISIÓN 9 — Citas multi-servicio (`appointment_items`) con precios snapshot

**RAZÓN:** Upselling ("Completa tu servicio"), combos (Corte + Barba) y comisiones por ítem requieren líneas
dentro de la cita. El precio se congela al reservar (historial íntegro aunque el servicio cambie después).
**IMPACTO:** `appointments` (cita) + `appointment_items` (líneas con `price`, `duration_min`, `employee_id`).
Rebooking, comisiones y beauty history cuelgan de ahí.

## DECISIÓN 10 — Multi-sucursal desde el día 1 (`locations`) con UI inicial single

**RAZÓN:** "Multi-sucursal preparada para crecimiento": añadir `locations` + `location_id` en
citas/ventas/empleados/ajustes cuesta poco hoy y evita una reescritura brutal mañana.
**IMPACTO:** El onboarding crea `Sucursal principal`; la UI muestra una sucursal (selector oculto hasta que
haya 2+). Los datos ya son multi-sucursal.

## DECISIÓN 11 — Stats de clientes cacheadas y recalculables

**RAZÓN:** "Clientes en riesgo" necesita `avg_recurrence_days`, `visit_count`, `total_spent`, `last_visit_at`
en milisegundos, no con scans por request. Columnas cacheadas + `refresh_customer_stats()` (RPC/job).
**IMPACTO:** Insights y segmentación instantáneos; el cálculo pesado corre en batch (cron de Supabase).

## DECISIÓN 12 — SPA con Vite (sin SSR)

**RAZÓN:** El brief fija Vite. El sitio público se alimenta de un snapshot JSON → render rápido; si el SEO
exige más adelante, se prerenderiza `/b/:slug` con un job estático sin reescribir el producto.
**IMPACTO:** Un solo build, despliegue estático (CDN), DX excelente. SEO futuro = prerender, no migración.

---

## Seguridad (§39 — checklist de diseño)

| Control | Cómo |
|---|---|
| Multi-tenancy estricto | `business_id` + RLS en el 100 % de tablas tenant |
| Row Level Security | Policies por operación; helpers SECURITY DEFINER |
| RBAC | `roles`/`permissions`/`role_permissions` + `has_permission()` en policies/RPCs sensibles |
| Validación backend | Constraints SQL + Zod en Edge Functions + validación en RPCs |
| Validación frontend | Zod + RHF (UX, no confianza) |
| Anti-IDOR | El `business_id` sale del JWT/membership, nunca del body del cliente |
| Anti escalamiento | `platform_role` solo modificable por Super Admin; `business_users` con `with check` por rol |
| Rate limiting | Edge Functions (módulo kv/limiter) en `create_booking`, `ai-copilot`, auth |
| Sanitización | `jsonb` validado; Markdown seguro en IA; sin HTML crudo de usuarios |
| Archivos | Storage buckets privados + políticas por prefijo `business_id/…`; tipo + tamaño validados |
| Sesiones | Supabase Auth (JWT rotados, refresh tokens); RLS valida cada query |
| Auditoría | `audit_logs` + triggers en entidades críticas (antes/después, usuario, IP) |
| Secrets | `GROQ_API_KEY` y credenciales solo en Supabase Secrets / `.env` local (gitignored) |

## Estructura de carpetas (feature-based, §53)

```
web/src/
  app/            Shell (sidebar, topbar, command palette, theme, toasts)
  components/ui/  Design system (button, card, dialog, skeleton, empty-state…)
  features/       auth · dashboard · agenda · clients · services · team · sales
                  inventory · loyalty · website · ai · settings · admin · landing
  lib/            supabase client · api/ (contratos + mock/supabase) · format · utils
  store/          Zustand (sesión, tenant activo, UI)
  types/          Domain types (espejo del modelo de datos)
  mocks/          Dataset demo BLACK HOUSE BARBER
```

Reglas: lógica de negocio **fuera** de componentes (en `features/*/services` o `lib/api`),
DTOs/schemas Zod compartidos, sin `any`, sin secretos en frontend, archivos < 300 líneas de preferencia.
