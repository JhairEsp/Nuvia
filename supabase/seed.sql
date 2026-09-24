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

