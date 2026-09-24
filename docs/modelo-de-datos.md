# 02 · Modelo de datos — Nuvia (PostgreSQL / Supabase)

Convenciones: `uuid` PKs (`gen_random_uuid()`), `created_at/updated_at timestamptz`, dinero `numeric(12,2)`,
tablas tenant con `business_id NOT NULL` + índice. Esquema completo ejecutable en
`supabase/migrations/20260921000001_init.sql`. **Todas** las tablas llevan RLS activo.

## Mapa de dominios

```
IDENTIDAD      users · roles · permissions · role_permissions
TENANT         businesses · locations · business_users · business_settings · business_branding
WEBSITE        business_website · website_sections · website_media · website_releases
CATÁLOGO       service_categories · services · employee_services · employees
AGENDA         appointments · appointment_items · appointment_status_history · waitlist
               business_hours · employee_schedules · time_off
CLIENTES       customers · customer_notes · customer_photos (Beauty History)
VENTAS         sales · sale_items · payments · products · inventory_movements · commissions
FIDELIZACIÓN   loyalty_accounts · loyalty_transactions · referrals
MARKETING      promotions · reviews · automation_rules · whatsapp_messages · notifications
IA             ai_conversations · ai_messages · ai_insights
PLATAFORMA     plans · subscriptions · audit_logs
```

## Entidades clave (notas de diseño)

### Identidad y tenant
- **users** — espejo de `auth.users` (trigger `handle_new_user`). `platform_role`: `USER | SUPER_ADMIN`.
- **businesses** — tenant. `slug` único (URL pública), `status`: `TRIAL | ACTIVE | SUSPENDED | CANCELLED`,
  `type`: `BARBERSHOP | SALON | SPA | AESTHETICS | NAILS | LASHES | BROWS | MASSAGE | OTHER`,
  `currency` (default `PEN`), `timezone` (default `America/Lima`).
- **locations** — multi-sucursal desde el día 1 (DECISIÓN 10). `is_default` marca la sucursal principal.
- **business_users** — membership `(business_id, user_id)` PK compuesta. `role_code` → `roles(code)`,
  `employee_id` opcional liga al trabajador (para "ver solo mi agenda"), `status: ACTIVE|INACTIVE|SUSPENDED`.
  Límite del plan (hoy 5 workers) se valida en la RPC/Edge de invitación con `plans.limits->>'max_employees'`.
- **business_settings** — reglas operativas en `jsonb`: duración de slot, anticipación mínima, ventana de
  cancelación, no-show fee, moneda, confirmaciones.
- **business_branding** — `preset` (`LUXURY|MODERN|MINIMAL|DARK|SOFT|ELEGANT`) + overrides `colors jsonb`,
  `font_key`, `logo_url`, `favicon_url`. Solo combinaciones seguras (validadas por schema Zod + presets).

### Website builder (DECISIÓN 8)
- **business_website** — estado del sitio: `slug público`, `tagline`, flags por sección activa.
- **website_sections** — filas editables: `type` (`HERO|SERVICES|ABOUT|GALLERY|TEAM|PROMOTIONS|TESTIMONIALS|
  LOCATION|CTA|FOOTER`), `position`, `active`, `content jsonb` (copia de trabajo / borrador).
- **website_media** — galería y assets: `role` (`HERO|GALLERY|LOGO|GALLERY_COVER…`), `position`, `alt`,
  `description`, `storage_path`.
- **website_releases** — snapshot `jsonb` inmutable del sitio completo al PUBLICAR. El público solo lee
  el release más reciente (`get_public_site`). Rollback = publicar release anterior (DECISIÓN 4).

### Catálogo y equipo
- **service_categories** — ordenadas (`position`) para la landing y el POS.
- **services** — `duration_min`, `price`, `active`, `show_on_website`, `image_url`, `category_id`.
- **employees** — profesionales: `role` (BARBER/STYLIST/…), `commission_rate`, `active`, `show_on_website`,
  `photo_url`, bio. Máx. 5 activos hoy (límite de plan).
- **employee_services** — qué servicios ofrece cada profesional (N–N con `price_override` opcional).
- **business_hours / employee_schedules / time_off** — horarios para disponibilidad y "demanda".

### Agenda (DECISIÓN 9)
- **appointments** — `scheduled_start/end`, `status: PENDING|CONFIRMED|IN_SERVICE|COMPLETED|CANCELLED|NO_SHOW`,
  `source: LANDING|DASHBOARD|WHATSAPP|WALK_IN|PHONE`, `price_total` (snapshot), `customer_id`, `employee_id`
  principal, `location_id`, `created_by`, `reminder_sent_at`, `cancel_reason`.
- **appointment_items** — líneas: `service_id`, `employee_id`, `qty`, `unit_price`, `duration_min`
  (permite upselling y combos).
- **appointment_status_history** — trazabilidad de cada transición de estado.
- **waitlist** — `service_id`, `employee_id?`, `preferred_date`, `time_range`, `priority`, `status:
  WAITING|MATCHED|BOOKED|EXPIRED|CANCELLED`. Al liberarse un hueco: matching automático (RPC) →
  "Se liberó un horario compatible" + invitación WhatsApp (Revenue Recovery §18).

### Clientes
- **customers** — por negocio (teléfono único por tenant). Stats cacheadas (DECISIÓN 11):
  `visit_count`, `total_spent`, `last_visit_at`, `avg_recurrence_days`, `recurrence_std_days`.
  `referral_code` único (p. ej. `MARIA-458`), `birth_date` (cumpleaños de fidelización), `whatsapp_opt_in`.
