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
