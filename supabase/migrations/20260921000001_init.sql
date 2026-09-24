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
