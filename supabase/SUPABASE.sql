-- Nuvia · instalación NUEVA exclusivamente (2026-09-24).
-- NO idempotente. NO ejecutar en un proyecto Nuvia existente.
-- Existentes: seguir README; aplicar incrementales 03/04 solo si faltan.
-- Solo esquema, RBAC y dos planes; no usuarios Auth, contraseñas ni datos demo.
-- Generado por python3 supabase/compose_sql.py; modificar las migraciones originales.
do $$ begin
 if to_regclass('public.businesses') is not null or to_regclass('public.plans') is not null then
  raise exception 'Nuvia ya existe. No ejecutar SUPABASE.sql: utilizar la migración incremental documentada.';
 end if;
end $$;

-- FUENTE: migrations/20260921000001_init.sql
-- ============================================================================
-- 💎 Nuvia — Migración inicial (2026-09-21)
-- PostgreSQL 15+ (Supabase) · Multi-tenant estricto con RLS denegar-por-defecto
-- Contenido: helpers · enums · tablas · triggers · auditoría · RLS · RPCs ·
--            analytics · tools IA (Groq) · storage
-- Ejecutar en el SQL Editor de Supabase o con `supabase db push`.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. HELPERS RLS (SECURITY DEFINER · STABLE)
-- ────────────────────────────────────────────────────────────────────────────
--- (helpers RLS movidos al bloque 11b, tras las tablas) ---

-- 2. ENUMS
-- ────────────────────────────────────────────────────────────────────────────
create type user_platform_role    as enum ('USER','SUPER_ADMIN');
create type business_status       as enum ('TRIAL','ACTIVE','SUSPENDED','CANCELLED');
create type business_type         as enum ('BARBERSHOP','SALON','SPA','AESTHETICS','NAILS','LASHES','BROWS','MASSAGE','OTHER');
create type business_user_status  as enum ('ACTIVE','INACTIVE','SUSPENDED');
create type website_theme_preset  as enum ('LUXURY','MODERN','MINIMAL','DARK','SOFT','ELEGANT');
create type website_section_type  as enum ('HERO','SERVICES','ABOUT','GALLERY','TEAM','PROMOTIONS','TESTIMONIALS','LOCATION','CTA','FOOTER');
create type website_media_role    as enum ('LOGO','FAVICON','HERO','GALLERY','ABOUT','SERVICE','TEAM','PROMO');
create type appointment_status    as enum ('PENDING','CONFIRMED','IN_SERVICE','COMPLETED','CANCELLED','NO_SHOW');
create type appointment_source    as enum ('LANDING','DASHBOARD','WHATSAPP','WALK_IN','PHONE');
create type waitlist_status       as enum ('WAITING','MATCHED','BOOKED','EXPIRED','CANCELLED');
create type sale_status           as enum ('OPEN','PAID','VOID');
create type sale_item_type        as enum ('SERVICE','PRODUCT');
create type payment_method        as enum ('CASH','YAPE','PLIN','CARD','OTHER');
create type inventory_move_type   as enum ('IN','OUT','SALE','ADJUSTMENT');
create type commission_status     as enum ('PENDING','PAID');
create type loyalty_tier          as enum ('STARTER','SILVER','GOLD','VIP');
create type loyalty_txn_type      as enum ('EARN','REDEEM','ADJUST','EXPIRE');
create type referral_status       as enum ('PENDING','COMPLETED','REWARDED');
create type review_source         as enum ('MANUAL','GOOGLE');
create type automation_trigger    as enum ('APPOINTMENT_CREATED','REMINDER_24H','APPOINTMENT_COMPLETED','NO_SHOW','CUSTOMER_AT_RISK','WAITLIST_SLOT_OPENED','BIRTHDAY','LOW_STOCK');
create type automation_channel    as enum ('WHATSAPP','EMAIL','IN_APP');
create type whatsapp_msg_status   as enum ('QUEUED','SENT','FAILED');
create type ai_insight_type       as enum ('OPPORTUNITY','ALERT','ANOMALY','AT_RISK','WEAK_SLOTS','REBOOKING','UPSELL','LOW_STOCK');
create type ai_insight_status     as enum ('NEW','ACTIONED','DISMISSED');
create type subscription_status   as enum ('TRIALING','ACTIVE','PAST_DUE','CANCELLED');
create type customer_photo_kind   as enum ('BEFORE','AFTER','STYLE');

-- ────────────────────────────────────────────────────────────────────────────
-- 3. TABLAS — IDENTIDAD Y TENANT
-- ────────────────────────────────────────────────────────────────────────────
create table public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null unique,
  full_name     text not null default '',
  phone         text,
  avatar_url    text,
  platform_role user_platform_role not null default 'USER',
  locale        text not null default 'es-PE',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.roles (
  code        text primary key,
  name        text not null,
  description text not null default '',
  is_system   boolean not null default true
);

create table public.permissions (
  key         text primary key,
  name        text not null,
  category    text not null
);

create table public.role_permissions (
  role_code      text not null references public.roles (code) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role_code, permission_key)
);