- **customer_notes** — notas de preferencias ("le gusta degradado bajo").
- **customer_photos** — **Beauty History**: `kind: BEFORE|AFTER|STYLE` + `service_id`, `employee_id`,
  vinculable a cita → "¿Quieres repetir tu último estilo?".

### Ventas y caja
- **sales** — cabecera: `subtotal`, `discount_total`, `total`, `status: OPEN|PAID|VOID`, `appointment_id?`,
  `customer_id?`, vendedor `employee_id`, `created_by`.
- **sale_items** — `item_type: SERVICE|PRODUCT`, snapshot `unit_price`, `qty`, `discount`, `total`,
  `employee_id` (quien atendió → base de comisión).
- **payments** — split por método: `method: CASH|YAPE|PLIN|CARD|OTHER`, `amount`, `reference`, `paid_at`.
  "Ventas por método" = agregado sobre esta tabla.
- **products / inventory_movements** — SKU, `stock`, `stock_min`; movimientos `IN|OUT|SALE|ADJUSTMENT`.
  Alertas "Stock bajo" vía `ai_insights` / notificaciones.
- **commissions** — por `sale_item_id`: `base_amount`, `rate`, `amount`, `status: PENDING|PAID`.
  Reglas por servicio/profesional = columnas + overrides futuros.

### Fidelización y marketing
- **loyalty_accounts** — `points`, `tier: STARTER|SILVER|GOLD|VIP`, `lifetime_points`.
  Progreso visual: `points / next_tier_at` (420/500 · barra).
- **loyalty_transactions** — `EARN|REDEEM|ADJUST|EXPIRE` con `reason` (cita, compra, referido, promo, cumpleaños)
  y referencia polimórfica `ref_type/ref_id`.
- **referrals** — código del cliente A; al completar primera compra de B → recompensa a A (todo registrado).
- **promotions** — "Martes Beauty": precio promo, descuento, vigencia, `service_id`, `show_on_website`.
- **reviews** — testimonios (fuente `MANUAL|GOOGLE`, `is_published`) para la sección de la landing.

### Automatización y comunicación
- **automation_rules** — `trigger_event` (`APPOINTMENT_CREATED|REMINDER_24H|APPOINTMENT_COMPLETED|
  NO_SHOW|CUSTOMER_AT_RISK|WAITLIST_SLOT_OPENED|BIRTHDAY|LOW_STOCK`), `channel: WHATSAPP|EMAIL|IN_APP`,
  plantilla con variables (`{{cliente}}`, `{{hora}}`…), `delay_minutes`, `is_enabled`.
- **whatsapp_messages** — log de envíos (estado `QUEUED|SENT|FAILED`) listo para Meta Cloud API / Evolution.
- **notifications** — centro de notificaciones in-app para el equipo.

### IA (Groq)
- **ai_conversations / ai_messages** — chat del Copiloto; `tool_calls jsonb` audita qué consultó.
- **ai_insights** — insights automáticos: `type: OPPORTUNITY|ALERT|ANOMALY|AT_RISK|WEAK_SLOTS|REBOOKING|
  UPSELL|LOW_STOCK`, `severity`, `data jsonb` (con botón "Ver clientes"), `status: NEW|ACTIONED|DISMISSED`.

### Plataforma (Super Admin)
- **plans** — `price_monthly`, `limits jsonb` (`max_employees`, `max_monthly_appointments`, `max_storage_mb`),
  `modules jsonb` (feature flags por plan).
- **subscriptions** — `status: TRIALING|ACTIVE|PAST_DUE|CANCELLED`, periodos, `trial_ends_at`.
- **audit_logs** — usuario, acción, entidad, `before/after jsonb`, IP. Escrito por `log_audit()` (triggers
  en servicios, empleados, planes, suscripciones, branding, settings) + llamadas explícitas de RPCs.

## Enums (tipos Postgres)

`user_platform_role` · `business_status` · `business_type` · `business_user_status` ·
`website_theme_preset` · `website_section_type` · `website_media_role` · `appointment_status` ·
`appointment_source` · `waitlist_status` · `sale_status` · `sale_item_type` · `payment_method` ·
`inventory_movement_type` · `commission_status` · `loyalty_tier` · `loyalty_txn_type` ·
`referral_status` · `review_source` · `automation_trigger` · `automation_channel` ·
`whatsapp_message_status` · `ai_insight_type` · `ai_insight_status` · `subscription_status` ·
`customer_photo_kind`

## Índices destacados

- `appointments (business_id, scheduled_start)` · `appointments (business_id, employee_id, scheduled_start)`
- `sales (business_id, created_at)` · `customers (business_id, phone)` únicos
- `website_releases (business_id, created_at desc)` · `audit_logs (business_id, created_at desc)`
- `whatsapp_messages (business_id, customer_id)` · `loyalty_transactions (account_id)`

## Funciones SQL (resumen)

| Función | Propósito |
|---|---|
| `is_super_admin() / has_business_access() / get_business_role() / has_permission() / current_employee_id()` | Helpers RLS |
| `log_audit()` | Auditoría genérica (triggers + RPCs) |
| `refresh_customer_stats(p_business_id)` | Recalcula recurrencia/CLV cacheado |
| `match_waitlist(p_appointment_id)` | Matching al liberarse un hueco |
| `get_recoverable_slots(p_business_id, p_days)` | Revenue Recovery: huecos recuperables |
| `get_public_site(p_slug) / get_public_availability(...) / create_booking(...)` | Sitio público + reservas (anon, SECURITY DEFINER) |
| `publish_website(p_business_id)` | Serializa draft → `website_releases` |
| `ai_tool_*` (revenue, top_services, at_risk, empty_slots, staff, payment_mix, new_customers) | Tools del Copiloto Groq |