create table public.businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  type        business_type not null default 'OTHER',
  status      business_status not null default 'TRIAL',
  description text not null default '',
  phone       text,
  whatsapp    text,
  email       text,
  address     text,
  currency    text not null default 'PEN',
  timezone    text not null default 'America/Lima',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.locations (
  id         uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name       text not null default 'Sucursal principal',
  address    text,
  city       text,
  phone      text,
  geo        jsonb,                         -- { lat, lng } para Google Maps
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index locations_business_idx on public.locations (business_id);

create table public.business_users (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  role_code   text not null references public.roles (code),
  employee_id uuid,                        -- liga al trabajador (agenda propia) — FK abajo
  status      business_user_status not null default 'ACTIVE',
  invited_by  uuid references public.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_users_user_idx on public.business_users (user_id);

create table public.business_settings (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  slot_minutes          int not null default 30,
  min_lead_minutes      int not null default 60,     -- anticipación mínima para reservar
  cancel_window_hours   int not null default 12,
  confirm_appointments  boolean not null default true,
  reminder_hours_before int not null default 24,
  rebooking_days        int not null default 28,     -- "¿Cuándo deberías regresar?"
  welcome_message       text not null default '',
  updated_at timestamptz not null default now()
);

create table public.business_branding (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  preset      website_theme_preset not null default 'MODERN',
  colors      jsonb not null default '{}'::jsonb,    -- overrides validados: primary, secondary, button, bg
  font_key    text not null default 'sans',          -- sans | serif | display (predefinidos)
  logo_url    text,
  favicon_url text,
  cover_url   text,
  updated_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. WEBSITE BUILDER (draft en tablas · público solo lee releases)
-- ────────────────────────────────────────────────────────────────────────────
create table public.business_website (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  tagline     text not null default '',
  socials     jsonb not null default '{}'::jsonb,    -- { instagram, tiktok, facebook }
  map_query   text not null default '',             -- embed/consulta Google Maps
  updated_at  timestamptz not null default now()
);

create table public.website_sections (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  type        website_section_type not null,
  position    int not null default 0,
  active      boolean not null default true,
  content     jsonb not null default '{}'::jsonb,   -- copia de trabajo (borrador)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, type)
);
create index website_sections_order_idx on public.website_sections (business_id, position);

create table public.website_media (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  role         website_media_role not null default 'GALLERY',
  storage_path text not null,
  alt          text not null default '',
  description  text not null default '',
  position     int not null default 0,
  is_cover     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index website_media_business_idx on public.website_media (business_id, role, position);

create table public.website_releases (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  snapshot    jsonb not null,
  note        text not null default '',
  published_by uuid references public.users (id),
  created_at  timestamptz not null default now()
);
create index website_releases_latest_idx on public.website_releases (business_id, created_at desc);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. CATÁLOGO Y EQUIPO
-- ────────────────────────────────────────────────────────────────────────────
create table public.service_categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index service_categories_business_idx on public.service_categories (business_id);

create table public.services (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category_id uuid references public.service_categories (id) on delete set null,
  name        text not null,
  description text not null default '',
  duration_min int not null check (duration_min > 0),
  price       numeric(12,2) not null check (price >= 0),
  image_url   text,
  active      boolean not null default true,
  show_on_website boolean not null default true,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index services_business_idx on public.services (business_id, active);

create table public.employees (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  location_id uuid references public.locations (id) on delete set null,
  full_name   text not null,
  role_label  text not null default '',            -- "Barber", "Stylist", "Nail Artist"…
  specialty   text not null default '',
  bio         text not null default '',
  photo_url   text,
  phone       text,
  commission_rate numeric(5,2) not null default 10.00 check (commission_rate between 0 and 100),
  active      boolean not null default true,
  show_on_website boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index employees_business_idx on public.employees (business_id, active);

alter table public.business_users
  add constraint business_users_employee_fk
  foreign key (employee_id) references public.employees (id) on delete set null;

create table public.employee_services (
  employee_id uuid not null references public.employees (id) on delete cascade,
  service_id  uuid not null references public.services (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  price_override numeric(12,2),
  primary key (employee_id, service_id)
);
create index employee_services_business_idx on public.employee_services (business_id);

create table public.business_hours (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  location_id uuid references public.locations (id) on delete cascade,
  weekday     int not null check (weekday between 0 and 6),   -- 0 = domingo
  open_time   time not null default '09:00',
  close_time  time not null default '20:00',
  is_closed   boolean not null default false
);
create index business_hours_lookup_idx on public.business_hours (business_id, location_id, weekday);

create table public.employee_schedules (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  weekday     int not null check (weekday between 0 and 6),
  start_time  time not null,
  end_time    time not null
);
create index employee_schedules_emp_idx on public.employee_schedules (employee_id, weekday);

create table public.time_off (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text not null default '',
  created_at  timestamptz not null default now()
);
create index time_off_emp_idx on public.time_off (employee_id, starts_at);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. CLIENTES + BEAUTY HISTORY
-- ────────────────────────────────────────────────────────────────────────────
create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  full_name   text not null,
  phone       text not null,
  email       text,
  birth_date  date,
  whatsapp_opt_in boolean not null default true,
  notes_summary   text not null default '',
  referral_code   text not null,
  -- stats cacheadas (DECISIÓN 11 · refresh_customer_stats)
  visit_count       int not null default 0,
  total_spent       numeric(12,2) not null default 0,
  last_visit_at     timestamptz,
  avg_recurrence_days int,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, phone),
  unique (business_id, referral_code)
);
create index customers_business_idx on public.customers (business_id);
create index customers_risk_idx on public.customers (business_id, last_visit_at);

create table public.customer_notes (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  created_by  uuid references public.users (id),
  note        text not null,
  created_at  timestamptz not null default now()
);
create index customer_notes_customer_idx on public.customer_notes (customer_id);

create table public.customer_photos (                -- §20 Beauty History (antes/después)
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  customer_id  uuid not null references public.customers (id) on delete cascade,
  appointment_id uuid,                                -- FK abajo
  kind         customer_photo_kind not null default 'STYLE',
  storage_path text not null,
  service_id   uuid references public.services (id) on delete set null,
  employee_id  uuid references public.employees (id) on delete set null,
  notes        text not null default '',
  taken_at     timestamptz not null default now()
);
create index customer_photos_customer_idx on public.customer_photos (customer_id, taken_at desc);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. AGENDA
-- ────────────────────────────────────────────────────────────────────────────
create table public.appointments (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  location_id uuid references public.locations (id) on delete set null,
  customer_id uuid not null references public.customers (id) on delete cascade,
  employee_id uuid references public.employees (id) on delete set null,  -- profesional principal
  status      appointment_status not null default 'PENDING',
  source      appointment_source not null default 'DASHBOARD',
  scheduled_start timestamptz not null,
  scheduled_end   timestamptz not null,
  price_total numeric(12,2) not null default 0,      -- snapshot al reservar (DECISIÓN 9)
  notes       text not null default '',
  cancel_reason text not null default '',
  reminder_sent_at timestamptz,
  created_by  uuid references public.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (scheduled_end > scheduled_start)
);
create index appointments_day_idx     on public.appointments (business_id, scheduled_start);
create index appointments_emp_idx     on public.appointments (business_id, employee_id, scheduled_start);
create index appointments_customer_idx on public.appointments (customer_id);

create table public.appointment_items (
  id            uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  business_id   uuid not null references public.businesses (id) on delete cascade,
  service_id    uuid not null references public.services (id),
  employee_id   uuid references public.employees (id) on delete set null,
  qty           int not null default 1 check (qty > 0),
  unit_price    numeric(12,2) not null check (unit_price >= 0),  -- snapshot
  duration_min  int not null check (duration_min > 0),
  created_at    timestamptz not null default now()
);
create index appointment_items_appt_idx on public.appointment_items (appointment_id);

create table public.appointment_status_history (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  business_id    uuid not null references public.businesses (id) on delete cascade,
  from_status    appointment_status,
  to_status      appointment_status not null,
  changed_by     uuid references public.users (id),
  created_at     timestamptz not null default now()
);

create table public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  service_id  uuid not null references public.services (id) on delete cascade,
  employee_id uuid references public.employees (id) on delete cascade,
  preferred_date date,
  time_start  time,
  time_end    time,
  priority    int not null default 0,
  status      waitlist_status not null default 'WAITING',
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index waitlist_match_idx on public.waitlist (business_id, service_id, status);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. VENTAS · CAJA · INVENTARIO · COMISIONES
-- ────────────────────────────────────────────────────────────────────────────
create table public.sales (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  location_id uuid references public.locations (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  employee_id uuid references public.employees (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  status      sale_status not null default 'PAID',
  subtotal    numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  total       numeric(12,2) not null default 0,
  created_by  uuid references public.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index sales_business_idx on public.sales (business_id, created_at desc);

create table public.sale_items (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references public.sales (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  item_type   sale_item_type not null,
  service_id  uuid references public.services (id) on delete set null,
  product_id  uuid,                                   -- FK abajo
  description text not null default '',               -- snapshot del nombre
  qty         int not null default 1 check (qty > 0),
  unit_price  numeric(12,2) not null check (unit_price >= 0),
  discount    numeric(12,2) not null default 0,
  total       numeric(12,2) not null default 0,
  employee_id uuid references public.employees (id) on delete set null,  -- atendió → comisión
  created_at  timestamptz not null default now()
);
create index sale_items_sale_idx on public.sale_items (sale_id);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references public.sales (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  method      payment_method not null,
  amount      numeric(12,2) not null check (amount > 0),
  reference   text not null default '',               -- op. Yape/Plin, últimos 4 de tarjeta
  paid_at     timestamptz not null default now(),
  created_by  uuid references public.users (id)
);
create index payments_sale_idx on public.payments (sale_id);

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null,
  sku         text not null default '',
  category    text not null default '',
  price       numeric(12,2) not null check (price >= 0),
  cost        numeric(12,2) not null default 0,
  stock       int not null default 0,
  stock_min   int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, sku)
);
create index products_business_idx on public.products (business_id, active);

alter table public.sale_items
  add constraint sale_items_product_fk
  foreign key (product_id) references public.products (id) on delete set null;

create table public.inventory_movements (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  type        inventory_move_type not null,
  qty         int not null,
  unit_cost   numeric(12,2),
  note        text not null default '',
  created_by  uuid references public.users (id),
  created_at  timestamptz not null default now()
);

create table public.commissions (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  employee_id   uuid not null references public.employees (id) on delete cascade,
  sale_item_id  uuid references public.sale_items (id) on delete set null,
  base_amount   numeric(12,2) not null,
  rate          numeric(5,2) not null,
  amount        numeric(12,2) not null,
  status        commission_status not null default 'PENDING',
  period_start  date,
  period_end    date,
  created_at    timestamptz not null default now(),
  paid_at       timestamptz
);
create index commissions_emp_idx on public.commissions (business_id, employee_id, created_at desc);

alter table public.customer_photos
  add constraint customer_photos_appointment_fk
  foreign key (appointment_id) references public.appointments (id) on delete set null;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. FIDELIZACIÓN · MARKETING
-- ────────────────────────────────────────────────────────────────────────────
create table public.loyalty_accounts (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  customer_id   uuid not null unique references public.customers (id) on delete cascade,
  points        int not null default 0,
  lifetime_points int not null default 0,
  tier          loyalty_tier not null default 'STARTER',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.loyalty_transactions (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  account_id  uuid not null references public.loyalty_accounts (id) on delete cascade,
  type        loyalty_txn_type not null,
  points      int not null,
  reason      text not null default '',               -- cita, compra, referido, promo, cumpleaños
  ref_type    text,
  ref_id      uuid,
  created_by  uuid references public.users (id),
  created_at  timestamptz not null default now()
);
create index loyalty_txn_account_idx on public.loyalty_transactions (account_id);

create table public.referrals (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  code        text not null,
  referrer_customer_id uuid not null references public.customers (id) on delete cascade,
  referred_customer_id uuid references public.customers (id) on delete set null,
  status      referral_status not null default 'PENDING',
  reward_points int not null default 0,
  created_at  timestamptz not null default now(),
  completed_at timestamptz,
  unique (business_id, code)
);

create table public.promotions (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  service_id  uuid references public.services (id) on delete set null,
  name        text not null,
  description text not null default '',
  image_url   text,
  price       numeric(12,2),
  discount_percent numeric(5,2) not null default 0,
  starts_at   date not null,
  ends_at     date not null,
  is_active   boolean not null default true,
  show_on_website boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.reviews (                            -- testimonios (§12)
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  author_name text not null,
  rating      int not null default 5 check (rating between 1 and 5),
  content     text not null,
  photo_url   text,
  source      review_source not null default 'MANUAL',
  is_published boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.automation_rules (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null,
  trigger_event automation_trigger not null,
  channel     automation_channel not null default 'WHATSAPP',
  template    text not null,                            -- {{cliente}} {{servicio}} {{hora}}…
  delay_minutes int not null default 0,
  conditions  jsonb not null default '{}'::jsonb,
  is_enabled  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.whatsapp_messages (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  rule_id     uuid references public.automation_rules (id) on delete set null,
  to_phone    text not null,
  body        text not null,
  status      whatsapp_msg_status not null default 'QUEUED',
  provider_ref text not null default '',
  error       text not null default '',
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index whatsapp_log_idx on public.whatsapp_messages (business_id, customer_id, created_at desc);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  user_id     uuid references public.users (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text not null default '',
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ────────────────────────────────────────────────────────────────────────────
-- 10. IA (Groq)
-- ────────────────────────────────────────────────────────────────────────────
create table public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  title       text not null default 'Nueva conversación',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.ai_messages (
  id             uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  business_id    uuid not null references public.businesses (id) on delete cascade,
  role           text not null check (role in ('user','assistant','tool')),
  content        text not null default '',
  tool_calls     jsonb not null default '[]'::jsonb,   -- auditoría: qué tools consultó (§30)
  created_at     timestamptz not null default now()
);
create index ai_messages_conv_idx on public.ai_messages (conversation_id, created_at);

create table public.ai_insights (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  type        ai_insight_type not null,
  severity    text not null default 'info' check (severity in ('info','warning','critical')),
  title       text not null,
  body        text not null default '',
  data        jsonb not null default '{}'::jsonb,      -- { customer_ids: [...] } → botón "Ver clientes"
  status      ai_insight_status not null default 'NEW',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index ai_insights_business_idx on public.ai_insights (business_id, status, created_at desc);

-- ────────────────────────────────────────────────────────────────────────────
-- 11. PLATAFORMA (Super Admin)
-- ────────────────────────────────────────────────────────────────────────────
create table public.plans (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,                  -- STARTER | PRO | BUSINESS
  name          text not null,
  description   text not null default '',
  price_monthly numeric(12,2) not null default 0,
  currency      text not null default 'PEN',
  limits        jsonb not null default '{}'::jsonb,    -- { max_employees, max_monthly_appointments, max_storage_mb }
  modules       jsonb not null default '{}'::jsonb,    -- feature flags
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.subscriptions (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  plan_id     uuid not null references public.plans (id),
  status      subscription_status not null default 'TRIALING',
  trial_ends_at timestamptz,
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz not null default (now() + interval '1 month'),
  cancel_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index subscriptions_business_idx on public.subscriptions (business_id);

create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  user_id     uuid references public.users (id),
  action      text not null,                           -- INSERT | UPDATE | DELETE | CUSTOM
  entity_table text not null,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  ip          text,
  created_at  timestamptz not null default now()
);
create index audit_logs_business_idx on public.audit_logs (business_id, created_at desc);

-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.current_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select auth.uid();
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.platform_role = 'SUPER_ADMIN'
  );
$$;

create or replace function public.has_business_access(p_business_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_users bu
    where bu.business_id = p_business_id
      and bu.user_id = auth.uid()
      and bu.status = 'ACTIVE'
  );
$$;

create or replace function public.get_business_role(p_business_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select bu.role_code from public.business_users bu
  where bu.business_id = p_business_id and bu.user_id = auth.uid() and bu.status = 'ACTIVE';
$$;

create or replace function public.has_permission(p_business_id uuid, p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.business_users bu
    join public.role_permissions rp on rp.role_code = bu.role_code
    where bu.business_id = p_business_id
      and bu.user_id = auth.uid()
      and bu.status = 'ACTIVE'
      and rp.permission_key = p_permission
  );
$$;

create or replace function public.current_employee_id(p_business_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select bu.employee_id from public.business_users bu
  where bu.business_id = p_business_id and bu.user_id = auth.uid() and bu.status = 'ACTIVE';
$$;

create or replace function public.log_audit(
  p_business_id uuid, p_action text, p_entity text, p_entity_id uuid, p_before jsonb, p_after jsonb
) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_logs (business_id, user_id, action, entity_table, entity_id, before, after)
  values (p_business_id, auth.uid(), p_action, p_entity, p_entity_id, p_before, p_after);
$$;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 12. TRIGGERS (updated_at · auth · protección · auditoría · status history)
-- ────────────────────────────────────────────────────────────────────────────
drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array[
    'businesses','locations','business_users','business_settings','business_branding',
    'business_website','website_sections','services','service_categories','employees',
    'customers','appointments','waitlist','sales','sale_items','products','promotions',
    'automation_rules','plans','subscriptions','loyalty_accounts','ai_conversations'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- Alta de usuario desde Supabase Auth → public.users
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, phone)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Protección de columnas críticas del tenant (§39 anti escalamiento)
create or replace function public.protect_business_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    if new.slug is distinct from old.slug
       or new.status is distinct from old.status
       or new.type is distinct from old.type then
      raise exception 'Solo Super Admin puede modificar slug, estado o tipo del negocio';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_business_columns on public.businesses;
create trigger protect_business_columns before update on public.businesses
  for each row execute function public.protect_business_columns();

-- Un BUSINESS_ADMIN no crea ni promueve otros BUSINESS_ADMIN (§3)
create or replace function public.protect_business_users() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    if tg_op = 'INSERT' and new.role_code = 'BUSINESS_ADMIN' then
      raise exception 'Solo Super Admin puede asignar el rol BUSINESS_ADMIN';
    end if;
    if tg_op = 'UPDATE' then
      if new.role_code is distinct from old.role_code and new.role_code = 'BUSINESS_ADMIN' then
        raise exception 'Solo Super Admin puede promover a BUSINESS_ADMIN';
      end if;
      if old.role_code = 'BUSINESS_ADMIN' then
        raise exception 'Solo Super Admin puede modificar a un BUSINESS_ADMIN';
      end if;
    end if;
    if tg_op = 'DELETE' and old.role_code = 'BUSINESS_ADMIN' then
      raise exception 'Solo Super Admin puede eliminar a un BUSINESS_ADMIN';
    end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists protect_business_users on public.business_users;
create trigger protect_business_users before insert or update or delete on public.business_users
  for each row execute function public.protect_business_users();

-- Historial de estados de cita (§16)
create or replace function public.appointment_status_tg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.appointment_status_history (appointment_id, business_id, from_status, to_status, changed_by)
    values (new.id, new.business_id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.appointment_status_history (appointment_id, business_id, from_status, to_status, changed_by)
    values (new.id, new.business_id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists appointment_status_tg on public.appointments;
create trigger appointment_status_tg after insert or update on public.appointments
  for each row execute function public.appointment_status_tg();

-- Auditoría automática en entidades críticas (§38) — resiliente a tablas sin business_id (plans)
create or replace function public.audit_tg() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_after  jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_business uuid;
begin
  v_business := coalesce(
    case when v_after  ? 'business_id' then (v_after->>'business_id')::uuid end,
    case when v_before ? 'business_id' then (v_before->>'business_id')::uuid end
  );
  perform public.log_audit(
    v_business, tg_op, tg_table_name,
    coalesce((v_after->>'id')::uuid, (v_before->>'id')::uuid),
    v_before, v_after
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['services','employees','plans','subscriptions','business_branding','business_settings','products'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_tg()', t || '_audit', t);
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 13. RLS — denegar por defecto · helper de policies reutilizables
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public._tpl(p_table text, p_read text, p_write text) returns void
language plpgsql as $$
begin
  execute format('alter table public.%I enable row level security', p_table);
  execute format($f$create policy "sel" on public.%I for select to authenticated
    using (public.is_super_admin() or (public.has_business_access(business_id)
      and (%L::text is null or public.has_permission(business_id, %L::text))))$f$, p_table, p_read, p_read);
  execute format($f$create policy "ins" on public.%I for insert to authenticated
    with check (public.is_super_admin() or (public.has_business_access(business_id)
      and public.has_permission(business_id, %L::text)))$f$, p_table, p_write);
  execute format($f$create policy "upd" on public.%I for update to authenticated
    using (public.is_super_admin() or (public.has_business_access(business_id)
      and public.has_permission(business_id, %L::text)))
    with check (public.is_super_admin() or (public.has_business_access(business_id)
      and public.has_permission(business_id, %L::text)))$f$, p_table, p_write, p_write);
  execute format($f$create policy "del" on public.%I for delete to authenticated
    using (public.is_super_admin() or (public.has_business_access(business_id)
      and public.get_business_role(business_id) = 'BUSINESS_ADMIN'))$f$, p_table);
end $$;

select public._tpl('locations',           null,                 'settings.manage');
select public._tpl('business_settings',   null,                 'settings.manage');
select public._tpl('business_branding',   null,                 'website.manage');
select public._tpl('business_website',    null,                 'website.manage');
select public._tpl('website_sections',    null,                 'website.manage');
select public._tpl('website_media',       null,                 'website.manage');
select public._tpl('service_categories',  'services.view',      'services.manage');
select public._tpl('services',            'services.view',      'services.manage');
select public._tpl('employees',           'team.view',          'team.manage');
select public._tpl('employee_services',   'services.view',      'team.manage');
select public._tpl('business_hours',      null,                 'settings.manage');
select public._tpl('employee_schedules',  'team.view',          'team.manage');
select public._tpl('time_off',            'team.view',          'team.manage');
select public._tpl('customers',           'clients.view',       'clients.manage');
select public._tpl('customer_notes',      'clients.view',       'clients.manage');
select public._tpl('customer_photos',     'clients.view',       'clients.manage');
select public._tpl('sales',               'sales.view',         'sales.manage');
select public._tpl('sale_items',          'sales.view',         null);
select public._tpl('payments',            'sales.view',         'sales.manage');
select public._tpl('products',            'inventory.view',     'inventory.manage');
select public._tpl('inventory_movements', 'inventory.view',     'inventory.manage');
select public._tpl('loyalty_accounts',    'clients.view',       'loyalty.manage');
select public._tpl('loyalty_transactions','clients.view',       'loyalty.manage');
select public._tpl('referrals',           'clients.view',       'loyalty.manage');
select public._tpl('promotions',          null,                 'loyalty.manage');
select public._tpl('reviews',             null,                 'website.manage');
select public._tpl('automation_rules',    'whatsapp.manage',    'whatsapp.manage');
select public._tpl('whatsapp_messages',   'whatsapp.manage',    null);
select public._tpl('ai_conversations',    'ai.use',             'ai.use');
select public._tpl('ai_messages',         'ai.use',             null);
select public._tpl('ai_insights',         'ai.use',             'ai.use');
select public._tpl('waitlist',            'calendar.view_all',  'calendar.manage');

drop function public._tpl(text, text, text);

-- Policies especiales
-- users: ver propio + compañeros de negocio; editar solo propio (Super Admin: todo)
alter table public.users enable row level security;
create policy users_sel on public.users for select to authenticated
  using (id = auth.uid() or public.is_super_admin() or exists (
    select 1 from public.business_users bu
    where bu.user_id = public.users.id and public.has_business_access(bu.business_id)));
create policy users_upd on public.users for update to authenticated
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

-- businesses: miembros ven los suyos; alta/estado solo Super Admin (trigger protege columnas)
alter table public.businesses enable row level security;
create policy businesses_sel on public.businesses for select to authenticated
  using (public.is_super_admin() or public.has_business_access(id));
create policy businesses_ins on public.businesses for insert to authenticated
  with check (public.is_super_admin());
create policy businesses_upd on public.businesses for update to authenticated
  using (public.is_super_admin() or (public.has_business_access(id) and public.get_business_role(id) = 'BUSINESS_ADMIN'))
  with check (public.is_super_admin() or (public.has_business_access(id) and public.get_business_role(id) = 'BUSINESS_ADMIN'));
create policy businesses_del on public.businesses for delete to authenticated
  using (public.is_super_admin());

-- business_users: memberships (triggers blindan escalamiento)
alter table public.business_users enable row level security;
create policy bu_sel on public.business_users for select to authenticated
  using (public.is_super_admin() or public.has_business_access(business_id));
create policy bu_ins on public.business_users for insert to authenticated
  with check (public.is_super_admin() or (public.has_business_access(business_id)
    and public.get_business_role(business_id) = 'BUSINESS_ADMIN'));
create policy bu_upd on public.business_users for update to authenticated
  using (public.is_super_admin() or (public.has_business_access(business_id)
    and public.get_business_role(business_id) = 'BUSINESS_ADMIN'))
  with check (public.is_super_admin() or (public.has_business_access(business_id)
    and public.get_business_role(business_id) = 'BUSINESS_ADMIN'));
create policy bu_del on public.business_users for delete to authenticated
  using (public.is_super_admin() or (public.has_business_access(business_id)
    and public.get_business_role(business_id) = 'BUSINESS_ADMIN'));

-- appointments: view_all O solo mi agenda (worker con employee_id)
alter table public.appointments enable row level security;
create policy appt_sel on public.appointments for select to authenticated
  using (public.is_super_admin() or (public.has_business_access(business_id)
    and (public.has_permission(business_id, 'calendar.view_all')
         or employee_id = public.current_employee_id(business_id))));
create policy appt_ins on public.appointments for insert to authenticated
  with check (public.is_super_admin() or public.has_permission(business_id, 'calendar.manage'));
create policy appt_upd on public.appointments for update to authenticated
  using (public.is_super_admin() or public.has_permission(business_id, 'calendar.manage'))
  with check (public.is_super_admin() or public.has_permission(business_id, 'calendar.manage'));
create policy appt_del on public.appointments for delete to authenticated
  using (public.is_super_admin() or public.get_business_role(business_id) = 'BUSINESS_ADMIN');

-- appointment_items / status_history: acceso vía cita padre
alter table public.appointment_items enable row level security;
create policy items_sel on public.appointment_items for select to authenticated
  using (exists (select 1 from public.appointments a where a.id = appointment_id
    and (public.is_super_admin() or (public.has_business_access(a.business_id)
      and (public.has_permission(a.business_id, 'calendar.view_all')
           or a.employee_id = public.current_employee_id(a.business_id))))));
create policy items_ins on public.appointment_items for insert to authenticated
  with check (public.is_super_admin() or public.has_permission(business_id, 'calendar.manage'));
create policy items_upd on public.appointment_items for update to authenticated
  using (public.is_super_admin() or public.has_permission(business_id, 'calendar.manage'))
  with check (true);
create policy items_del on public.appointment_items for delete to authenticated
  using (public.is_super_admin() or public.has_permission(business_id, 'calendar.manage'));

alter table public.appointment_status_history enable row level security;
create policy hist_sel on public.appointment_status_history for select to authenticated
  using (public.is_super_admin() or public.has_business_access(business_id));
create policy hist_ins on public.appointment_status_history for insert to authenticated
  with check (public.is_super_admin() or public.has_permission(business_id, 'calendar.manage'));

-- commissions: todas (commissions.view_all) o solo las propias (commissions.view_own)
alter table public.commissions enable row level security;
create policy comm_sel on public.commissions for select to authenticated
  using (public.is_super_admin() or (public.has_business_access(business_id)
    and (public.has_permission(business_id, 'commissions.view_all')
         or (public.has_permission(business_id, 'commissions.view_own')
             and employee_id = public.current_employee_id(business_id)))));
create policy comm_ins on public.commissions for insert to authenticated
  with check (public.is_super_admin() or public.has_permission(business_id, 'sales.manage'));
create policy comm_upd on public.commissions for update to authenticated
  using (public.is_super_admin() or public.has_permission(business_id, 'sales.manage'))
  with check (true);

-- website_releases: solo lectura para miembros · escritura únicamente vía publish_website()
alter table public.website_releases enable row level security;
create policy releases_sel on public.website_releases for select to authenticated
  using (public.is_super_admin() or public.has_business_access(business_id));

-- notifications: propias (o del negocio para admins con whatsapp.manage)
alter table public.notifications enable row level security;
create policy notif_sel on public.notifications for select to authenticated
  using (public.is_super_admin() or user_id = auth.uid()
    or (public.has_business_access(business_id) and public.has_permission(business_id, 'whatsapp.manage')));
create policy notif_upd on public.notifications for update to authenticated
  using (user_id = auth.uid() or public.is_super_admin())
  with check (true);
create policy notif_ins on public.notifications for insert to authenticated
  with check (public.is_super_admin() or public.has_business_access(business_id));

-- roles/permissions: lectura para autenticados · escritura solo Super Admin
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
create policy roles_sel on public.roles for select to authenticated using (true);
create policy perms_sel on public.permissions for select to authenticated using (true);
create policy roleperms_sel on public.role_permissions for select to authenticated using (true);
create policy roles_w on public.roles for insert to authenticated with check (public.is_super_admin());
create policy perms_w on public.permissions for insert to authenticated with check (public.is_super_admin());
create policy roleperms_w on public.role_permissions for insert to authenticated with check (public.is_super_admin());

-- plans: lectura autenticados · escritura Super Admin
alter table public.plans enable row level security;
create policy plans_sel on public.plans for select to authenticated using (true);
create policy plans_ins on public.plans for insert to authenticated with check (public.is_super_admin());
create policy plans_upd on public.plans for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy plans_del on public.plans for delete to authenticated using (public.is_super_admin());

-- subscriptions: miembros ven la suya · escritura Super Admin
alter table public.subscriptions enable row level security;
create policy subs_sel on public.subscriptions for select to authenticated
  using (public.is_super_admin() or public.has_business_access(business_id));
create policy subs_ins on public.subscriptions for insert to authenticated with check (public.is_super_admin());
create policy subs_upd on public.subscriptions for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- audit_logs: solo lectura (Super Admin global · BUSINESS_ADMIN de su tenant) · escritura vía log_audit()
alter table public.audit_logs enable row level security;
create policy audit_sel on public.audit_logs for select to authenticated
  using (public.is_super_admin()
    or (business_id is not null and public.has_business_access(business_id)
        and public.get_business_role(business_id) = 'BUSINESS_ADMIN'));

-- ────────────────────────────────────────────────────────────────────────────
-- 14. RPCs PÚBLICAS (anon · SECURITY DEFINER) — sitio + reservas
--    El público solo lee snapshots publicados (DECISIÓN 4). Cero acceso a tablas.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.get_public_site(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_snapshot jsonb;
begin
  select r.snapshot into v_snapshot
  from public.businesses b
  join lateral (
    select snapshot from public.website_releases wr
    where wr.business_id = b.id
    order by wr.created_at desc limit 1
  ) r on true
  where b.slug = p_slug and b.status in ('ACTIVE','TRIAL');

  return v_snapshot;  -- null si no hay release publicado
end $$;

create or replace function public.get_public_availability(
  p_slug text, p_date date, p_service_ids uuid[], p_employee_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid; v_loc uuid; v_duration int := 0; v_slot int := 30;
  v_dow int; v_result jsonb := '[]'::jsonb;
  v_emp record; v_cursor timestamptz;
  v_open_t time; v_close_t time; v_open timestamptz; v_close timestamptz;
  v_busy boolean; v_closed boolean := false; v_lead int := 60;
begin
  select id into v_business from public.businesses where slug = p_slug and status in ('ACTIVE','TRIAL');
  if v_business is null then return '[]'::jsonb; end if;

  select coalesce(sum(s.duration_min), 30), coalesce(min(s.duration_min), 30)
    into v_duration, v_slot
  from public.services s
  where s.id = any (p_service_ids) and s.business_id = v_business and s.active;

  select l.id into v_loc from public.locations l
  where l.business_id = v_business and l.is_default limit 1;

  v_dow := extract(isodow from p_date)::int % 7;   -- 0 = domingo
  select coalesce(bh.open_time, '09:00'::time), coalesce(bh.close_time, '20:00'::time),
         coalesce(bh.is_closed, false)
    into v_open_t, v_close_t, v_closed
  from (select 1) one
  left join public.business_hours bh
    on bh.business_id = v_business and bh.weekday = v_dow
   and (bh.location_id is null or bh.location_id = v_loc);
  if v_closed then return '[]'::jsonb; end if;

  -- muralla local del negocio → timestamptz (UTC interno)
  v_open  := (p_date + v_open_t) at time zone 'America/Lima';
  v_close := (p_date + v_close_t) at time zone 'America/Lima';
  if v_open < now() + (v_lead || ' minutes')::interval then
    v_open := date_trunc('hour', now() + (v_lead || ' minutes')::interval)
              + interval '30 minutes';
  end if;

  for v_emp in
    select e.id from public.employees e
    where e.business_id = v_business and e.active
      and (p_employee_id is null or e.id = p_employee_id)
      and exists (select 1 from public.employee_services es
                  where es.employee_id = e.id and es.service_id = any (p_service_ids))
      and not exists (select 1 from public.time_off to2
                      where to2.employee_id = e.id
                        and to2.starts_at < v_close and to2.ends_at > v_open)
  loop
    v_cursor := v_open;
    while v_cursor + (v_duration || ' minutes')::interval <= v_close loop
      select exists (
        select 1 from public.appointments a
        where a.business_id = v_business
          and a.employee_id = v_emp.id
          and a.status not in ('CANCELLED','NO_SHOW')
          and a.scheduled_start < v_cursor + (v_duration || ' minutes')::interval
          and a.scheduled_end   > v_cursor
      ) into v_busy;

      if not v_busy then
        v_result := v_result || jsonb_build_array(jsonb_build_object(
          'starts_at', to_char(v_cursor at time zone 'America/Lima', 'YYYY-MM-DD"T"HH24:MI:SS'),
          'employee_id', v_emp.id));
      end if;
      v_cursor := v_cursor + (v_slot || ' minutes')::interval;
    end loop;
  end loop;
  return v_result;
end $$;

create or replace function public.create_booking(
  p_slug text, p_service_ids uuid[], p_employee_id uuid,
  p_start timestamptz, p_name text, p_phone text, p_notes text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid; v_customer uuid; v_appt uuid; v_end timestamptz;
  v_total numeric(12,2) := 0; v_dur int := 0; s record; v_code text;
begin
  select id into v_business from public.businesses where slug = p_slug and status in ('ACTIVE','TRIAL');
  if v_business is null then raise exception 'Negocio no disponible'; end if;
  if p_phone is null or length(p_phone) < 6 then raise exception 'Teléfono inválido'; end if;

  perform pg_advisory_xact_lock(hashtext(p_slug || p_start::text));  -- anti doble booking

  select coalesce(sum(duration_min),0), coalesce(sum(price),0) into v_dur, v_total
  from public.services where id = any (p_service_ids) and business_id = v_business and active;
  if v_dur = 0 then raise exception 'Servicios inválidos'; end if;
  v_end := p_start + (v_dur || ' minutes')::interval;

  if exists (
    select 1 from public.appointments a
    where a.business_id = v_business and (p_employee_id is null or a.employee_id = p_employee_id)
      and a.status not in ('CANCELLED','NO_SHOW')
      and a.scheduled_start < v_end and a.scheduled_end > p_start) then
    raise exception 'Ese horario ya no está disponible';
  end if;

  insert into public.customers (business_id, full_name, phone, referral_code)
  values (v_business, p_name, p_phone,
          upper(left(regexp_replace(p_name, '[^a-zA-Z]', '', 'g'), 6)) || '-' || lpad((random()*999)::int::text, 3, '0'))
  on conflict (business_id, phone) do update set full_name = excluded.full_name
  returning id into v_customer;

  insert into public.appointments
    (business_id, customer_id, employee_id, status, source, scheduled_start, scheduled_end, price_total, notes)
  values (v_business, v_customer, p_employee_id, 'PENDING', 'LANDING', p_start, v_end, v_total, p_notes)
  returning id into v_appt;

  for s in select id, duration_min, price from public.services
           where id = any (p_service_ids) and business_id = v_business loop
    insert into public.appointment_items
      (appointment_id, business_id, service_id, employee_id, unit_price, duration_min)
    values (v_appt, v_business, s.id, p_employee_id, s.price, s.duration_min);
  end loop;

  return jsonb_build_object('appointment_id', v_appt, 'total', v_total,
                            'starts_at', p_start, 'ends_at', v_end);
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 15. RPCs DE NEGOCIO
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.publish_website(p_business_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_snapshot jsonb; v_release uuid;
begin
  if not (public.is_super_admin() or public.has_permission(p_business_id, 'website.manage')) then
    raise exception 'Sin permiso para publicar';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'business', jsonb_build_object(
      'name', b.name, 'slug', b.slug, 'description', b.description,
      'phone', b.phone, 'whatsapp', b.whatsapp, 'email', b.email, 'address', b.address),
    'branding', to_jsonb(br),
    'website', to_jsonb(w),
    'sections', coalesce((select jsonb_agg(jsonb_build_object(
        'type', s.type, 'position', s.position, 'active', s.active, 'content', s.content)
        order by s.position) from public.website_sections s where s.business_id = p_business_id), '[]'),
    'media', coalesce((select jsonb_agg(jsonb_build_object(
        'role', m.role, 'storage_path', m.storage_path, 'alt', m.alt,
        'description', m.description, 'position', m.position, 'is_cover', m.is_cover)
        order by m.position) from public.website_media m where m.business_id = p_business_id), '[]'),
    'services', coalesce((select jsonb_agg(jsonb_build_object(
        'id', sv.id, 'name', sv.name, 'description', sv.description,
        'duration_min', sv.duration_min, 'price', sv.price, 'image_url', sv.image_url,
        'category', c.name) order by sv.position)
        from public.services sv left join public.service_categories c on c.id = sv.category_id
        where sv.business_id = p_business_id and sv.active and sv.show_on_website), '[]'),
    'team', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'full_name', e.full_name, 'role_label', e.role_label,
        'specialty', e.specialty, 'photo_url', e.photo_url, 'bio', e.bio) order by e.full_name)
        from public.employees e where e.business_id = p_business_id and e.active and e.show_on_website), '[]'),
    'promotions', coalesce((select jsonb_agg(to_jsonb(p) order by p.starts_at)
        from public.promotions p where p.business_id = p_business_id
        and p.is_active and p.show_on_website and now()::date between p.starts_at and p.ends_at), '[]'),
    'testimonials', coalesce((select jsonb_agg(jsonb_build_object(
        'author_name', r.author_name, 'rating', r.rating, 'content', r.content, 'photo_url', r.photo_url)
        order by r.created_at desc) from public.reviews r
        where r.business_id = p_business_id and r.is_published), '[]'),
    'hours', coalesce((select jsonb_agg(jsonb_build_object(
        'weekday', h.weekday, 'open_time', h.open_time, 'close_time', h.close_time,
        'is_closed', h.is_closed) order by h.weekday)
        from public.business_hours h where h.business_id = p_business_id and h.location_id is null), '[]'),
    'socials', w.socials, 'map_query', w.map_query
  ) into v_snapshot
  from public.businesses b
  left join public.business_branding br on br.business_id = b.id
  left join public.business_website w on w.business_id = b.id
  where b.id = p_business_id;

  insert into public.website_releases (business_id, snapshot, published_by)
  values (p_business_id, v_snapshot, auth.uid()) returning id into v_release;

  perform public.log_audit(p_business_id, 'PUBLISH', 'website_releases', v_release, null, v_snapshot);
  return v_release;
end $$;

create or replace function public.cancel_appointment(p_appointment_id uuid, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_appt public.appointments%rowtype;
begin
  select * into v_appt from public.appointments where id = p_appointment_id;
  if v_appt.id is null then raise exception 'Cita no encontrada'; end if;
  if not (public.is_super_admin() or public.has_permission(v_appt.business_id, 'calendar.manage')) then
    raise exception 'Sin permiso';
  end if;
  update public.appointments
    set status = 'CANCELLED', cancel_reason = p_reason, updated_at = now()
    where id = p_appointment_id;
  return public.match_waitlist(p_appointment_id);  -- §17–18: recuperar el hueco
end $$;

create or replace function public.match_waitlist(p_appointment_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_appt public.appointments%rowtype;
begin
  select * into v_appt from public.appointments where id = p_appointment_id;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'waitlist_id', w.id, 'customer_id', w.customer_id, 'customer_name', c.full_name,
      'phone', c.phone, 'priority', w.priority)
      order by w.priority desc, w.created_at)
    from public.waitlist w
    join public.customers c on c.id = w.customer_id
    where w.business_id = v_appt.business_id
      and w.status = 'WAITING'
      and (w.employee_id is null or w.employee_id = v_appt.employee_id)
      and (w.preferred_date is null or w.preferred_date = v_appt.scheduled_start::date)
      and exists (select 1 from public.appointment_items ai
                  where ai.appointment_id = v_appt.id and ai.service_id = w.service_id)
      and (w.time_start is null
           or v_appt.scheduled_start::time between w.time_start and w.time_end)
  ), '[]'::jsonb);
end $$;

create or replace function public.complete_appointment(p_appointment_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_appt public.appointments%rowtype;
begin
  select * into v_appt from public.appointments where id = p_appointment_id;
  if not (public.is_super_admin() or public.has_permission(v_appt.business_id, 'calendar.manage')) then
    raise exception 'Sin permiso';
  end if;
  update public.appointments set status = 'COMPLETED', updated_at = now() where id = p_apointment_id;
  perform public.refresh_customer_stats(v_appt.business_id);
end $$;

create or replace function public.refresh_customer_stats(p_business_id uuid) returns void
language sql security definer set search_path = public as $$
  with agg as (
    select a.customer_id,
           count(*) as visits,
           coalesce(sum(a.price_total), 0) as spent,
           max(a.scheduled_start) as last_visit,
           (extract(epoch from (max(a.scheduled_start) - min(a.scheduled_start)))
             / 86400.0 / nullif(count(*) - 1, 0))::int as avg_recurrence
    from public.appointments a
    where a.business_id = p_business_id and a.status = 'COMPLETED'
    group by a.customer_id
  )
  update public.customers c
  set visit_count = agg.visits,
      total_spent = agg.spent,
      last_visit_at = agg.last_visit,
      avg_recurrence_days = agg.avg_recurrence
  from agg where agg.customer_id = c.id and c.business_id = p_business_id;
$$;

create or replace function public.get_recoverable_slots(p_business_id uuid, p_days int default 7)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_super_admin() or public.has_business_access(p_business_id)) then
    raise exception 'Sin permiso';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'appointment_id', a.id, 'starts_at', a.scheduled_start, 'employee_id', a.employee_id,
      'service_ids', (select jsonb_agg(ai.service_id) from public.appointment_items ai where ai.appointment_id = a.id),
      'candidates', public.match_waitlist(a.id)))
    from public.appointments a
    where a.business_id = p_business_id
      and a.status in ('CANCELLED','NO_SHOW')
      and a.scheduled_start between now() and now() + (p_days || ' days')::interval
  ), '[]'::jsonb);
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 16. ANALYTICS (dashboard + tools IA)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.get_business_kpis(p_business_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not (public.is_super_admin() or public.has_business_access(p_business_id)) then
    raise exception 'Sin permiso';
  end if;
  select jsonb_build_object(
    'revenue', coalesce((select sum(total) from public.sales s
      where s.business_id = p_business_id and s.status = 'PAID'
        and s.created_at between p_from and p_to), 0),
    'appointments', (select count(*) from public.appointments a
      where a.business_id = p_business_id and a.status not in ('CANCELLED')
        and a.scheduled_start between p_from and p_to),
    'completed', (select count(*) from public.appointments a
      where a.business_id = p_business_id and a.status = 'COMPLETED'
        and a.scheduled_start between p_from and p_to),
    'cancelled', (select count(*) from public.appointments a
      where a.business_id = p_business_id and a.status in ('CANCELLED','NO_SHOW')
        and a.scheduled_start between p_from and p_to),
    'new_customers', (select count(*) from public.customers c
      where c.business_id = p_business_id and c.created_at between p_from and p_to),
    'ticket_avg', coalesce((select avg(total) from public.sales s
      where s.business_id = p_business_id and s.status = 'PAID'
        and s.created_at between p_from and p_to), 0),
    'payment_mix', public.get_payment_mix(p_business_id, p_from, p_to)
  ) into v;
  return v;
end $$;

create or replace function public.get_payment_mix(p_business_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(p.method, p.amount), '{}'::jsonb)
  from (select pay.method, sum(pay.amount) as amount
        from public.payments pay
        where pay.business_id = p_business_id and pay.paid_at between p_from and p_to
        group by pay.method) p;
$$;

create or replace function public.get_demand_heatmap(p_business_id uuid, p_weeks int default 8)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'dow', t.dow, 'hour', t.hour, 'occupancy', t.occupancy)), '[]'::jsonb)
  from (
    select extract(isodow from a.scheduled_start)::int as dow,
           extract(hour from a.scheduled_start)::int as hour,
           round(100.0 * count(*) / nullif((select count(distinct date_trunc('week', scheduled_start))
             from public.appointments where business_id = p_business_id), 0)) as occupancy
    from public.appointments a
    where a.business_id = p_business_id
      and a.status not in ('CANCELLED','NO_SHOW')
      and a.scheduled_start >= now() - (p_weeks || ' weeks')::interval
    group by 1, 2) t;
$$;

create or replace function public.get_at_risk_clients(p_business_id uuid, p_tolerance numeric default 1.3)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_super_admin() or public.has_business_access(p_business_id)) then
    raise exception 'Sin permiso';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'customer_id', c.id, 'name', c.full_name, 'phone', c.phone,
      'avg_recurrence_days', c.avg_recurrence_days,
      'days_overdue', (extract(epoch from (now() - c.last_visit_at)) / 86400)::int
        - coalesce(c.avg_recurrence_days, 0),
      'total_spent', c.total_spent)
      order by c.total_spent desc)
    from public.customers c
    where c.business_id = p_business_id
      and c.visit_count >= 2
      and c.avg_recurrence_days is not null
      and now() - c.last_visit_at > (c.avg_recurrence_days * p_tolerance || ' days')::interval
  ), '[]'::jsonb);
end $$;

-- Tools del Copiloto Groq (§30) — cada tool es una RPC real, nunca una invención
create or replace function public.ai_tool_revenue(p_business_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer as $$
  select public.get_business_kpis(p_business_id, p_from, p_to);
$$;

create or replace function public.ai_tool_top_services(p_business_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select si.description as service, sum(si.total) as revenue, sum(si.qty) as units
    from public.sale_items si join public.sales s on s.id = si.sale_id
    where si.business_id = p_business_id and s.status = 'PAID'
      and s.created_at between p_from and p_to
    group by si.description order by sum(si.total) desc limit 10) t;
$$;

create or replace function public.ai_tool_staff_performance(p_business_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select e.full_name as employee,
           count(distinct a.id) as appointments,
           coalesce(sum(si.total), 0) as revenue,
           round(coalesce(avg(si.total), 0), 2) as ticket_avg
    from public.employees e
    left join public.appointments a on a.employee_id = e.id
      and a.status = 'COMPLETED' and a.scheduled_start between p_from and p_to
    left join public.sale_items si on si.employee_id = e.id
    left join public.sales s on s.id = si.sale_id
      and s.status = 'PAID' and s.created_at between p_from and p_to
    where e.business_id = p_business_id and e.active
    group by e.id order by coalesce(sum(si.total), 0) desc) t;
$$;

create or replace function public.ai_tool_empty_slots(p_business_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select extract(isodow from gs)::int as dow, extract(hour from gs)::int as hour,
           count(*) as free_slots
    from generate_series(date_trunc('hour', p_from), p_to, interval '1 hour') gs
    where not exists (
      select 1 from public.appointments a
      where a.business_id = p_business_id
        and a.status not in ('CANCELLED','NO_SHOW')
        and a.scheduled_start < gs + interval '1 hour' and a.scheduled_end > gs)
    group by 1, 2 order by 3 desc limit 12) t;
$$;

create or replace function public.ai_tool_at_risk_clients(p_business_id uuid)
returns jsonb language sql stable security definer as $$
  select public.get_at_risk_clients(p_business_id);
$$;

create or replace function public.ai_tool_new_vs_returning(p_business_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'new_customers', (select count(*) from public.customers c
      where c.business_id = p_business_id and c.created_at between p_from and p_to),
    'returning_customers', (select count(distinct a.customer_id) from public.appointments a
      where a.business_id = p_business_id and a.scheduled_start between p_from and p_to
        and a.customer_id in (select customer_id from public.customers
          where business_id = p_business_id and created_at < p_from)));
$$;

create or replace function public.ai_tool_loyalty_summary(p_business_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'accounts', (select count(*) from public.loyalty_accounts where business_id = p_business_id),
    'points_outstanding', (select coalesce(sum(points), 0) from public.loyalty_accounts where business_id = p_business_id),
    'by_tier', (select coalesce(jsonb_object_agg(tier, n), '{}'::jsonb)
      from (select tier, count(*) as n from public.loyalty_accounts
            where business_id = p_business_id group by tier) t),
    'referrals_completed', (select count(*) from public.referrals
      where business_id = p_business_id and status in ('COMPLETED','REWARDED')));
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 17. GRANTS (RPCs explícitas · anon solo lectura pública + reserva)
-- ────────────────────────────────────────────────────────────────────────────
revoke execute on function public.create_booking(text, uuid[], uuid, timestamptz, text, text, text) from public;
revoke execute on function public.publish_website(uuid) from public;
revoke execute on function public.cancel_appointment(uuid, text) from public;
revoke execute on function public.complete_appointment(uuid) from public;
revoke execute on function public.log_audit(uuid, text, text, uuid, jsonb, jsonb) from public;

grant execute on function public.get_public_site(text) to anon, authenticated;
grant execute on function public.get_public_availability(text, date, uuid[], uuid) to anon, authenticated;
grant execute on function public.create_booking(text, uuid[], uuid, timestamptz, text, text, text) to anon;
grant execute on function public.get_business_kpis(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_demand_heatmap(uuid, int) to authenticated;
grant execute on function public.get_at_risk_clients(uuid, numeric) to authenticated;
grant execute on function public.get_recoverable_slots(uuid, int) to authenticated;
grant execute on function public.match_waitlist(uuid) to authenticated;
grant execute on function public.publish_website(uuid) to authenticated;
grant execute on function public.cancel_appointment(uuid, text) to authenticated;
grant execute on function public.complete_appointment(uuid) to authenticated;
grant execute on function public.refresh_customer_stats(uuid) to authenticated;
grant execute on function public.ai_tool_revenue(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.ai_tool_top_services(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.ai_tool_staff_performance(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.ai_tool_empty_slots(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.ai_tool_at_risk_clients(uuid) to authenticated;
grant execute on function public.ai_tool_new_vs_returning(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.ai_tool_loyalty_summary(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 18. STORAGE — buckets + políticas por carpeta business_id (§40)
-- ────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values
  ('brand-assets',  'brand-assets',  true),    -- logos, favicons, portadas (públicas)
  ('website-media', 'website-media', true),    -- galería, servicios, equipo, promos
  ('client-photos', 'client-photos', false)    -- Beauty History (privadas)
on conflict (id) do nothing;

create policy "brand_upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('brand-assets','website-media')
    and (storage.foldername(name))[1] in (
      select b.business_id::text from public.business_users b
      where b.user_id = auth.uid() and b.status = 'ACTIVE'));

create policy "brand_read" on storage.objects for select to authenticated
  using (bucket_id in ('brand-assets','website-media','client-photos')
    and ((storage.foldername(name))[1] in (
      select b.business_id::text from public.business_users b
      where b.user_id = auth.uid() and b.status = 'ACTIVE')
      or public.is_super_admin()));

create policy "brand_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('brand-assets','website-media','client-photos')
    and ((storage.foldername(name))[1] in (
      select b.business_id::text from public.business_users b
      where b.user_id = auth.uid() and b.status = 'ACTIVE')
      or public.is_super_admin()));

create policy "photos_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'client-photos'
    and (storage.foldername(name))[1] in (
      select b.business_id::text from public.business_users b
      where b.user_id = auth.uid() and b.status = 'ACTIVE'));

-- ============================================================================
-- FIN · Nuvia init — 36 entidades · RLS denegar-por-defecto · RPCs públicas
-- ============================================================================


-- FUENTE: seed.sql
-- Configuración de roles y permisos; NO crea usuarios ni datos demo.
-- Los únicos planes se crean en 20260924000003_two_plans.sql.
  -- ── RBAC: roles + permisos + matriz (espejo de docs/permisos.md) ──────────
  insert into public.roles (code, name, description) values
    ('BUSINESS_ADMIN', 'Administrador', 'Administrador principal del negocio'),
    ('RECEPTIONIST', 'Recepción', 'Agenda, clientes y ventas'),
    ('BARBER', 'Barbero', 'Trabajador de barbería'),
    ('STYLIST', 'Estilista', 'Trabajador de estilismo'),
    ('THERAPIST', 'Terapeuta', 'Trabajador de spa/masaje'),
    ('CASHIER', 'Caja', 'Cobros y ventas')
  on conflict (code) do nothing;

  insert into public.permissions (key, name, category) values
    ('dashboard.view', 'Ver panel', 'Trabajo'),
    ('calendar.view_all', 'Ver agenda completa', 'Trabajo'),
    ('calendar.view_own', 'Ver agenda propia', 'Trabajo'),
    ('calendar.manage', 'Gestionar citas', 'Trabajo'),
    ('clients.view', 'Ver clientes', 'Trabajo'),
    ('clients.manage', 'Gestionar clientes', 'Trabajo'),
    ('services.view', 'Ver servicios', 'Negocio'),
    ('services.manage', 'Gestionar servicios', 'Negocio'),
    ('team.view', 'Ver equipo', 'Negocio'),
    ('team.manage', 'Gestionar equipo', 'Negocio'),
    ('sales.view', 'Ver ventas', 'Ventas'),
    ('sales.manage', 'Operar ventas/POS', 'Ventas'),
    ('cash.manage', 'Gestionar caja', 'Ventas'),
    ('inventory.view', 'Ver inventario', 'Ventas'),
    ('inventory.manage', 'Gestionar inventario', 'Ventas'),
    ('loyalty.manage', 'Gestionar fidelización', 'Crecimiento'),
    ('commissions.view_own', 'Ver comisiones propias', 'Ventas'),
    ('commissions.view_all', 'Ver todas las comisiones', 'Ventas'),
    ('website.manage', 'Gestionar página web', 'Negocio'),
    ('reports.view', 'Ver reportes', 'Negocio'),
    ('ai.use', 'Usar Copiloto IA', 'Crecimiento'),
    ('whatsapp.manage', 'Gestionar WhatsApp', 'Crecimiento'),
    ('settings.manage', 'Gestionar ajustes', 'Negocio')
  on conflict (key) do nothing;

  insert into public.role_permissions (role_code, permission_key)
  select r.code, p.key
  from public.roles r join public.permissions p on true
  where r.code = 'BUSINESS_ADMIN'
  on conflict do nothing;

  insert into public.role_permissions (role_code, permission_key)
  select r.code, p.key
  from public.roles r join public.permissions p on p.key in (
    'dashboard.view', 'calendar.view_all', 'calendar.manage', 'clients.view', 'clients.manage',
    'services.view', 'team.view', 'sales.view', 'sales.manage', 'cash.manage',
    'inventory.view', 'loyalty.manage', 'whatsapp.manage')
  where r.code = 'RECEPTIONIST'
  on conflict do nothing;

  insert into public.role_permissions (role_code, permission_key)
  select r.code, p.key
  from public.roles r join public.permissions p on p.key in (
    'dashboard.view', 'calendar.view_own', 'calendar.manage', 'clients.view', 'clients.manage',
    'services.view', 'team.view', 'sales.view', 'sales.manage', 'commissions.view_own')
  where r.code in ('BARBER', 'STYLIST', 'THERAPIST')
  on conflict do nothing;

  insert into public.role_permissions (role_code, permission_key)
  select r.code, p.key
  from public.roles r join public.permissions p on p.key in (
    'dashboard.view', 'clients.view', 'services.view', 'team.view',
    'sales.view', 'sales.manage', 'cash.manage', 'inventory.view', 'inventory.manage')
  where r.code = 'CASHIER'
  on conflict do nothing;



-- FUENTE: migrations/20260922000002_platform_admin.sql
-- Nuvia · administración real de plataforma (sin cuentas ni datos demo).
-- Ejecutar UNA VEZ en SQL Editor sobre la migración inicial existente.
begin;

create or replace function public.admin_require_super() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_super_admin() then
    raise exception 'Acceso exclusivo para Super Admin' using errcode = '42501';
  end if;
end $$;

-- RLS de users permitía modificar el propio platform_role: cerrar escalamiento.
create or replace function public.admin_protect_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Bootstrap de confianza desde SQL Editor; nunca desde sesiones de la app.
  if session_user in ('postgres','supabase_admin') and coalesce(current_setting('role',true),'none') in ('none','postgres','supabase_admin') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.platform_role <> 'USER' and not public.is_super_admin() and coalesce(auth.role(), '') <> 'service_role' and session_user <> 'supabase_auth_admin' then
      raise exception 'No puedes asignar ese rol' using errcode = '42501';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' or new.platform_role is distinct from old.platform_role or new.email is distinct from old.email or new.id is distinct from old.id then
    if not public.is_super_admin() and coalesce(auth.role(), '') <> 'service_role' and session_user <> 'supabase_auth_admin' then
      raise exception 'Solo Super Admin puede gestionar cuentas y roles' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.id is distinct from old.id then raise exception 'El UID no se puede cambiar'; end if;
    if old.platform_role = 'SUPER_ADMIN' and (tg_op = 'DELETE' or new.platform_role <> 'SUPER_ADMIN') then
      perform pg_advisory_xact_lock(9222026);
      if old.id = auth.uid() then raise exception 'No puedes eliminar tu propia cuenta ni quitarte el rol Super Admin'; end if;
      if (select count(*) from public.users where platform_role = 'SUPER_ADMIN') <= 1 then
        raise exception 'No se puede eliminar ni degradar al último Super Admin';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists admin_protect_user on public.users;
create trigger admin_protect_user before insert or update or delete on public.users
for each row execute function public.admin_protect_user();

-- Auth Admin API elimina cuentas con service_role, sin auth.uid().
create or replace function public.protect_business_users() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() and coalesce(auth.role(), '') <> 'service_role' and session_user <> 'supabase_auth_admin' then
    if tg_op = 'INSERT' and new.role_code = 'BUSINESS_ADMIN' then raise exception 'Solo Super Admin puede asignar BUSINESS_ADMIN'; end if;
    if tg_op = 'UPDATE' and (old.role_code = 'BUSINESS_ADMIN' or new.role_code = 'BUSINESS_ADMIN') then raise exception 'Solo Super Admin puede modificar BUSINESS_ADMIN'; end if;
    if tg_op = 'DELETE' and old.role_code = 'BUSINESS_ADMIN' then raise exception 'Solo Super Admin puede eliminar BUSINESS_ADMIN'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- Conservar ventas, notas e historial al borrar una cuenta: referencias de autor
-- anulables usan SET NULL, no CASCADE ni bloqueo por FK. Membresías conservan CASCADE.
do $$ declare r record; begin
  for r in
    select c.conname, c.conrelid::regclass as tbl, a.attname
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'public.users'::regclass
      and c.confdeltype = 'a' and array_length(c.conkey,1) = 1 and not a.attnotnull
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references public.users(id) on delete set null', r.tbl, r.conname, r.attname);
  end loop;
end $$;

-- Auditoría durante cascadas: el tenant padre puede haber dejado de existir.
create or replace function public.audit_tg() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_after jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_business uuid;
begin
  v_business := coalesce((v_after->>'business_id')::uuid, (v_before->>'business_id')::uuid);
  if v_business is not null and not exists(select 1 from public.businesses where id = v_business) then v_business := null; end if;
  insert into public.audit_logs(business_id, user_id, action, entity_table, entity_id, before, after)
  values(v_business, (select id from public.users where id = auth.uid()), tg_op, tg_table_name,
    coalesce((v_after->>'id')::uuid, (v_before->>'id')::uuid), v_before, v_after);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists businesses_audit on public.businesses;
create trigger businesses_audit after insert or update or delete on public.businesses for each row execute function public.audit_tg();
drop trigger if exists users_audit on public.users;
create trigger users_audit after insert or update or delete on public.users for each row execute function public.audit_tg();
drop trigger if exists business_users_audit on public.business_users;
create trigger business_users_audit after insert or update or delete on public.business_users for each row execute function public.audit_tg();

create or replace function public.admin_save_business(p_id uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_plan uuid := nullif(p_data->>'plan_id','')::uuid; v_sub uuid;
begin
  perform public.admin_require_super();
  if length(trim(coalesce(p_data->>'name',''))) = 0 then raise exception 'Nombre requerido'; end if;
  if coalesce(p_data->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Slug inválido: usa minúsculas, números y guiones'; end if;
  if v_plan is not null and not exists(select 1 from public.plans where id = v_plan) then raise exception 'Plan no encontrado'; end if;
  if p_id is null then
    insert into public.businesses(name, slug, type, status, email, phone, whatsapp, address, description)
    values(trim(p_data->>'name'), p_data->>'slug', (p_data->>'type')::public.business_type,
      (p_data->>'status')::public.business_status, p_data->>'email', p_data->>'phone', p_data->>'whatsapp', p_data->>'address', coalesce(p_data->>'description','')) returning id into v_id;
    insert into public.business_settings(business_id) values(v_id);
    insert into public.business_branding(business_id) values(v_id);
    insert into public.business_website(business_id) values(v_id);
    insert into public.locations(business_id, address) values(v_id, p_data->>'address');
    insert into public.website_sections(business_id, type, position)
      select v_id, t::public.website_section_type, n::int from unnest(array['HERO','SERVICES','ABOUT','GALLERY','TEAM','PROMOTIONS','TESTIMONIALS','LOCATION','CTA','FOOTER']) with ordinality as x(t,n);
  else
    update public.businesses set name=trim(p_data->>'name'), slug=p_data->>'slug', type=(p_data->>'type')::public.business_type,
      status=(p_data->>'status')::public.business_status, email=p_data->>'email', phone=p_data->>'phone', whatsapp=p_data->>'whatsapp', address=p_data->>'address', description=coalesce(p_data->>'description','')
      where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Negocio no encontrado'; end if;
  end if;
  -- Bloquear el tenant serializa los cambios de suscripción de esta RPC.
  perform 1 from public.businesses where id=v_id for update;
  select id into v_sub from public.subscriptions where business_id=v_id order by created_at desc, id desc limit 1;
  if v_plan is not null then
    if v_sub is null then
      insert into public.subscriptions(business_id, plan_id, status) values(v_id, v_plan, (p_data->>'subscription_status')::public.subscription_status);
    else
      update public.subscriptions set plan_id=v_plan, status=(p_data->>'subscription_status')::public.subscription_status where id=v_sub;
    end if;
  else
    update public.subscriptions set status='CANCELLED' where business_id=v_id and status <> 'CANCELLED';
  end if;
  return v_id;
end $$;

create or replace function public.admin_delete_business(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_require_super();
  -- Preservar auditoría de plataforma; los datos operativos sí se eliminan.
  update public.audit_logs set business_id=null where business_id=p_id;
  delete from public.businesses where id=p_id;
  if not found then raise exception 'Negocio no encontrado'; end if;
end $$;

create or replace function public.admin_save_plan(p_id uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_limits jsonb := p_data->'limits'; v_modules jsonb := p_data->'modules';
begin
  perform public.admin_require_super();
  if length(trim(coalesce(p_data->>'name',''))) = 0 or coalesce(p_data->>'code','') !~ '^[A-Z0-9_-]+$' then raise exception 'Nombre y código de plan válidos requeridos'; end if;
  if (p_data->>'price_monthly')::numeric < 0 or p_data->>'price_monthly' is null then raise exception 'Precio inválido'; end if;
  if jsonb_typeof(v_limits) is distinct from 'object' or jsonb_typeof(v_modules) is distinct from 'object' then raise exception 'Límites y módulos deben ser objetos'; end if;
  if (v_limits->>'max_employees')::integer < 1 or v_limits->>'max_employees' is null then raise exception 'El límite de trabajadores debe ser al menos 1'; end if;
  if exists(select 1 from jsonb_each(v_modules) where jsonb_typeof(value) <> 'boolean') then raise exception 'Los módulos deben contener valores booleanos'; end if;
  if p_id is null then
    insert into public.plans(code, name, description, price_monthly, currency, limits, modules, is_active)
    values(p_data->>'code', trim(p_data->>'name'), coalesce(p_data->>'description',''), (p_data->>'price_monthly')::numeric, 'PEN', v_limits, v_modules, (p_data->>'is_active')::boolean) returning id into v_id;
  else
    update public.plans set code=p_data->>'code', name=trim(p_data->>'name'), description=coalesce(p_data->>'description',''),
      price_monthly=(p_data->>'price_monthly')::numeric, limits=v_limits, modules=v_modules, is_active=(p_data->>'is_active')::boolean
      where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Plan no encontrado'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.admin_delete_plan(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_require_super();
  perform 1 from public.plans where id=p_id for update;
  if exists(select 1 from public.subscriptions where plan_id=p_id) then
    raise exception 'Este plan tiene suscripciones asociadas. Desactívalo para conservar el historial.';
  end if;
  delete from public.plans where id=p_id;
  if not found then raise exception 'Plan no encontrado'; end if;
end $$;

-- Perfil y membresías en una sola transacción; la cuenta Auth se gestiona SOLO
-- con Auth Admin API en la Edge Function, nunca con INSERT/UPDATE SQL en auth.
create or replace function public.admin_save_user_profile(p_id uuid, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare m jsonb; v_members jsonb := p_data->'memberships'; v_email text;
begin
  perform public.admin_require_super();
  if jsonb_typeof(v_members) is distinct from 'array' then raise exception 'Membresías inválidas'; end if;
  if length(trim(coalesce(p_data->>'full_name',''))) = 0 then raise exception 'Nombre requerido'; end if;
  if exists(select 1 from jsonb_array_elements(v_members) x group by x->>'business_id' having count(*) > 1) then raise exception 'No repitas el negocio en las membresías'; end if;
  for m in select * from jsonb_array_elements(v_members) loop
    if not exists(select 1 from public.businesses where id=(m->>'business_id')::uuid) then raise exception 'Negocio no encontrado'; end if;
    if not exists(select 1 from public.roles where code=m->>'role_code') then raise exception 'Rol de negocio inválido'; end if;
    if nullif(m->>'employee_id','') is not null and not exists(select 1 from public.employees where id=(m->>'employee_id')::uuid and business_id=(m->>'business_id')::uuid) then raise exception 'El trabajador no pertenece al negocio'; end if;
  end loop;
  select email into v_email from auth.users where id=p_id;
  if v_email is null then raise exception 'Cuenta de acceso no encontrada'; end if;
  update public.users set full_name=trim(p_data->>'full_name'), email=v_email, platform_role=(p_data->>'platform_role')::public.user_platform_role where id=p_id;
  if not found then raise exception 'Perfil no encontrado'; end if;
  delete from public.business_users bu where bu.user_id=p_id and not exists(select 1 from jsonb_array_elements(v_members) x where (x->>'business_id')::uuid=bu.business_id);
  for m in select * from jsonb_array_elements(v_members) loop
    insert into public.business_users(business_id,user_id,role_code,status,employee_id,invited_by)
    values((m->>'business_id')::uuid,p_id,m->>'role_code',(m->>'status')::public.business_user_status,nullif(m->>'employee_id','')::uuid,auth.uid())
    on conflict(business_id,user_id) do update set role_code=excluded.role_code,status=excluded.status,employee_id=excluded.employee_id;
  end loop;
end $$;

revoke all on function public.admin_require_super() from public, anon;
revoke all on function public.admin_save_business(uuid,jsonb) from public, anon;
revoke all on function public.admin_delete_business(uuid) from public, anon;
revoke all on function public.admin_save_plan(uuid,jsonb) from public, anon;
revoke all on function public.admin_delete_plan(uuid) from public, anon;
revoke all on function public.admin_save_user_profile(uuid,jsonb) from public, anon;
grant execute on function public.admin_require_super(), public.admin_save_business(uuid,jsonb), public.admin_delete_business(uuid), public.admin_save_plan(uuid,jsonb), public.admin_delete_plan(uuid), public.admin_save_user_profile(uuid,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;


-- FUENTE: migrations/20260924000003_two_plans.sql
-- Nuvia: dos planes, cuotas atómicas y sucursales. Ver docs/planes-alcance-migracion.md.
-- Requiere init + platform_admin. Respaldo e INSPECCION_PLANES.sql antes de producción.
begin;
select pg_advisory_xact_lock(24092026);
create schema if not exists beautyos_private;
revoke all on schema beautyos_private from public,anon,authenticated;

-- Fallar ante un catálogo no inspeccionado: nunca mapear silenciosamente planes desconocidos.
do $$ begin
 if exists(select 1 from public.plans where code not in ('STARTER','PRO','BUSINESS')) then
  raise exception 'Hay códigos de plan no contemplados. Revisar INSPECCION_PLANES.sql antes de migrar.';
 end if;
end $$;
create table public.subscription_plan_history (
 id uuid primary key default gen_random_uuid(), subscription_id uuid not null,
 business_id uuid not null references public.businesses(id) on delete cascade,
 old_plan_id uuid, old_plan jsonb not null, old_subscription jsonb not null,
 reason text not null, changed_at timestamptz not null default now(), changed_by uuid references public.users(id) on delete set null
);
alter table public.subscription_plan_history enable row level security;
create policy history_read on public.subscription_plan_history for select to authenticated using(public.is_super_admin() or (public.has_business_access(business_id) and public.get_business_role(business_id)='BUSINESS_ADMIN'));
revoke insert,update,delete on public.subscription_plan_history from anon,authenticated;
insert into public.subscription_plan_history(subscription_id,business_id,old_plan_id,old_plan,old_subscription,reason)
 select s.id,s.business_id,p.id,to_jsonb(p),to_jsonb(s),'Matriz Starter/Business 2026-09-24' from public.subscriptions s join public.plans p on p.id=s.plan_id;

insert into public.plans(code,name,description,price_monthly,limits,modules) values
 ('STARTER','Starter','Para negocios que están comenzando a digitalizar su operación.',79,
 '{"max_employees":5,"max_monthly_appointments":300,"max_storage_mb":500,"max_branches":1}',
 '{"website":true,"loyalty":true,"ai":true,"whatsapp":true,"multibranch":false}'),
 ('BUSINESS','Business','Para negocios que necesitan operar y crecer sin límites de trabajadores ni citas.',299,
 '{"max_employees":null,"max_monthly_appointments":null,"max_storage_mb":10240,"max_branches":null}',
 '{"website":true,"loyalty":true,"ai":true,"whatsapp":true,"multibranch":true}')
on conflict(code) do update set name=excluded.name,description=excluded.description,price_monthly=excluded.price_monthly,limits=excluded.limits,modules=excluded.modules,is_active=true;
update public.subscriptions set plan_id=(select id from public.plans where code='BUSINESS') where plan_id in(select id from public.plans where code='PRO');
delete from public.plans where code='PRO';
alter table public.plans add constraint two_commercial_plans check(code in ('STARTER','BUSINESS'));
-- Los tenants preexistentes sin suscripción reciben Starter; no se inventa consumo.
insert into public.subscriptions(business_id,plan_id,status)
 select b.id,p.id,'TRIALING' from public.businesses b cross join public.plans p
 where p.code='STARTER' and not exists(select 1 from public.subscriptions s where s.business_id=b.id);

alter table public.locations add column active boolean not null default true;
-- No descartar ubicaciones existentes: normalizar cuál es la principal.
with ordered as (select id,row_number() over(partition by business_id order by is_default desc,created_at,id) rn from public.locations)
update public.locations l set is_default=(o.rn=1) from ordered o where o.id=l.id;
insert into public.locations(business_id,name,is_default)
 select id,'Sucursal principal',true from public.businesses b where not exists(select 1 from public.locations l where l.business_id=b.id);
create unique index locations_one_default on public.locations(business_id) where is_default;
alter table public.services add column location_id uuid references public.locations(id);
alter table public.products add column location_id uuid references public.locations(id);
alter table public.inventory_movements add column location_id uuid references public.locations(id);
alter table public.commissions add column location_id uuid references public.locations(id);
update public.services x set location_id=l.id from public.locations l where l.business_id=x.business_id and l.is_default and x.location_id is null;
update public.products x set location_id=l.id from public.locations l where l.business_id=x.business_id and l.is_default and x.location_id is null;
update public.employees x set location_id=l.id from public.locations l where l.business_id=x.business_id and l.is_default and x.location_id is null;
update public.appointments x set location_id=l.id from public.locations l where l.business_id=x.business_id and l.is_default and x.location_id is null;
update public.sales x set location_id=l.id from public.locations l where l.business_id=x.business_id and l.is_default and x.location_id is null;
update public.inventory_movements x set location_id=p.location_id from public.products p where p.id=x.product_id;
update public.commissions x set location_id=e.location_id from public.employees e where e.id=x.employee_id;
alter table public.products drop constraint products_business_id_sku_key;
create unique index products_branch_sku on public.products(business_id,location_id,sku) where sku<>'';
alter table public.appointments add column was_completed boolean not null default false;
update public.appointments a set was_completed=true where status='COMPLETED' or exists(select 1 from public.appointment_status_history h where h.appointment_id=a.id and h.to_status='COMPLETED');
create function beautyos_private.remember_completion() returns trigger language plpgsql as $$ begin
 new.was_completed:=new.status='COMPLETED' or (tg_op='UPDATE' and (old.was_completed or old.status='COMPLETED'));
 return new;
end $$;
create trigger completion_memory before insert or update on public.appointments for each row execute function beautyos_private.remember_completion();
create index appointments_plan_month on public.appointments(business_id,scheduled_start) where status<>'CANCELLED' or was_completed;

-- No dejar un Starter con exceso de consumo preexistente; abortar y pedir revisión,
-- nunca borrar registros ni subir de plan silenciosamente.
do $$ declare bad uuid; begin
 select b.id into bad from public.businesses b
 join lateral(select plan_id from public.subscriptions where business_id=b.id order by created_at desc,id desc limit 1) ss on true
 join public.plans p on p.id=ss.plan_id
 where p.code='STARTER' and (
  (select count(*) from public.employees where business_id=b.id)>5 or
  (select count(*) from public.locations where business_id=b.id)>1 or
  (select coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0) from storage.objects where bucket_id in ('brand-assets','website-media','client-photos') and lower(split_part(name,'/',1))=b.id::text)>524288000 or
  exists(select 1 from public.appointments where business_id=b.id and (status<>'CANCELLED' or was_completed) and scheduled_start>=date_trunc('month',now() at time zone b.timezone) at time zone b.timezone group by date_trunc('month',scheduled_start at time zone b.timezone) having count(*)>300)
 ) limit 1;
 if bad is not null then raise exception 'El negocio % supera Starter. Revisa consumo/asigna Business con la administración existente antes de repetir. No se aplicó ningún cambio.',bad; end if;
end $$;

-- Fuente ÚNICA: planes; no overrides de capacidades en business_settings ni JWT.
create function beautyos_private.capabilities(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare p public.plans; st public.subscription_status; bs public.business_status;
begin
 select status into bs from public.businesses where id=p_business_id;
 if bs is null then raise exception 'Negocio no encontrado'; end if;
 select plan_id,status into p.id,st from public.subscriptions where business_id=p_business_id order by created_at desc,id desc limit 1;
 select * into p from public.plans where id=p.id;
 if p.id is null or st='CANCELLED' or bs in ('SUSPENDED','CANCELLED') then raise exception 'El negocio no tiene una suscripción operativa'; end if;
 return jsonb_build_object('planId',p.id,'code',p.code,'name',p.name,'priceMonthly',p.price_monthly,'subscriptionStatus',st,
  'maxWorkers',p.limits->'max_employees','maxMonthlyAppointments',p.limits->'max_monthly_appointments',
  'maxStorageMb',p.limits->'max_storage_mb','maxBranches',p.limits->'max_branches',
  'website',coalesce((p.modules->>'website')::boolean,false),'loyalty',coalesce((p.modules->>'loyalty')::boolean,false),
  'aiCopilot',coalesce((p.modules->>'ai')::boolean,false),'whatsapp',coalesce((p.modules->>'whatsapp')::boolean,false),
  'multiBranch',coalesce((p.modules->>'multibranch')::boolean,false));
end $$;
create function public.require_plan_capability(p_business_id uuid,p_capability text,p_permission text) returns void
language plpgsql stable security definer set search_path=public as $$
declare c jsonb;
begin
 if auth.uid() is null or not(public.is_super_admin() or (public.has_business_access(p_business_id) and public.has_permission(p_business_id,p_permission))) then
  raise exception 'Sin permiso para esta operación en el negocio' using errcode='42501';
 end if;
 c:=beautyos_private.capabilities(p_business_id);
 if p_capability is not null and not coalesce((c->>p_capability)::boolean,false) then raise exception 'Esta capacidad no está habilitada en el plan'; end if;
end $$;
create function beautyos_private.storage_bytes(p_business_id uuid) returns bigint
language sql stable security definer set search_path=public as $$
 select coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0)::bigint from storage.objects
 where bucket_id in ('brand-assets','website-media','client-photos') and lower(split_part(name,'/',1))=p_business_id::text;
$$;
create function public.get_plan_usage(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare c jsonb; tz text; start_at timestamptz; end_at timestamptz;
begin
 if auth.uid() is null or not(public.is_super_admin() or public.has_business_access(p_business_id)) then raise exception 'Sin acceso al negocio' using errcode='42501'; end if;
 c:=beautyos_private.capabilities(p_business_id);
 select timezone into tz from public.businesses where id=p_business_id;
 start_at:=date_trunc('month',now() at time zone tz) at time zone tz;
 end_at:=(date_trunc('month',now() at time zone tz)+interval '1 month') at time zone tz;
 return jsonb_build_object('capabilities',c,'periodStart',start_at,'periodEnd',end_at,'timezone',tz,'usage',jsonb_build_object(
 'workers',(select count(*) from public.employees where business_id=p_business_id),
 'appointments',(select count(*) from public.appointments where business_id=p_business_id and (status<>'CANCELLED' or was_completed) and scheduled_start>=start_at and scheduled_start<end_at),
 'branches',(select count(*) from public.locations where business_id=p_business_id),'storageBytes',beautyos_private.storage_bytes(p_business_id)));
end $$;
create function public.get_plan_catalog() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'description',description,'price_monthly',price_monthly,'limits',limits,'modules',modules,'is_active',is_active) order by price_monthly),'[]'::jsonb) from public.plans where is_active;
$$;

-- Un único lock por tenant para INSERTs, UPDATEs que aumentan consumo y cambios de plan.
create function beautyos_private.quota_guard() returns trigger
language plpgsql security definer set search_path=public as $$
declare c jsonb; lim bigint; used bigint; tz text; first_at timestamptz; last_at timestamptz; increase boolean:=false;
begin
 if tg_op='UPDATE' and new.business_id is distinct from old.business_id then raise exception 'No se puede cambiar business_id' using errcode='42501'; end if;
 if tg_op='UPDATE' and not exists(select 1 from public.businesses where id=new.business_id) then return new; end if;
 perform 1 from public.businesses where id=new.business_id for update;
 c:=beautyos_private.capabilities(new.business_id);
 if tg_table_name='employees' then
  if tg_op='INSERT' and not exists(select 1 from public.employees where id=new.id and business_id=new.business_id) then
   lim:=(c->>'maxWorkers')::bigint; select count(*) into used from public.employees where business_id=new.business_id;
   if lim is not null and used>=lim then raise exception 'Has alcanzado el límite de % trabajadores de tu plan %. Actualiza a Business para agregar trabajadores ilimitados.',lim,c->>'name'; end if;
  end if;
 elsif tg_table_name='locations' then
  if tg_op='INSERT' then
   lim:=(c->>'maxBranches')::bigint; select count(*) into used from public.locations where business_id=new.business_id;
   if (not (c->>'multiBranch')::boolean and used>=1) or (lim is not null and used>=lim) then raise exception 'La gestión de múltiples sucursales está disponible en el plan Business.'; end if;
  end if;
 elsif tg_table_name='appointments' then
  select timezone into tz from public.businesses where id=new.business_id;
  first_at:=date_trunc('month',new.scheduled_start at time zone tz) at time zone tz;
  last_at:=(date_trunc('month',new.scheduled_start at time zone tz)+interval '1 month') at time zone tz;
  if tg_op='UPDATE' and old.was_completed and (new.status is distinct from old.status or date_trunc('month',old.scheduled_start at time zone tz)<>date_trunc('month',new.scheduled_start at time zone tz)) then
   raise exception 'Una cita completada conserva su estado y mes de consumo';
  end if;
  if new.status<>'CANCELLED' or new.was_completed then
   increase:=tg_op='INSERT';
   if tg_op='UPDATE' then increase:=old.status='CANCELLED' or old.scheduled_start<first_at or old.scheduled_start>=last_at; end if;
   if increase then
    lim:=(c->>'maxMonthlyAppointments')::bigint;
    if lim is not null then
     select count(*) into used from public.appointments where business_id=new.business_id and (status<>'CANCELLED' or was_completed) and scheduled_start>=first_at and scheduled_start<last_at and id<>new.id;
     if used>=lim then raise exception 'Has alcanzado el límite de % citas mensuales de tu plan %. Actualiza a Business para continuar sin límite.',lim,c->>'name'; end if;
    end if;
   end if;
  end if;
 end if;
 return new;
end $$;
create trigger quota_employees before insert or update on public.employees for each row execute function beautyos_private.quota_guard();
create trigger quota_locations before insert or update on public.locations for each row execute function beautyos_private.quota_guard();
create trigger quota_appointments before insert or update on public.appointments for each row execute function beautyos_private.quota_guard();
create function beautyos_private.protect_completed() returns trigger language plpgsql as $$ begin
 if old.was_completed and exists(select 1 from public.businesses where id=old.business_id) then raise exception 'No se elimina una cita completada: conserva el historial y consumo'; end if;
 return old;
end $$;
create trigger protect_completed before delete on public.appointments for each row execute function beautyos_private.protect_completed();

-- Comprobación de pertenencia de todas las FK entre entidades con business_id.
-- Se aplica también dentro de RPC SECURITY DEFINER (reservas anónimas incluidas).
create function beautyos_private.tenant_references() returns trigger
language plpgsql security definer set search_path=public as $$
declare r record; obj jsonb:=to_jsonb(new); ref uuid; tenant uuid; branch uuid;
begin
 if tg_op='UPDATE' and new.business_id is distinct from old.business_id then raise exception 'business_id es inmutable' using errcode='42501'; end if;
 if tg_op='UPDATE' and not exists(select 1 from public.businesses where id=new.business_id) then return new; end if;
 for r in select c.confrelid::regclass as tbl,a.attname from pg_constraint c
 join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
 where c.contype='f' and c.conrelid=tg_relid and array_length(c.conkey,1)=1
 and exists(select 1 from pg_attribute x where x.attrelid=c.confrelid and x.attname='business_id' and not x.attisdropped)
 loop
  ref:=nullif(obj->>r.attname,'')::uuid;
  if ref is not null then
   execute format('select business_id from %s where id=$1',r.tbl) into tenant using ref;
   if tenant is distinct from new.business_id then raise exception 'Referencia de otro negocio o inexistente: %',r.attname using errcode='42501'; end if;
  end if;
 end loop;
 return new;
end $$;
do $$ declare t record; begin
 for t in select table_name from information_schema.columns where table_schema='public' and column_name='business_id' and table_name not in ('subscription_plan_history','audit_logs') loop
  execute format('create trigger a_tenant_references before insert or update on public.%I for each row execute function beautyos_private.tenant_references()',t.table_name);
 end loop;
end $$;

-- Asignar sucursal principal si el cliente anterior no envía location_id.
create function beautyos_private.branch_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare loc uuid; ref_loc uuid; obj jsonb:=to_jsonb(new); has_history boolean;
begin
 if tg_op='UPDATE' and not exists(select 1 from public.businesses where id=new.business_id) then return new; end if;
 if new.location_id is null and tg_table_name='inventory_movements' then select location_id into new.location_id from public.products where id=(obj->>'product_id')::uuid and business_id=new.business_id; end if;
 if new.location_id is null and obj->>'employee_id' is not null then select location_id into new.location_id from public.employees where id=(obj->>'employee_id')::uuid and business_id=new.business_id; end if;
 if new.location_id is null then select id into new.location_id from public.locations where business_id=new.business_id and is_default and active limit 1; end if;
 if not exists(select 1 from public.locations where id=new.location_id and business_id=new.business_id and (active or tg_op='UPDATE')) then raise exception 'Selecciona una sucursal activa del negocio'; end if;
 if tg_op='UPDATE' and new.location_id is distinct from old.location_id then
  if tg_table_name in ('products','services','employees') then
   raise exception 'No se traslada un registro con historial entre sucursales; crea otro en la sucursal destino';
  end if;
 end if;
 if obj ? 'employee_id' and obj->>'employee_id' is not null then
  select location_id into ref_loc from public.employees where id=(obj->>'employee_id')::uuid and business_id=new.business_id;
  if ref_loc is distinct from new.location_id then raise exception 'El trabajador no pertenece a la sucursal'; end if;
 end if;
 if tg_table_name='inventory_movements' then
  select location_id into new.location_id from public.products where id=new.product_id and business_id=new.business_id;
  if new.location_id is null then raise exception 'Producto de otro negocio'; end if;
 end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['employees','services','products','appointments','sales','commissions','inventory_movements'] loop
  execute format('create trigger branch_guard before insert or update on public.%I for each row execute function beautyos_private.branch_guard()',t);
 end loop;
end $$;
create function beautyos_private.branch_items_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare loc uuid; ref_loc uuid; obj jsonb:=to_jsonb(new);
begin
 if tg_op='UPDATE' and not exists(select 1 from public.businesses where id=new.business_id) then return new; end if;
 if tg_table_name='employee_services' then select location_id into loc from public.employees where id=new.employee_id;
 elsif tg_table_name='appointment_items' then select location_id into loc from public.appointments where id=new.appointment_id;
 else select location_id into loc from public.sales where id=new.sale_id; end if;
 if obj->>'service_id' is not null then
  select location_id into ref_loc from public.services where id=(obj->>'service_id')::uuid;
  if ref_loc is distinct from loc then raise exception 'El servicio no pertenece a la sucursal'; end if;
 end if;
 if obj->>'product_id' is not null then
  select location_id into ref_loc from public.products where id=(obj->>'product_id')::uuid;
  if ref_loc is distinct from loc then raise exception 'El producto no pertenece a la sucursal'; end if;
 end if;
 if obj->>'employee_id' is not null then
  select location_id into ref_loc from public.employees where id=(obj->>'employee_id')::uuid;
  if ref_loc is distinct from loc then raise exception 'El trabajador no pertenece a la sucursal'; end if;
 end if;
 return new;
end $$;
create trigger branch_items_guard before insert or update on public.appointment_items for each row execute function beautyos_private.branch_items_guard();
create trigger branch_items_guard before insert or update on public.employee_services for each row execute function beautyos_private.branch_items_guard();
create trigger branch_items_guard before insert or update on public.sale_items for each row execute function beautyos_private.branch_items_guard();

-- Storage: tamaño real de metadata fijado por el servicio Storage, no localStorage/UI.
create function beautyos_private.storage_quota_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare bid uuid; c jsonb; used bigint; size_bytes bigint; previous bigint:=0;
begin
 if new.bucket_id not in ('brand-assets','website-media','client-photos') then return new; end if;
 begin bid:=split_part(new.name,'/',1)::uuid; exception when invalid_text_representation then raise exception 'Ruta de almacenamiento inválida: debe empezar por business_id'; end;
 if split_part(new.name,'/',1)<>bid::text then raise exception 'La ruta debe usar el UUID canónico del negocio en minúsculas'; end if;
 if tg_op='UPDATE' and (lower(split_part(old.name,'/',1))<>bid::text or old.bucket_id not in ('brand-assets','website-media','client-photos')) then raise exception 'No se trasladan objetos entre negocios/buckets'; end if;
 perform 1 from public.businesses where id=bid for update;
 c:=beautyos_private.capabilities(bid);
 size_bytes:=coalesce((new.metadata->>'size')::bigint,0);
 if size_bytes<0 then raise exception 'Tamaño de archivo inválido'; end if;
 if tg_op='UPDATE' then previous:=coalesce((old.metadata->>'size')::bigint,0);
 else select coalesce(max((metadata->>'size')::bigint),0) into previous from storage.objects where bucket_id=new.bucket_id and name=new.name; end if;
 used:=beautyos_private.storage_bytes(bid);
 if size_bytes>previous and used-previous+size_bytes>(c->>'maxStorageMb')::bigint*1048576 then raise exception 'Has alcanzado el almacenamiento de tu plan (% MB). Libera espacio o solicita un cambio de plan.',c->>'maxStorageMb'; end if;
 return new;
end $$;
create trigger beautyos_storage_quota before insert or update on storage.objects for each row execute function beautyos_private.storage_quota_guard();
-- Actualizar objetos exige el mismo tenant y permiso que subirlos; sin bypass por upsert/move.
drop policy if exists brand_upload on storage.objects;
drop policy if exists photos_upload on storage.objects;
create policy plan_storage_insert on storage.objects for insert to authenticated with check (
 bucket_id in ('brand-assets','website-media','client-photos') and (public.is_super_admin() or public.has_permission(((storage.foldername(name))[1])::uuid,case when bucket_id='client-photos' then 'clients.manage' else 'website.manage' end)));
create policy plan_storage_update on storage.objects for update to authenticated using (
 bucket_id in ('brand-assets','website-media','client-photos') and (public.is_super_admin() or public.has_permission(((storage.foldername(name))[1])::uuid,case when bucket_id='client-photos' then 'clients.manage' else 'website.manage' end))) with check (
 bucket_id in ('brand-assets','website-media','client-photos') and (public.is_super_admin() or public.has_permission(((storage.foldername(name))[1])::uuid,case when bucket_id='client-photos' then 'clients.manage' else 'website.manage' end)));

-- Downgrade/suscripción directa: comprobar consumo contra el plan destino y guardar historial.
create function beautyos_private.subscription_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare p public.plans; tz text; start_at timestamptz; finish_at timestamptz; used bigint;
begin
 if tg_op='UPDATE' and new.business_id is distinct from old.business_id then raise exception 'No se puede cambiar el negocio de una suscripción' using errcode='42501'; end if;
 perform 1 from public.businesses where id=new.business_id for update;
 select * into p from public.plans where id=new.plan_id;
 if p.id is null or (not p.is_active and (tg_op='INSERT' or new.plan_id is distinct from old.plan_id)) then raise exception 'Plan no disponible para nuevas asignaciones'; end if;
 if tg_op='INSERT' or new.plan_id is distinct from old.plan_id then
  if (p.limits->>'max_employees') is not null and (select count(*) from public.employees where business_id=new.business_id)>(p.limits->>'max_employees')::bigint then raise exception 'El consumo de trabajadores supera el plan destino'; end if;
  if (p.limits->>'max_branches') is not null and (select count(*) from public.locations where business_id=new.business_id)>(p.limits->>'max_branches')::bigint then raise exception 'El consumo de sucursales supera el plan destino'; end if;
  if not (p.modules->>'multibranch')::boolean and (select count(*) from public.locations where business_id=new.business_id)>1 then raise exception 'El plan destino no admite multisucursal'; end if;
  if beautyos_private.storage_bytes(new.business_id)>(p.limits->>'max_storage_mb')::bigint*1048576 then raise exception 'El consumo de almacenamiento supera el plan destino'; end if;
  select timezone into tz from public.businesses where id=new.business_id;
  -- Incluye TODOS los meses actuales/futuros con reservas; no borrar ni mover reservas.
  if p.limits->>'max_monthly_appointments' is not null and exists(select 1 from public.appointments where business_id=new.business_id and (status<>'CANCELLED' or was_completed) and scheduled_start>=date_trunc('month',now() at time zone tz) at time zone tz group by date_trunc('month',scheduled_start at time zone tz) having count(*)>(p.limits->>'max_monthly_appointments')::bigint) then raise exception 'Un mes reservado supera el cupo del plan destino'; end if;
 end if;
 if tg_op='UPDATE' and (new.plan_id is distinct from old.plan_id or new.status is distinct from old.status) then
  insert into public.subscription_plan_history(subscription_id,business_id,old_plan_id,old_plan,old_subscription,reason,changed_by)
  select old.id,old.business_id,old.plan_id,to_jsonb(x),to_jsonb(old),'Cambio administrativo',auth.uid() from public.plans x where x.id=old.plan_id;
 end if;
 return new;
end $$;
create trigger subscription_guard before insert or update on public.subscriptions for each row execute function beautyos_private.subscription_guard();

-- Todos los límites numéricos se editan centralmente por Super Admin; null ilimitado.
create function beautyos_private.validate_plan() returns trigger language plpgsql as $$
declare k text; x jsonb;
begin
 if new.code not in ('STARTER','BUSINESS') then raise exception 'Solo existen Starter y Business'; end if;
 if tg_op='UPDATE' and new.code<>old.code then raise exception 'El código comercial no se cambia; conserva su UUID'; end if;
 if new.price_monthly<0 then raise exception 'Precio inválido'; end if;
 if jsonb_typeof(new.limits)<>'object' or jsonb_typeof(new.modules)<>'object' then raise exception 'Capacidades inválidas'; end if;
 foreach k in array array['max_employees','max_monthly_appointments','max_branches'] loop
  if not new.limits ? k then raise exception 'Falta límite %',k; end if;
  x:=new.limits->k;
  if x<>'null'::jsonb and (jsonb_typeof(x)<>'number' or (x#>>'{}')::numeric<1 or (x#>>'{}')::numeric<>trunc((x#>>'{}')::numeric)) then raise exception 'Límite % debe ser entero positivo o null',k; end if;
 end loop;
 if coalesce((new.limits->>'max_storage_mb')::numeric,0)<=0 or (new.limits->>'max_storage_mb')::numeric<>trunc((new.limits->>'max_storage_mb')::numeric) then raise exception 'Almacenamiento debe ser un entero positivo'; end if;
 foreach k in array array['website','loyalty','ai','whatsapp','multibranch'] loop
  if jsonb_typeof(new.modules->k) is distinct from 'boolean' then raise exception 'Capacidad % debe ser boolean',k; end if;
 end loop;
 if not (new.modules->>'multibranch')::boolean and new.limits->>'max_branches' is distinct from '1' then raise exception 'Sin multisucursal el límite de ubicaciones debe ser 1'; end if;
 return new;
end $$;
create trigger validate_plan before insert or update on public.plans for each row execute function beautyos_private.validate_plan();
create or replace function public.admin_save_plan(p_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 perform public.admin_require_super();
 if length(trim(coalesce(p_data->>'name','')))=0 then raise exception 'Nombre requerido'; end if;
 if p_id is null then
  insert into public.plans(code,name,description,price_monthly,limits,modules,is_active) values(p_data->>'code',p_data->>'name',coalesce(p_data->>'description',''),(p_data->>'price_monthly')::numeric,p_data->'limits',p_data->'modules',(p_data->>'is_active')::boolean) returning id into v_id;
 else
  update public.plans set code=p_data->>'code',name=p_data->>'name',description=coalesce(p_data->>'description',''),price_monthly=(p_data->>'price_monthly')::numeric,limits=p_data->'limits',modules=p_data->'modules',is_active=(p_data->>'is_active')::boolean where id=p_id returning id into v_id;
  if v_id is null then raise exception 'Plan no encontrado'; end if;
 end if;
 return v_id;
end $$;

-- Solicitar cambio NO equivale a modificar la suscripción ni hacer un pago.
create table public.plan_change_requests(
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id) on delete cascade,
 requested_by uuid references public.users(id) on delete set null,plan_id uuid not null references public.plans(id),
 status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED')),
 created_at timestamptz not null default now()
);
create unique index one_pending_plan_request on public.plan_change_requests(business_id) where status='PENDING';
alter table public.plan_change_requests enable row level security;
create policy plan_requests_read on public.plan_change_requests for select to authenticated using(public.is_super_admin() or (public.has_business_access(business_id) and public.get_business_role(business_id)='BUSINESS_ADMIN'));
revoke insert,update,delete on public.plan_change_requests from anon,authenticated;
create function public.request_plan_change(p_business_id uuid,p_plan_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not(public.is_super_admin() or (public.has_business_access(p_business_id) and public.get_business_role(p_business_id)='BUSINESS_ADMIN')) then raise exception 'Solo el administrador del negocio solicita cambios' using errcode='42501'; end if;
 if not exists(select 1 from public.plans where id=p_plan_id and is_active) then raise exception 'Plan no disponible'; end if;
 insert into public.plan_change_requests(business_id,requested_by,plan_id) values(p_business_id,auth.uid(),p_plan_id)
 on conflict(business_id) where status='PENDING' do update set plan_id=excluded.plan_id,requested_by=excluded.requested_by,created_at=now();
end $$;

create function public.save_branch(p_business_id uuid,p_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare id_out uuid; h jsonb;
begin
 perform public.require_plan_capability(p_business_id,null,'settings.manage');
 if length(trim(coalesce(p_data->>'name','')))=0 then raise exception 'Nombre de sucursal requerido'; end if;
 if p_id is null then
  insert into public.locations(business_id,name,address,city,phone,active,is_default) values(p_business_id,trim(p_data->>'name'),p_data->>'address',p_data->>'city',p_data->>'phone',coalesce((p_data->>'active')::boolean,true),false) returning id into id_out;
 else
  update public.locations set name=trim(p_data->>'name'),address=p_data->>'address',city=p_data->>'city',phone=p_data->>'phone',active=(p_data->>'active')::boolean where id=p_id and business_id=p_business_id returning id into id_out;
  if id_out is null then raise exception 'Sucursal no encontrada en este negocio'; end if;
 end if;
 if p_data ? 'hours' then
  if jsonb_typeof(p_data->'hours')<>'array' or jsonb_array_length(p_data->'hours')<>7 then raise exception 'Se requieren los 7 días de horario'; end if;
  if (select count(distinct (x->>'weekday')::int) from jsonb_array_elements(p_data->'hours') x)<>7 then raise exception 'Días de horario duplicados'; end if;
  delete from public.business_hours where business_id=p_business_id and location_id=id_out;
  for h in select * from jsonb_array_elements(p_data->'hours') loop
   if not (h->>'is_closed')::boolean and (nullif(h->>'open_time','') is null or nullif(h->>'close_time','') is null or (h->>'close_time')::time<=(h->>'open_time')::time) then raise exception 'Revisa las horas de apertura y cierre'; end if;
   insert into public.business_hours(business_id,location_id,weekday,open_time,close_time,is_closed) values(p_business_id,id_out,(h->>'weekday')::int,coalesce(nullif(h->>'open_time','')::time,'00:00'),coalesce(nullif(h->>'close_time','')::time,'00:00'),(h->>'is_closed')::boolean);
  end loop;
 end if;
 return id_out;
end $$;
create function beautyos_private.protect_branch_delete() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if exists(select 1 from public.businesses where id=old.business_id) then raise exception 'Desactiva la sucursal para conservar su historial. No se elimina de forma aislada.'; end if;
 return old;
end $$;
create trigger protect_branch_delete before delete on public.locations for each row execute function beautyos_private.protect_branch_delete();

-- RPC agregada: sin límites de paginación del navegador para métricas consolidadas.
create function public.get_branch_report(p_business_id uuid,p_location_id uuid,p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 perform public.require_plan_capability(p_business_id,null,'reports.view');
 if p_location_id is not null and not exists(select 1 from public.locations where id=p_location_id and business_id=p_business_id) then raise exception 'Sucursal de otro negocio' using errcode='42501'; end if;
 if p_to<=p_from then raise exception 'Período inválido'; end if;
 return jsonb_build_object('branches',coalesce((select jsonb_agg(t) from (
 select l.id,l.name,l.active,
 (select count(*) from public.employees e where e.business_id=p_business_id and e.location_id=l.id) workers,
 (select count(*) from public.appointments a where a.business_id=p_business_id and a.location_id=l.id and a.scheduled_start>=p_from and a.scheduled_start<p_to and a.status<>'CANCELLED') appointments,
 (select coalesce(sum(total),0) from public.sales s where s.business_id=p_business_id and s.location_id=l.id and s.status='PAID' and s.created_at>=p_from and s.created_at<p_to) revenue,
 (select coalesce(sum(stock),0) from public.products p where p.business_id=p_business_id and p.location_id=l.id) stock_units
 from public.locations l where l.business_id=p_business_id and (p_location_id is null or l.id=p_location_id) order by l.name) t),'[]'::jsonb));
end $$;

-- GRANTS explícitos; los helpers privados no son APIs invocables.
revoke all on all functions in schema beautyos_private from public,anon,authenticated;
revoke all on function public.get_plan_usage(uuid),public.require_plan_capability(uuid,text,text),public.request_plan_change(uuid,uuid),public.save_branch(uuid,uuid,jsonb),public.get_branch_report(uuid,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_plan_usage(uuid),public.require_plan_capability(uuid,text,text),public.request_plan_change(uuid,uuid),public.save_branch(uuid,uuid,jsonb),public.get_branch_report(uuid,uuid,timestamptz,timestamptz) to authenticated;
grant execute on function public.get_plan_catalog() to anon,authenticated;
-- Continuación generada: RPCs con permisos, inicialización y reservas por sucursal.

-- Inicialización anterior a la creación de sucursal del flujo admin_save_business.
create function beautyos_private.business_default_plan() returns trigger language plpgsql security definer set search_path=public as $$ begin
 insert into public.subscriptions(business_id,plan_id,status) select new.id,id,'TRIALING' from public.plans where is_active order by case code when 'STARTER' then 0 else 1 end limit 1;
 if not found then raise exception 'No hay planes disponibles para crear un negocio'; end if;
 return new;
end $$;
create trigger business_default_plan after insert on public.businesses for each row execute function beautyos_private.business_default_plan();

create function public.plan_module_enabled(p_business_id uuid,p_module text) returns boolean language plpgsql stable security definer set search_path=public as $$
declare c jsonb;
begin
 if auth.uid() is null or not(public.is_super_admin() or public.has_business_access(p_business_id)) then return false; end if;
 if p_module not in ('website','loyalty','aiCopilot','whatsapp','multiBranch') then return false; end if;
 c:=beautyos_private.capabilities(p_business_id);
 return coalesce((c->>p_module)::boolean,false);
end $$;
revoke all on function public.plan_module_enabled(uuid,text) from public,anon;
grant execute on function public.plan_module_enabled(uuid,text) to authenticated;
create policy capability_access on public.business_branding as restrictive for all to authenticated using(public.plan_module_enabled(business_id,'website')) with check(public.plan_module_enabled(business_id,'website'));
create policy capability_access on public.business_website as restrictive for all to authenticated using(public.plan_module_enabled(business_id,'website')) with check(public.plan_module_enabled(business_id,'website'));
create policy capability_access on public.website_sections as restrictive for all to authenticated using(public.plan_module_enabled(business_id,'website')) with check(public.plan_module_enabled(business_id,'website'));
create policy capability_access on public.website_media as restrictive for all to authenticated using(public.plan_module_enabled(business_id,'website')) with check(public.plan_module_enabled(business_id,'website'));
create policy capability_access on public.website_releases as restrictive for all to authenticated using(public.plan_module_enabled(business_id,'website')) with check(public.plan_module_enabled(business_id,'website'));
create policy capability_access on public.loyalty_accounts as restrictive for all to authenticated using(public.plan_module_enabled(business_id,'loyalty')) with check(public.plan_module_enabled(business_id,'loyalty'));
create policy capability_access on public.loyalty_transactions as restrictive for all to authenticated using(public.plan_module_enabled(business_id,'loyalty')) with check(public.plan_module_enabled(business_id,'loyalty'));
create policy capability_access on public.referrals as restrictive for all to authenticated using(public.plan_module_enabled(business_id,'loyalty')) with check(public.plan_module_enabled(business_id,'loyalty'));
create policy capability_access on public.promotions as restrictive for all to authenticated using(public.plan_module_enabled(business_id,'loyalty')) with check(public.plan_module_enabled(business_id,'loyalty'));
create policy capability_access on public.automation_rules as restrictive for all to authenticated using(public.plan_module_enabled(business_id,'whatsapp')) with check(public.plan_module_enabled(business_id,'whatsapp'));
create policy capability_access on public.whatsapp_messages as restrictive for all to authenticated using(public.plan_module_enabled(business_id,'whatsapp')) with check(public.plan_module_enabled(business_id,'whatsapp'));
create policy capability_access on public.ai_conversations as restrictive for all to authenticated using(public.plan_module_enabled(business_id,'aiCopilot')) with check(public.plan_module_enabled(business_id,'aiCopilot'));
create policy capability_access on public.ai_messages as restrictive for all to authenticated using(public.plan_module_enabled(business_id,'aiCopilot')) with check(public.plan_module_enabled(business_id,'aiCopilot'));
create policy capability_access on public.ai_insights as restrictive for all to authenticated using(public.plan_module_enabled(business_id,'aiCopilot')) with check(public.plan_module_enabled(business_id,'aiCopilot'));
alter function public.ai_tool_revenue(uuid,timestamptz,timestamptz) set schema beautyos_private;
create function public.ai_tool_revenue(p_business_id uuid,p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql stable security definer set search_path=public as $$ begin perform public.require_plan_capability(p_business_id,'aiCopilot','reports.view'); perform public.require_plan_capability(p_business_id,'aiCopilot','ai.use'); return beautyos_private.ai_tool_revenue(p_business_id,p_from,p_to); end $$;
revoke all on function public.ai_tool_revenue(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.ai_tool_revenue(uuid,timestamptz,timestamptz) to authenticated;
alter function public.ai_tool_top_services(uuid,timestamptz,timestamptz) set schema beautyos_private;
create function public.ai_tool_top_services(p_business_id uuid,p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql stable security definer set search_path=public as $$ begin perform public.require_plan_capability(p_business_id,'aiCopilot','reports.view'); perform public.require_plan_capability(p_business_id,'aiCopilot','ai.use'); return beautyos_private.ai_tool_top_services(p_business_id,p_from,p_to); end $$;
revoke all on function public.ai_tool_top_services(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.ai_tool_top_services(uuid,timestamptz,timestamptz) to authenticated;
alter function public.ai_tool_staff_performance(uuid,timestamptz,timestamptz) set schema beautyos_private;
create function public.ai_tool_staff_performance(p_business_id uuid,p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql stable security definer set search_path=public as $$ begin perform public.require_plan_capability(p_business_id,'aiCopilot','commissions.view_all'); perform public.require_plan_capability(p_business_id,'aiCopilot','ai.use'); return beautyos_private.ai_tool_staff_performance(p_business_id,p_from,p_to); end $$;
revoke all on function public.ai_tool_staff_performance(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.ai_tool_staff_performance(uuid,timestamptz,timestamptz) to authenticated;
alter function public.ai_tool_empty_slots(uuid,timestamptz,timestamptz) set schema beautyos_private;
create function public.ai_tool_empty_slots(p_business_id uuid,p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql stable security definer set search_path=public as $$ begin perform public.require_plan_capability(p_business_id,'aiCopilot','calendar.view_all'); perform public.require_plan_capability(p_business_id,'aiCopilot','ai.use'); return beautyos_private.ai_tool_empty_slots(p_business_id,p_from,p_to); end $$;
revoke all on function public.ai_tool_empty_slots(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.ai_tool_empty_slots(uuid,timestamptz,timestamptz) to authenticated;
alter function public.ai_tool_at_risk_clients(uuid) set schema beautyos_private;
create function public.ai_tool_at_risk_clients(p_business_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$ begin perform public.require_plan_capability(p_business_id,'aiCopilot','clients.view'); perform public.require_plan_capability(p_business_id,'aiCopilot','ai.use'); return beautyos_private.ai_tool_at_risk_clients(p_business_id); end $$;
revoke all on function public.ai_tool_at_risk_clients(uuid) from public,anon;
grant execute on function public.ai_tool_at_risk_clients(uuid) to authenticated;
create or replace function public.ai_tool_new_vs_returning(p_business_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'new_customers', (select count(*) from public.customers c
      where c.business_id = p_business_id and c.created_at between p_from and p_to),
    'returning_customers', (select count(distinct a.customer_id) from public.appointments a
      where a.business_id = p_business_id and a.scheduled_start between p_from and p_to
        and a.customer_id in (select id from public.customers
          where business_id = p_business_id and created_at < p_from)));
$$;
alter function public.ai_tool_new_vs_returning(uuid,timestamptz,timestamptz) set schema beautyos_private;
create function public.ai_tool_new_vs_returning(p_business_id uuid,p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql stable security definer set search_path=public as $$ begin perform public.require_plan_capability(p_business_id,'aiCopilot','reports.view'); perform public.require_plan_capability(p_business_id,'aiCopilot','ai.use'); return beautyos_private.ai_tool_new_vs_returning(p_business_id,p_from,p_to); end $$;
revoke all on function public.ai_tool_new_vs_returning(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.ai_tool_new_vs_returning(uuid,timestamptz,timestamptz) to authenticated;
alter function public.ai_tool_loyalty_summary(uuid) set schema beautyos_private;
create function public.ai_tool_loyalty_summary(p_business_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$ begin perform public.require_plan_capability(p_business_id,'aiCopilot','loyalty.manage'); perform public.require_plan_capability(p_business_id,'aiCopilot','ai.use'); return beautyos_private.ai_tool_loyalty_summary(p_business_id); end $$;
revoke all on function public.ai_tool_loyalty_summary(uuid) from public,anon;
grant execute on function public.ai_tool_loyalty_summary(uuid) to authenticated;
alter function public.get_business_kpis(uuid,timestamptz,timestamptz) set schema beautyos_private;
create function public.get_business_kpis(p_business_id uuid,p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql stable security definer set search_path=public as $$ begin perform public.require_plan_capability(p_business_id,null,'reports.view'); return beautyos_private.get_business_kpis(p_business_id,p_from,p_to); end $$;
revoke all on function public.get_business_kpis(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_business_kpis(uuid,timestamptz,timestamptz) to authenticated;
alter function public.get_payment_mix(uuid,timestamptz,timestamptz) set schema beautyos_private;
create function public.get_payment_mix(p_business_id uuid,p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql stable security definer set search_path=public as $$ begin perform public.require_plan_capability(p_business_id,null,'reports.view'); return beautyos_private.get_payment_mix(p_business_id,p_from,p_to); end $$;
revoke all on function public.get_payment_mix(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_payment_mix(uuid,timestamptz,timestamptz) to authenticated;
alter function public.get_demand_heatmap(uuid,int) set schema beautyos_private;
create function public.get_demand_heatmap(p_business_id uuid,p_weeks int default 8) returns jsonb language plpgsql stable security definer set search_path=public as $$ begin perform public.require_plan_capability(p_business_id,null,'reports.view'); return beautyos_private.get_demand_heatmap(p_business_id,p_weeks); end $$;
revoke all on function public.get_demand_heatmap(uuid,int) from public,anon;
grant execute on function public.get_demand_heatmap(uuid,int) to authenticated;
alter function public.get_at_risk_clients(uuid,numeric) set schema beautyos_private;
create function public.get_at_risk_clients(p_business_id uuid,p_tolerance numeric default 1.3) returns jsonb language plpgsql stable security definer set search_path=public as $$ begin perform public.require_plan_capability(p_business_id,null,'clients.view'); return beautyos_private.get_at_risk_clients(p_business_id,p_tolerance); end $$;
revoke all on function public.get_at_risk_clients(uuid,numeric) from public,anon;
grant execute on function public.get_at_risk_clients(uuid,numeric) to authenticated;
create or replace function public.publish_website(p_business_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_snapshot jsonb; v_release uuid;
begin
  if not (public.is_super_admin() or public.has_permission(p_business_id, 'website.manage')) then
    raise exception 'Sin permiso para publicar';
  end if;

  perform public.require_plan_capability(p_business_id,'website','website.manage');
  select jsonb_build_object(
    'locations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'address',address)) from public.locations where business_id=p_business_id and active),'[]'),
    'generated_at', now(),
    'business', jsonb_build_object(
      'name', b.name, 'slug', b.slug, 'description', b.description,
      'phone', b.phone, 'whatsapp', b.whatsapp, 'email', b.email, 'address', b.address),
    'branding', to_jsonb(br),
    'website', to_jsonb(w),
    'sections', coalesce((select jsonb_agg(jsonb_build_object(
        'type', s.type, 'position', s.position, 'active', s.active, 'content', s.content)
        order by s.position) from public.website_sections s where s.business_id = p_business_id), '[]'),
    'media', coalesce((select jsonb_agg(jsonb_build_object(
        'role', m.role, 'storage_path', m.storage_path, 'alt', m.alt,
        'description', m.description, 'position', m.position, 'is_cover', m.is_cover)
        order by m.position) from public.website_media m where m.business_id = p_business_id), '[]'),
    'services', coalesce((select jsonb_agg(jsonb_build_object(
        'id', sv.id, 'location_id',sv.location_id, 'name', sv.name, 'description', sv.description,
        'duration_min', sv.duration_min, 'price', sv.price, 'image_url', sv.image_url,
        'category', c.name) order by sv.position)
        from public.services sv left join public.service_categories c on c.id = sv.category_id
        where sv.business_id = p_business_id and sv.active and sv.show_on_website), '[]'),
    'team', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'location_id',e.location_id, 'full_name', e.full_name, 'role_label', e.role_label,
        'specialty', e.specialty, 'photo_url', e.photo_url, 'bio', e.bio) order by e.full_name)
        from public.employees e where e.business_id = p_business_id and e.active and e.show_on_website), '[]'),
    'promotions', coalesce((select jsonb_agg(to_jsonb(p) order by p.starts_at)
        from public.promotions p where p.business_id = p_business_id
        and p.is_active and p.show_on_website and now()::date between p.starts_at and p.ends_at), '[]'),
    'testimonials', coalesce((select jsonb_agg(jsonb_build_object(
        'author_name', r.author_name, 'rating', r.rating, 'content', r.content, 'photo_url', r.photo_url)
        order by r.created_at desc) from public.reviews r
        where r.business_id = p_business_id and r.is_published), '[]'),
    'hours', coalesce((select jsonb_agg(jsonb_build_object(
        'weekday', h.weekday, 'open_time', h.open_time, 'close_time', h.close_time,
        'is_closed', h.is_closed) order by h.weekday)
        from public.business_hours h where h.business_id = p_business_id and h.location_id is null), '[]'),
    'socials', w.socials, 'map_query', w.map_query
  ) into v_snapshot
  from public.businesses b
  left join public.business_branding br on br.business_id = b.id
  left join public.business_website w on w.business_id = b.id
  where b.id = p_business_id;

  insert into public.website_releases (business_id, snapshot, published_by)
  values (p_business_id, v_snapshot, auth.uid()) returning id into v_release;

  perform public.log_audit(p_business_id, 'PUBLISH', 'website_releases', v_release, null, v_snapshot);
  return v_release;
end $$;

create or replace function public.cancel_appointment(p_appointment_id uuid, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_appt public.appointments%rowtype;
begin
  select * into v_appt from public.appointments where id = p_appointment_id;
  if v_appt.id is null then raise exception 'Cita no encontrada'; end if;
  if not (public.is_super_admin() or public.has_permission(v_appt.business_id, 'calendar.manage')) then
    raise exception 'Sin permiso';
  end if;
  update public.appointments
    set status = 'CANCELLED', cancel_reason = p_reason, updated_at = now()
    where id = p_appointment_id;
  return public.match_waitlist(p_appointment_id);  -- §17–18: recuperar el hueco
end $$;

create or replace function public.match_waitlist(p_appointment_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_appt public.appointments%rowtype;
begin
  select * into v_appt from public.appointments where id = p_appointment_id;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'waitlist_id', w.id, 'customer_id', w.customer_id, 'customer_name', c.full_name,
      'phone', c.phone, 'priority', w.priority)
      order by w.priority desc, w.created_at)
    from public.waitlist w
    join public.customers c on c.id = w.customer_id
    where w.business_id = v_appt.business_id
      and w.status = 'WAITING'
      and (w.employee_id is null or w.employee_id = v_appt.employee_id)
      and (w.preferred_date is null or w.preferred_date = v_appt.scheduled_start::date)
      and exists (select 1 from public.appointment_items ai
                  where ai.appointment_id = v_appt.id and ai.service_id = w.service_id)
      and (w.time_start is null
           or v_appt.scheduled_start::time between w.time_start and w.time_end)
  ), '[]'::jsonb);
end $$;

create or replace function public.complete_appointment(p_appointment_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_appt public.appointments%rowtype;
begin
  select * into v_appt from public.appointments where id = p_appointment_id;
  if not (public.is_super_admin() or public.has_permission(v_appt.business_id, 'calendar.manage')) then
    raise exception 'Sin permiso';
  end if;
  update public.appointments set status = 'COMPLETED', updated_at = now() where id = p_apointment_id;
  perform public.refresh_customer_stats(v_appt.business_id);
end $$;

create or replace function public.refresh_customer_stats(p_business_id uuid) returns void
language sql security definer set search_path = public as $$
  with agg as (
    select a.customer_id,
           count(*) as visits,
           coalesce(sum(a.price_total), 0) as spent,
           max(a.scheduled_start) as last_visit,
           (extract(epoch from (max(a.scheduled_start) - min(a.scheduled_start)))
             / 86400.0 / nullif(count(*) - 1, 0))::int as avg_recurrence
    from public.appointments a
    where a.business_id = p_business_id and a.status = 'COMPLETED'
    group by a.customer_id
  )
  update public.customers c
  set visit_count = agg.visits,
      total_spent = agg.spent,
      last_visit_at = agg.last_visit,
      avg_recurrence_days = agg.avg_recurrence
  from agg where agg.customer_id = c.id and c.business_id = p_business_id;
$$;

create function beautyos_private.resolve_plan_requests() returns trigger language plpgsql security definer set search_path=public as $$ begin
 update public.plan_change_requests set status='APPROVED' where business_id=new.business_id and plan_id=new.plan_id and status='PENDING'; return new;
end $$;
create trigger resolve_plan_requests after insert or update on public.subscriptions for each row execute function beautyos_private.resolve_plan_requests();

-- Conserva nombres de RPC; último parámetro opcional añade la sucursal.
drop function public.get_public_availability(text,date,uuid[],uuid);
create function public.get_public_availability(p_slug text,p_date date,p_service_ids uuid[],p_employee_id uuid default null,p_location_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare bid uuid; loc uuid; tz text; dur int; qty int; step_min int; lead_min int; op time; cl time; closed boolean; e record; t timestamptz; finish_at timestamptz; c jsonb; result jsonb:='[]';
begin
 select id,timezone into bid,tz from public.businesses where slug=p_slug and status in ('ACTIVE','TRIAL');
 if bid is null then return result; end if;
 c:=beautyos_private.capabilities(bid);
 if not (c->>'website')::boolean then return result; end if;
 select id into loc from public.locations where business_id=bid and active and (case when p_location_id is null then is_default else id=p_location_id end) limit 1;
 if loc is null then return result; end if;
 select sum(duration_min),count(*) into dur,qty from public.services where business_id=bid and location_id=loc and id=any(p_service_ids) and active and show_on_website;
 if qty=0 or qty<>cardinality(p_service_ids) then return result; end if;
 select slot_minutes,min_lead_minutes into step_min,lead_min from public.business_settings where business_id=bid;
 step_min:=greatest(coalesce(step_min,30),5); lead_min:=coalesce(lead_min,60);
 select open_time,close_time,is_closed into op,cl,closed from public.business_hours where business_id=bid and weekday=extract(dow from p_date)::int and (location_id=loc or location_id is null) order by location_id nulls last limit 1;
 -- No se inventan horarios operativos cuando el negocio aún no los configuró.
 if op is null or coalesce(closed,true) then return result; end if;
 for e in select id from public.employees where business_id=bid and location_id=loc and active and show_on_website and (p_employee_id is null or id=p_employee_id)
 and (select count(distinct service_id) from public.employee_services where employee_id=employees.id and service_id=any(p_service_ids))=qty loop
  t:=(p_date+op) at time zone tz; finish_at:=(p_date+cl) at time zone tz;
  while t+make_interval(mins=>dur)<=finish_at loop
   if t>=now()+make_interval(mins=>lead_min)
   and not exists(select 1 from public.appointments where business_id=bid and employee_id=e.id and status not in ('CANCELLED','NO_SHOW') and scheduled_start<t+make_interval(mins=>dur) and scheduled_end>t)
   and not exists(select 1 from public.time_off where business_id=bid and employee_id=e.id and starts_at<t+make_interval(mins=>dur) and ends_at>t)
   and (not exists(select 1 from public.employee_schedules where employee_id=e.id) or exists(select 1 from public.employee_schedules where employee_id=e.id and weekday=extract(dow from p_date)::int and start_time<=(t at time zone tz)::time and end_time>=((t+make_interval(mins=>dur)) at time zone tz)::time)) then
    result:=result||jsonb_build_array(jsonb_build_object('starts_at',t,'employee_id',e.id,'location_id',loc));
   end if;
   t:=t+make_interval(mins=>step_min);
  end loop;
 end loop;
 return result;
end $$;
drop function public.create_booking(text,uuid[],uuid,timestamptz,text,text,text);
create function public.create_booking(p_slug text,p_service_ids uuid[],p_employee_id uuid,p_start timestamptz,p_name text,p_phone text,p_notes text default '',p_location_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare bid uuid; loc uuid; emp uuid; cust uuid; ap uuid; total numeric; dur int; tz text; available jsonb;
begin
 select id,timezone into bid,tz from public.businesses where slug=p_slug and status in ('ACTIVE','TRIAL');
 if bid is null then raise exception 'Negocio no disponible'; end if;
 if length(trim(coalesce(p_name,'')))<2 or length(coalesce(p_phone,''))<6 then raise exception 'Nombre y teléfono requeridos'; end if;
 perform 1 from public.businesses where id=bid for update;
 select id into loc from public.locations where business_id=bid and active and (case when p_location_id is null then is_default else id=p_location_id end) limit 1;
 if loc is null then raise exception 'Sucursal no disponible'; end if;
 available:=public.get_public_availability(p_slug,(p_start at time zone tz)::date,p_service_ids,p_employee_id,loc);
 select (x->>'employee_id')::uuid into emp from jsonb_array_elements(available) x where (x->>'starts_at')::timestamptz=p_start limit 1;
 if emp is null then raise exception 'Ese horario ya no está disponible en esta sucursal'; end if;
 select sum(price),sum(duration_min) into total,dur from public.services where business_id=bid and location_id=loc and id=any(p_service_ids);
 insert into public.customers(business_id,full_name,phone,referral_code) values(bid,trim(p_name),p_phone,upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)))
 on conflict(business_id,phone) do update set full_name=excluded.full_name returning id into cust;
 insert into public.appointments(business_id,location_id,customer_id,employee_id,status,source,scheduled_start,scheduled_end,price_total,notes)
 values(bid,loc,cust,emp,'PENDING','LANDING',p_start,p_start+make_interval(mins=>dur),total,p_notes) returning id into ap;
 insert into public.appointment_items(appointment_id,business_id,service_id,employee_id,unit_price,duration_min)
 select ap,bid,id,emp,price,duration_min from public.services where business_id=bid and location_id=loc and id=any(p_service_ids);
 return jsonb_build_object('appointment_id',ap,'total',total,'starts_at',p_start,'ends_at',p_start+make_interval(mins=>dur));
end $$;
revoke all on function public.get_public_availability(text,date,uuid[],uuid,uuid),public.create_booking(text,uuid[],uuid,timestamptz,text,text,text,uuid) from public;
grant execute on function public.get_public_availability(text,date,uuid[],uuid,uuid),public.create_booking(text,uuid[],uuid,timestamptz,text,text,text,uuid) to anon,authenticated;

-- Catálogo de reserva por sucursal: sin exponer columnas privadas del negocio.
create function public.get_public_branches(p_slug text) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare bid uuid; c jsonb;
begin
 select id into bid from public.businesses where slug=p_slug and status in ('ACTIVE','TRIAL');
 if bid is null or not exists(select 1 from public.website_releases where business_id=bid) then return '[]'; end if;
 c:=beautyos_private.capabilities(bid); if not(c->>'website')::boolean then return '[]'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'address',l.address,'is_default',l.is_default,'timezone',(select timezone from public.businesses where id=bid),
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'description',description,'durationMin',duration_min,'price',price,'locationId',location_id,'active',active,'showOnWebsite',show_on_website)) from public.services where business_id=bid and location_id=l.id and active and show_on_website),'[]'),
 'team',coalesce((select jsonb_agg(jsonb_build_object('id',id,'fullName',full_name,'roleLabel',role_label,'specialty',specialty,'bio',bio,'locationId',location_id)) from public.employees where business_id=bid and location_id=l.id and active and show_on_website),'[]')) order by l.is_default desc,l.name) from public.locations l where l.business_id=bid and l.active),'[]');
end $$;
grant execute on function public.get_public_branches(text) to anon,authenticated;

-- Guardado atómico del trabajador y sus servicios; UI no anuncia éxitos optimistas.
create function public.save_team_member(p_business_id uuid,p_id uuid,p_data jsonb,p_services uuid[]) returns uuid language plpgsql security definer set search_path=public as $$
declare eid uuid; loc uuid:=nullif(p_data->>'location_id','')::uuid;
begin
 perform public.require_plan_capability(p_business_id,null,'team.manage');
 if length(trim(coalesce(p_data->>'full_name','')))=0 then raise exception 'Nombre requerido'; end if;
 if p_id is not null and exists(select 1 from public.employees where id=p_id) then
  update public.employees set full_name=trim(p_data->>'full_name'),role_label=p_data->>'role_label',specialty=p_data->>'specialty',bio=p_data->>'bio',commission_rate=(p_data->>'commission_rate')::numeric,show_on_website=(p_data->>'show_on_website')::boolean,active=(p_data->>'active')::boolean
  where id=p_id and business_id=p_business_id returning id into eid;
  if eid is null then raise exception 'Trabajador de otro negocio' using errcode='42501'; end if;
 else
  insert into public.employees(id,business_id,location_id,full_name,role_label,specialty,bio,commission_rate,show_on_website,active)
  values(coalesce(p_id,gen_random_uuid()),p_business_id,loc,trim(p_data->>'full_name'),p_data->>'role_label',p_data->>'specialty',p_data->>'bio',(p_data->>'commission_rate')::numeric,(p_data->>'show_on_website')::boolean,(p_data->>'active')::boolean) returning id into eid;
 end if;
 delete from public.employee_services where employee_id=eid;
 insert into public.employee_services(business_id,employee_id,service_id) select p_business_id,eid,x from unnest(p_services) x;
 return eid;
end $$;
create function public.save_calendar_appointment(p_business_id uuid,p_data jsonb,p_service_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare aid uuid; svc public.services;
begin
 perform public.require_plan_capability(p_business_id,null,'calendar.manage');
 select * into svc from public.services where id=p_service_id and business_id=p_business_id and active;
 if svc.id is null then raise exception 'Selecciona un servicio válido'; end if;
 insert into public.appointments(business_id,location_id,customer_id,employee_id,status,source,scheduled_start,scheduled_end,price_total,notes)
 values(p_business_id,coalesce(nullif(p_data->>'location_id','')::uuid,svc.location_id),(p_data->>'customer_id')::uuid,nullif(p_data->>'employee_id','')::uuid,(p_data->>'status')::public.appointment_status,(p_data->>'source')::public.appointment_source,(p_data->>'scheduled_start')::timestamptz,(p_data->>'scheduled_end')::timestamptz,svc.price,coalesce(p_data->>'notes','')) returning id into aid;
 insert into public.appointment_items(appointment_id,business_id,service_id,employee_id,unit_price,duration_min) values(aid,p_business_id,svc.id,nullif(p_data->>'employee_id','')::uuid,svc.price,svc.duration_min);
 return aid;
end $$;
revoke all on function public.save_team_member(uuid,uuid,jsonb,uuid[]),public.save_calendar_appointment(uuid,jsonb,uuid) from public,anon;
grant execute on function public.save_team_member(uuid,uuid,jsonb,uuid[]),public.save_calendar_appointment(uuid,jsonb,uuid) to authenticated;

-- RPC inventario con bloqueo de fila: ajustes independientes por producto/sucursal.
create function public.adjust_branch_stock(p_product_id uuid,p_type text,p_qty int) returns void language plpgsql security definer set search_path=public as $$
declare p public.products; delta int;
begin
 select * into p from public.products where id=p_product_id for update;
 if p.id is null then raise exception 'Producto no encontrado'; end if;
 perform public.require_plan_capability(p.business_id,null,'inventory.manage');
 if p_type not in ('IN','OUT','ADJUSTMENT') or p_qty<0 then raise exception 'Ajuste inválido'; end if;
 delta:=case p_type when 'IN' then p_qty when 'OUT' then -p_qty else p_qty-p.stock end;
 if p.stock+delta<0 then raise exception 'Stock insuficiente'; end if;
 update public.products set stock=stock+delta where id=p.id;
 insert into public.inventory_movements(business_id,location_id,product_id,type,qty) values(p.business_id,p.location_id,p.id,p_type::public.inventory_move_type,delta);
end $$;
revoke all on function public.adjust_branch_stock(uuid,text,int) from public,anon;
grant execute on function public.adjust_branch_stock(uuid,text,int) to authenticated;

-- Congelar zona horaria ante cambios de usuario normal (no mover el mes de consumo).
create function beautyos_private.protect_business_timezone() returns trigger language plpgsql as $$ begin
 if new.timezone is distinct from old.timezone and not public.is_super_admin() then raise exception 'Solo Super Admin cambia la zona horaria del negocio' using errcode='42501'; end if; return new;
end $$;
create trigger protect_timezone before update on public.businesses for each row execute function beautyos_private.protect_business_timezone();
create function public.admin_plan_businesses(p_plan_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$ begin
 perform public.admin_require_super();
 return coalesce((select jsonb_agg(t) from (select b.id,b.name,s.status,
 (select count(*) from public.employees where business_id=b.id) workers,
 (select count(*) from public.locations where business_id=b.id) branches,
 (select count(*) from public.appointments where business_id=b.id and (status<>'CANCELLED' or was_completed) and date_trunc('month',scheduled_start at time zone b.timezone)=date_trunc('month',now() at time zone b.timezone)) appointments,
 beautyos_private.storage_bytes(b.id) storage_bytes
 from public.businesses b join lateral(select plan_id,status from public.subscriptions where business_id=b.id order by created_at desc,id desc limit 1) s on true where s.plan_id=p_plan_id order by b.name) t),'[]');
end $$;
create function public.admin_resolve_plan_request(p_id uuid,p_approve boolean) returns void language plpgsql security definer set search_path=public as $$
declare r public.plan_change_requests; sid uuid;
begin
 perform public.admin_require_super();
 select * into r from public.plan_change_requests where id=p_id for update;
 if r.id is null or r.status<>'PENDING' then raise exception 'Solicitud no disponible'; end if;
 if p_approve then
  perform 1 from public.businesses where id=r.business_id for update;
  select id into sid from public.subscriptions where business_id=r.business_id order by created_at desc,id desc limit 1;
  if sid is null then insert into public.subscriptions(business_id,plan_id,status) values(r.business_id,r.plan_id,'ACTIVE');
  else update public.subscriptions set plan_id=r.plan_id,status='ACTIVE' where id=sid; end if;
 end if;
 update public.plan_change_requests set status=case when p_approve then 'APPROVED' else 'REJECTED' end where id=p_id;
end $$;
revoke all on function public.admin_plan_businesses(uuid),public.admin_resolve_plan_request(uuid,boolean) from public,anon;
grant execute on function public.admin_plan_businesses(uuid),public.admin_resolve_plan_request(uuid,boolean) to authenticated;

-- Venta completa en una sucursal: todos los ítems y el stock se validan antes de COMMIT.
create function public.create_branch_sale(p_business_id uuid,p_location_id uuid,p_customer_id uuid,p_employee_id uuid,p_discount numeric,p_items jsonb,p_payments jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
<<sale_calc>>
declare sid uuid; iid uuid; item jsonb; pay jsonb; qty int; unit numeric; subtotal numeric:=0; total numeric; paid numeric:=0; rec record; emp uuid; discount_item numeric; item_total numeric; account_id uuid; points int;
begin
 perform public.require_plan_capability(p_business_id,null,'sales.manage');
 if not exists(select 1 from public.locations where id=p_location_id and business_id=p_business_id and active) then raise exception 'Selecciona una sucursal activa'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 or jsonb_typeof(p_payments) is distinct from 'array' then raise exception 'Venta vacía o pagos inválidos'; end if;
 if p_discount is null or p_discount<0 then raise exception 'Descuento inválido'; end if;
 -- Tomar locks de stock en orden estable entre ventas concurrentes.
 perform 1 from public.products where business_id=p_business_id and id in(select (x->>'refId')::uuid from jsonb_array_elements(p_items) x where x->>'kind'='PRODUCT') order by id for update;
 insert into public.sales(business_id,location_id,customer_id,employee_id,status,created_by) values(p_business_id,p_location_id,p_customer_id,p_employee_id,'OPEN',auth.uid()) returning id into sid;
 for item in select * from jsonb_array_elements(p_items) loop
  qty:=(item->>'qty')::int; if qty is null or qty<1 then raise exception 'Cantidad inválida'; end if;
  discount_item:=coalesce((item->>'discount')::numeric,0); if discount_item<0 then raise exception 'Descuento inválido'; end if;
  emp:=nullif(item->>'employeeId','')::uuid;
  if item->>'kind'='SERVICE' then
   select id,name,price into rec from public.services where id=(item->>'refId')::uuid and business_id=p_business_id and location_id=p_location_id and active;
  elsif item->>'kind'='PRODUCT' then
   select id,name,price into rec from public.products where id=(item->>'refId')::uuid and business_id=p_business_id and location_id=p_location_id and active;
   update public.products set stock=stock-qty where id=(item->>'refId')::uuid and business_id=p_business_id and location_id=p_location_id and stock>=qty;
   if not found then raise exception 'Stock insuficiente o producto de otra sucursal'; end if;
   insert into public.inventory_movements(business_id,location_id,product_id,type,qty,created_by) values(p_business_id,p_location_id,(item->>'refId')::uuid,'SALE',-qty,auth.uid());
  else raise exception 'Tipo de ítem inválido'; end if;
  if rec.id is null then raise exception 'Servicio o producto no disponible en esta sucursal'; end if;
  unit:=rec.price; item_total:=unit*qty-discount_item; if item_total<0 then raise exception 'Descuento mayor al precio'; end if;
  subtotal:=subtotal+item_total;
  insert into public.sale_items(sale_id,business_id,item_type,service_id,product_id,description,qty,unit_price,discount,total,employee_id)
  values(sid,p_business_id,(item->>'kind')::public.sale_item_type,case when item->>'kind'='SERVICE' then rec.id end,case when item->>'kind'='PRODUCT' then rec.id end,rec.name,qty,unit,discount_item,item_total,emp) returning id into iid;
  if emp is not null then
   insert into public.commissions(business_id,location_id,employee_id,sale_item_id,base_amount,rate,amount,status)
   select p_business_id,p_location_id,id,iid,item_total,commission_rate,round(item_total*commission_rate/100,2),'PENDING' from public.employees where id=emp and business_id=p_business_id and location_id=p_location_id;
  end if;
 end loop;
 total:=subtotal-p_discount; if total<=0 then raise exception 'El total de la venta debe ser mayor a cero'; end if;
 for pay in select * from jsonb_array_elements(p_payments) loop
  if coalesce((pay->>'amount')::numeric,0)<=0 then raise exception 'Pago inválido'; end if;
  paid:=paid+(pay->>'amount')::numeric;
  insert into public.payments(sale_id,business_id,method,amount,reference,created_by) values(sid,p_business_id,(pay->>'method')::public.payment_method,(pay->>'amount')::numeric,coalesce(pay->>'reference',''),auth.uid());
 end loop;
 if paid<>total then raise exception 'Los pagos no coinciden con el total calculado por el servidor'; end if;
 update public.sales set subtotal=sale_calc.subtotal,discount_total=p_discount,total=sale_calc.total,status='PAID' where id=sid;
 if p_customer_id is not null and (beautyos_private.capabilities(p_business_id)->>'loyalty')::boolean then
  points:=floor(total)::int;
  insert into public.loyalty_accounts(business_id,customer_id,points,lifetime_points) values(p_business_id,p_customer_id,points,points)
  on conflict(customer_id) do update set points=public.loyalty_accounts.points+excluded.points,lifetime_points=public.loyalty_accounts.lifetime_points+excluded.lifetime_points returning id into account_id;
  insert into public.loyalty_transactions(business_id,account_id,type,points,reason,ref_type,ref_id,created_by) values(p_business_id,account_id,'EARN',points,'Compra POS','sale',sid,auth.uid());
 end if;
 return sid;
end $$;
revoke all on function public.create_branch_sale(uuid,uuid,uuid,uuid,numeric,jsonb,jsonb) from public,anon;
grant execute on function public.create_branch_sale(uuid,uuid,uuid,uuid,numeric,jsonb,jsonb) to authenticated;

alter function public.get_public_site(text) set schema beautyos_private;
create function public.get_public_site(p_slug text) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare bid uuid; c jsonb;
begin
 select id into bid from public.businesses where slug=p_slug and status in ('ACTIVE','TRIAL');
 if bid is null then return null; end if;
 c:=beautyos_private.capabilities(bid);
 if not (c->>'website')::boolean then return null; end if;
 return beautyos_private.get_public_site(p_slug);
end $$;
grant execute on function public.get_public_site(text) to anon,authenticated;
-- WhatsApp está habilitado en ambos planes; la cola respeta RBAC y no finge envíos.
drop policy ins on public.whatsapp_messages;
drop policy upd on public.whatsapp_messages;
create policy ins on public.whatsapp_messages for insert to authenticated with check ((public.is_super_admin() or public.has_permission(business_id,'whatsapp.manage')) and status='QUEUED' and sent_at is null and provider_ref='');
create policy upd on public.whatsapp_messages for update to authenticated using ((public.is_super_admin() or public.has_permission(business_id,'whatsapp.manage')) and status='QUEUED') with check ((public.is_super_admin() or public.has_permission(business_id,'whatsapp.manage')) and status='QUEUED' and sent_at is null and provider_ref='');

-- Operaciones de agenda invocables solo con RBAC y tenant correctos.
alter function public.match_waitlist(uuid) set schema beautyos_private;
create function public.match_waitlist(p_appointment_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare bid uuid;
begin
 select business_id into bid from public.appointments where id=p_appointment_id;
 perform public.require_plan_capability(bid,null,'calendar.manage');
 return beautyos_private.match_waitlist(p_appointment_id);
end $$;
alter function public.refresh_customer_stats(uuid) set schema beautyos_private;
create function public.refresh_customer_stats(p_business_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin
 perform public.require_plan_capability(p_business_id,null,'clients.manage');
 perform beautyos_private.refresh_customer_stats(p_business_id);
end $$;
create or replace function public.complete_appointment(p_appointment_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare bid uuid;
begin
 select business_id into bid from public.appointments where id=p_appointment_id;
 perform public.require_plan_capability(bid,null,'calendar.manage');
 update public.appointments set status='COMPLETED' where id=p_appointment_id;
 perform beautyos_private.refresh_customer_stats(bid);
end $$;
revoke all on function public.match_waitlist(uuid),public.refresh_customer_stats(uuid),public.complete_appointment(uuid) from public,anon;
grant execute on function public.match_waitlist(uuid),public.refresh_customer_stats(uuid),public.complete_appointment(uuid) to authenticated;
revoke all on function public.log_audit(uuid,text,text,uuid,jsonb,jsonb) from anon,authenticated;

-- Job de sistema opcional: un rol de negocio nunca puede consultar métricas globales.
create function public.system_ai_metrics(p_business_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare c jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Solo job de sistema' using errcode='42501'; end if;
 c:=beautyos_private.capabilities(p_business_id);
 if not (c->>'aiCopilot')::boolean then return null; end if;
 return jsonb_build_object(
 'atRisk',coalesce((select jsonb_agg(jsonb_build_object('customer_id',id,'name',full_name,'avg_recurrence_days',avg_recurrence_days)) from public.customers where business_id=p_business_id and visit_count>=2 and avg_recurrence_days is not null and now()-last_visit_at > (avg_recurrence_days*1.3)*interval '1 day'),'[]'),
 'kpis',(select jsonb_build_object('appointments',count(*),'cancelled',count(*) filter(where status in ('CANCELLED','NO_SHOW'))) from public.appointments where business_id=p_business_id and scheduled_start>=now()-interval '7 days' and scheduled_start<=now()),
 'lowStock',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'stock',stock,'stock_min',stock_min)) from public.products where business_id=p_business_id and active and stock<=stock_min),'[]'));
end $$;
revoke all on function public.system_ai_metrics(uuid) from public,anon,authenticated;
grant execute on function public.system_ai_metrics(uuid) to service_role;

create function public.ai_tool_inventory(p_business_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$ begin
 perform public.require_plan_capability(p_business_id,'aiCopilot','ai.use');
 perform public.require_plan_capability(p_business_id,null,'inventory.view');
 return coalesce((select jsonb_agg(t) from (select p.name,p.sku,l.name as branch,p.stock,p.stock_min,p.price from public.products p join public.locations l on l.id=p.location_id where p.business_id=p_business_id and p.active order by (p.stock<=p.stock_min) desc,p.name limit 100) t),'[]');
end $$;
revoke all on function public.ai_tool_inventory(uuid) from public,anon;
grant execute on function public.ai_tool_inventory(uuid) to authenticated;
-- El canje compartido por ambos planes se confirma en una sola transacción.
create function public.adjust_loyalty_points(p_business_id uuid,p_customer_id uuid,p_points integer,p_reason text) returns uuid
language plpgsql security definer set search_path=public as $$
declare account public.loyalty_accounts; txid uuid;
begin
 perform public.require_plan_capability(p_business_id,'loyalty','loyalty.manage');
 if p_points is null or p_points=0 or coalesce(trim(p_reason),'')='' then raise exception 'Indica puntos y motivo'; end if;
 if not exists(select 1 from public.customers where id=p_customer_id and business_id=p_business_id) then raise exception 'Cliente de otro negocio' using errcode='42501'; end if;
 insert into public.loyalty_accounts(business_id,customer_id) values(p_business_id,p_customer_id) on conflict(customer_id) do nothing;
 select * into account from public.loyalty_accounts where customer_id=p_customer_id and business_id=p_business_id for update;
 if account.points+p_points<0 then raise exception 'Puntos insuficientes para canjear la recompensa'; end if;
 update public.loyalty_accounts set points=points+p_points,lifetime_points=lifetime_points+greatest(p_points,0) where id=account.id;
 insert into public.loyalty_transactions(business_id,account_id,type,points,reason,created_by)
 values(p_business_id,account.id,case when p_points<0 then 'REDEEM'::public.loyalty_txn_type else 'EARN'::public.loyalty_txn_type end,p_points,trim(p_reason),auth.uid()) returning id into txid;
 return txid;
end $$;
revoke all on function public.adjust_loyalty_points(uuid,uuid,integer,text) from public,anon;
grant execute on function public.adjust_loyalty_points(uuid,uuid,integer,text) to authenticated;
create function beautyos_private.loyalty_tier_guard() returns trigger language plpgsql set search_path=public as $$ begin
 if new.points<0 or new.lifetime_points<0 then raise exception 'Los puntos no pueden ser negativos'; end if;
 new.tier:=case when new.lifetime_points>=800 then 'VIP'::public.loyalty_tier when new.lifetime_points>=500 then 'GOLD'::public.loyalty_tier when new.lifetime_points>=250 then 'SILVER'::public.loyalty_tier else 'STARTER'::public.loyalty_tier end;
 return new;
end $$;
create trigger loyalty_tier_guard before insert or update on public.loyalty_accounts for each row execute function beautyos_private.loyalty_tier_guard();

-- Fechas inclusivas de negocio; PostgreSQL resuelve zona horaria y cambios DST.
create function public.get_branch_report_dates(p_business_id uuid,p_location_id uuid,p_from_date date,p_to_date date) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare tz text;
begin
 perform public.require_plan_capability(p_business_id,null,'reports.view');
 if p_from_date is null or p_to_date is null or p_to_date<p_from_date then raise exception 'Período de reporte inválido'; end if;
 select timezone into tz from public.businesses where id=p_business_id;
 return public.get_branch_report(p_business_id,p_location_id,p_from_date::timestamp at time zone tz,(p_to_date+1)::timestamp at time zone tz);
end $$;
revoke all on function public.get_branch_report_dates(uuid,uuid,date,date) from public,anon;
grant execute on function public.get_branch_report_dates(uuid,uuid,date,date) to authenticated;
revoke all on all functions in schema beautyos_private from public,anon,authenticated;
notify pgrst,'reload schema';
commit;


-- FUENTE: migrations/20260924000004_website_editor.sql
-- Nuvia: editor web real. Requiere migraciones 01, 02 y 03. Ver docs/editor-web-alcance.md.
begin;
select pg_advisory_xact_lock(2409202604);
do $$ begin
 if to_regprocedure('public.require_plan_capability(uuid,text,text)') is null then
  raise exception 'Primero instala PLANES_Y_SUCURSALES.sql (migración 03).';
 end if;
end $$;
alter table public.business_website add column template_key text check(template_key in ('EDITORIAL','STUDIO','SERENE'));
alter table public.business_website add column public_info jsonb not null default '{}'::jsonb check(jsonb_typeof(public_info)='object' and public_info - array['name','description','phone','whatsapp','email','address']='{}'::jsonb);
alter table public.business_website add column draft_revision bigint not null default 0;

create function beautyos_private.website_snapshot(p_business_id uuid) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'locations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'address',address)) from public.locations where business_id=p_business_id and active),'[]'),
    'generated_at', now(),
    'business', jsonb_build_object(
      'name', b.name, 'slug', b.slug, 'type', b.type, 'description', b.description,
      'phone', b.phone, 'whatsapp', b.whatsapp, 'email', b.email, 'address', b.address) || coalesce(w.public_info,'{}'::jsonb),
    'branding', to_jsonb(br),
    'website', to_jsonb(w),
    'sections', coalesce((select jsonb_agg(jsonb_build_object(
        'type', s.type, 'position', s.position, 'active', s.active, 'content', s.content)
        order by s.position) from public.website_sections s where s.business_id = p_business_id), '[]'),
    'media', coalesce((select jsonb_agg(jsonb_build_object(
        'role', m.role, 'storage_path', m.storage_path, 'alt', m.alt,
        'description', m.description, 'position', m.position, 'is_cover', m.is_cover)
        order by m.position) from public.website_media m where m.business_id = p_business_id), '[]'),
    'services', coalesce((select jsonb_agg(jsonb_build_object(
        'id', sv.id, 'location_id',sv.location_id, 'name', sv.name, 'description', sv.description,
        'duration_min', sv.duration_min, 'price', sv.price, 'image_url', sv.image_url,
        'category', c.name) order by sv.position)
        from public.services sv left join public.service_categories c on c.id = sv.category_id
        where sv.business_id = p_business_id and sv.active and sv.show_on_website), '[]'),
    'team', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'location_id',e.location_id, 'full_name', e.full_name, 'role_label', e.role_label,
        'specialty', e.specialty, 'photo_url', e.photo_url, 'bio', e.bio) order by e.full_name)
        from public.employees e where e.business_id = p_business_id and e.active and e.show_on_website), '[]'),
    'promotions', coalesce((select jsonb_agg(to_jsonb(p) order by p.starts_at)
        from public.promotions p where p.business_id = p_business_id
        and p.is_active and p.show_on_website and now()::date between p.starts_at and p.ends_at), '[]'),
    'testimonials', coalesce((select jsonb_agg(jsonb_build_object(
        'author_name', r.author_name, 'rating', r.rating, 'content', r.content, 'photo_url', r.photo_url)
        order by r.created_at desc) from public.reviews r
        where r.business_id = p_business_id and r.is_published), '[]'),
    'hours', coalesce((select jsonb_agg(jsonb_build_object(
        'weekday', h.weekday, 'open_time', h.open_time, 'close_time', h.close_time,
        'is_closed', h.is_closed) order by h.weekday)
        from (select distinct on (bh.weekday) bh.* from public.business_hours bh
          where bh.business_id = p_business_id and (bh.location_id is null or bh.location_id=(select id from public.locations where business_id=p_business_id and is_default limit 1))
          order by bh.weekday, (bh.location_id is not null) desc, bh.id) h), '[]'),
    'socials', w.socials, 'map_query', w.map_query
  )
  from public.businesses b
  left join public.business_branding br on br.business_id = b.id
  left join public.business_website w on w.business_id = b.id
  where b.id = p_business_id;

$$;

create function public.get_website_editor(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 perform public.require_plan_capability(p_business_id,'website','website.manage');
 select jsonb_build_object('draft',beautyos_private.website_snapshot(p_business_id),
 'revision',coalesce((select draft_revision from public.business_website where business_id=p_business_id),0),
 'published_at',(select created_at from public.website_releases where business_id=p_business_id order by created_at desc,id desc limit 1),
 'published_revision',(select (snapshot->'website'->>'draft_revision')::bigint from public.website_releases where business_id=p_business_id order by created_at desc,id desc limit 1)) into result;
 return result;
end $$;

create function public.save_website_draft(p_business_id uuid,p_draft jsonb,p_expected_revision bigint) returns bigint
language plpgsql security definer set search_path=public as $$
declare rev bigint; sect jsonb; kind text; settings jsonb; brand jsonb; info jsonb; k text; item jsonb;
begin
 perform public.require_plan_capability(p_business_id,'website','website.manage');
 perform 1 from public.businesses where id=p_business_id for update;
 perform public.require_plan_capability(p_business_id,'website','website.manage');
 insert into public.business_website(business_id) values(p_business_id) on conflict(business_id) do nothing;
 select draft_revision into rev from public.business_website where business_id=p_business_id for update;
 if p_expected_revision is null or rev<>p_expected_revision then raise exception 'El borrador cambió en otra sesión. Recarga antes de guardar para no sobrescribir cambios.' using errcode='40001'; end if;
 if jsonb_typeof(p_draft) is distinct from 'object' or octet_length(p_draft::text)>2097152 then raise exception 'Borrador inválido o demasiado grande'; end if;
 settings:=p_draft->'website'; brand:=p_draft->'branding'; info:=p_draft->'business';
 if jsonb_typeof(settings) is distinct from 'object' or jsonb_typeof(brand) is distinct from 'object' or jsonb_typeof(info) is distinct from 'object' then raise exception 'Borrador incompleto'; end if;
 if coalesce(settings->>'template_key','') not in ('EDITORIAL','STUDIO','SERENE') then raise exception 'Selecciona una de las tres plantillas'; end if;
 if coalesce(brand->>'font_key','') not in ('sans','serif') then raise exception 'Tipografía inválida'; end if;
 if jsonb_typeof(brand->'colors') is distinct from 'object' then raise exception 'Colores inválidos'; end if;
 foreach k in array array['primary','button'] loop
  if coalesce(brand->'colors'->>k,'') !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Color inválido: usa formato hexadecimal'; end if;
 end loop;
 if coalesce(trim(info->>'name'),'')='' or length(info->>'name')>120 then raise exception 'Indica el nombre público (hasta 120 caracteres)'; end if;
 if jsonb_typeof(settings->'socials') is distinct from 'object' then raise exception 'Redes inválidas'; end if;
 foreach k in array array['instagram','tiktok','facebook'] loop
  if coalesce(settings->'socials'->>k,'')<>'' and (settings->'socials'->>k) !~ '^https?://' then raise exception 'Las redes deben ser enlaces http o https completos'; end if;
 end loop;
 if coalesce(brand->>'logo_url','')<>'' and (brand->>'logo_url') !~ '^https?://' then raise exception 'Logo inválido'; end if;
 if coalesce(brand->>'cover_url','')<>'' and (brand->>'cover_url') !~ '^https?://' then raise exception 'Portada inválida'; end if;
 if jsonb_typeof(p_draft->'sections') is distinct from 'array' then raise exception 'Secciones inválidas'; end if;
 if jsonb_array_length(p_draft->'sections')<>10 or (select count(distinct x->>'type') from jsonb_array_elements(p_draft->'sections') x)<>10 then raise exception 'Se requieren las diez secciones, sin duplicados'; end if;
 for sect in select * from jsonb_array_elements(p_draft->'sections') loop
  kind:=sect->>'type';
  if kind not in ('HERO','SERVICES','ABOUT','GALLERY','TEAM','PROMOTIONS','TESTIMONIALS','LOCATION','CTA','FOOTER') or jsonb_typeof(sect->'content') is distinct from 'object' or jsonb_typeof(sect->'active') is distinct from 'boolean' then raise exception 'Sección inválida'; end if;
  if kind='GALLERY' and sect->'content' ? 'images' then
   if jsonb_typeof(sect->'content'->'images') is distinct from 'array' then raise exception 'Galería inválida'; end if;
   for item in select * from jsonb_array_elements(sect->'content'->'images') loop
    if jsonb_typeof(item) is distinct from 'object' or coalesce(item->>'url','') !~ '^https?://' then raise exception 'Imagen de galería inválida'; end if;
   end loop;
  end if;
  if kind='TESTIMONIALS' and sect->'content' ? 'items' then
   if jsonb_typeof(sect->'content'->'items') is distinct from 'array' then raise exception 'Testimonios inválidos'; end if;
   for item in select * from jsonb_array_elements(sect->'content'->'items') loop
    if jsonb_typeof(item) is distinct from 'object' or coalesce((item->>'rating')::integer,0) not between 1 and 5 then raise exception 'Calificación inválida'; end if;
   end loop;
  end if;
  insert into public.website_sections(business_id,type,position,active,content)
  values(p_business_id,kind::public.website_section_type,(sect->>'position')::integer,(sect->>'active')::boolean,sect->'content')
  on conflict(business_id,type) do update set position=excluded.position,active=excluded.active,content=excluded.content;
 end loop;
 insert into public.business_branding(business_id,preset,colors,font_key,logo_url,cover_url)
 values(p_business_id,case settings->>'template_key' when 'EDITORIAL' then 'ELEGANT'::public.website_theme_preset when 'STUDIO' then 'DARK'::public.website_theme_preset else 'SOFT'::public.website_theme_preset end,
 brand->'colors',brand->>'font_key',nullif(brand->>'logo_url',''),nullif(brand->>'cover_url',''))
 on conflict(business_id) do update set preset=excluded.preset,colors=excluded.colors,font_key=excluded.font_key,logo_url=excluded.logo_url,cover_url=excluded.cover_url;
 update public.business_website set template_key=settings->>'template_key',
 tagline=coalesce(settings->>'tagline',''),map_query=coalesce(settings->>'map_query',''),
 socials=jsonb_build_object('instagram',coalesce(settings->'socials'->>'instagram',''),'facebook',coalesce(settings->'socials'->>'facebook',''),'tiktok',coalesce(settings->'socials'->>'tiktok','')),
 public_info=jsonb_build_object('name',trim(info->>'name'),'description',coalesce(info->>'description',''),'phone',coalesce(info->>'phone',''),'whatsapp',coalesce(info->>'whatsapp',''),'email',coalesce(info->>'email',''),'address',coalesce(info->>'address','')),
 draft_revision=rev+1 where business_id=p_business_id;
 return rev+1;
end $$;

-- Publicar conserva el contrato existente y solo lee un borrador autorizado.
create or replace function public.publish_website(p_business_id uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare snap jsonb; release uuid;
begin
 perform public.require_plan_capability(p_business_id,'website','website.manage');
 perform 1 from public.businesses where id=p_business_id for update;
 perform public.require_plan_capability(p_business_id,'website','website.manage');
 snap:=beautyos_private.website_snapshot(p_business_id);
 if not exists(select 1 from jsonb_array_elements(snap->'sections') x where x->>'type'='HERO' and (x->>'active')::boolean and length(trim(coalesce(x->'content'->>'title','')))>0) then raise exception 'Activa la portada y escribe un título antes de publicar'; end if;
 if exists(select 1 from jsonb_array_elements(snap->'sections') x cross join lateral jsonb_array_elements(case when jsonb_typeof(x->'content'->'items')='array' then x->'content'->'items' else '[]'::jsonb end) r
 where x->>'type'='TESTIMONIALS' and (x->>'active')::boolean and (coalesce(trim(r->>'author_name'),'')='' or coalesce(trim(r->>'content'),'')='')) then raise exception 'Completa el autor y texto de cada testimonio visible'; end if;
 insert into public.website_releases(business_id,snapshot,published_by,created_at) values(p_business_id,snap,auth.uid(),clock_timestamp()) returning id into release;
 perform public.log_audit(p_business_id,'PUBLISH','website_releases',release,null,snap);
 return release;
end $$;

create function public.publish_website_draft(p_business_id uuid,p_draft jsonb,p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path=public as $$
declare revision bigint; release uuid; slug text; published timestamptz;
begin
 revision:=public.save_website_draft(p_business_id,p_draft,p_expected_revision);
 release:=public.publish_website(p_business_id);
 select b.slug into slug from public.businesses b where id=p_business_id;
 select created_at into published from public.website_releases where id=release;
 return jsonb_build_object('release_id',release,'revision',revision,'slug',slug,'published_at',published);
end $$;
revoke all on function beautyos_private.website_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.get_website_editor(uuid),public.save_website_draft(uuid,jsonb,bigint),public.publish_website_draft(uuid,jsonb,bigint),public.publish_website(uuid) from public,anon;
grant execute on function public.get_website_editor(uuid),public.save_website_draft(uuid,jsonb,bigint),public.publish_website_draft(uuid,jsonb,bigint),public.publish_website(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
