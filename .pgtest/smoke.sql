-- 🔬 Smoke tests: datos, RPCs públicas y AISLAMIENTO DE TENANTS (§54) — idempotente
\set ON_ERROR_STOP on
\echo '════ 1. DATOS SEMBRADOS ════'
select (select count(*) from businesses) as negocios,
       (select count(*) from services) as servicios,
       (select count(*) from employees) as trabajadores,
       (select count(*) from customers) as clientes,
       (select count(*) from appointments) as citas,
       (select count(*) from sales) as ventas,
       (select count(*) from payments) as pagos,
       (select count(*) from commissions) as comisiones,
       (select count(*) from website_releases) as releases,
       (select count(*) from audit_logs) as auditoria,
       (select count(*) from role_permissions) as permisos_rbac;

\echo '════ 2. RPC PÚBLICA: get_public_site ════'
select (public.get_public_site('barberia-black') -> 'business' ->> 'name') as nombre_publico,
       jsonb_array_length(public.get_public_site('barberia-black') -> 'services') as servicios_web,
       jsonb_array_length(public.get_public_site('barberia-black') -> 'team') as equipo_web;

\echo '════ 3. RPC PÚBLICA: get_public_availability ════'
select count(*) as slots_libres
from jsonb_array_elements(
  public.get_public_availability('barberia-black', current_date + 5,
    (select array_agg(id) from services where name = 'Corte Premium'), null));

\echo '════ 4. RPC PÚBLICA: create_booking + anti-doble-booking ════'
do $$
declare v_slots jsonb; v_start timestamptz; v_res jsonb; v_emp uuid;
begin
  v_slots := public.get_public_availability('barberia-black', current_date + 6,
    (select array_agg(id) from services where name = 'Barba'), null);
  if jsonb_array_length(v_slots) = 0 then
    raise notice '⚠ sin slots en fecha+6 (horario ocupado) — omitido'; return;
  end if;
  v_start := (v_slots -> 0 ->> 'starts_at')::timestamptz;
  v_emp := (v_slots -> 0 ->> 'employee_id')::uuid;
  v_res := public.create_booking('barberia-black',
    (select array_agg(id) from services where name = 'Barba'),
    v_emp, v_start, 'Cliente Prueba', '999000111', 'smoke test');
  raise notice '✅ booking creado: %', v_res ->> 'appointment_id';
  -- segundo booking en el MISMO hueco debe fallar
  begin
    perform public.create_booking('barberia-black',
      (select array_agg(id) from services where name = 'Barba'),
      v_emp, v_start, 'Cliente Repetido', '999000222', 'doble');
    raise notice '❌ FALLO: se permitió doble booking';
  exception when others then
    raise notice '✅ doble booking bloqueado: %', sqlerrm;
  end;
end $$;

\echo '════ 5. ANALYTICS: KPIs + clientes en riesgo + tools IA ════'
select set_config('request.jwt.claim.sub', (select id::text from public.users where email = 'admin@blackhouse.pe'), false);
select (public.get_business_kpis((select id from businesses where slug = 'barberia-black'), now() - interval '30 days', now()) ->> 'revenue') as ingresos_30d,
       jsonb_array_length(public.get_at_risk_clients((select id from businesses where slug = 'barberia-black'))) as clientes_en_riesgo,
       jsonb_array_length(public.ai_tool_top_services((select id from businesses where slug = 'barberia-black'), now() - interval '30 days', now())) as top_servicios;

\echo '════ 6. Preparar Business B + usuario B (como Super Admin — flujo real /admin) ════'
reset role;
select set_config('request.jwt.claim.sub', (select id::text from public.users where email = 'super@beautyapp.pe'), false);
insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-4111-8111-111111111111', 'b@test.pe', '{"full_name":"Dueño B"}'::jsonb)
on conflict (id) do nothing;
insert into businesses (id, name, slug)
values ('22222222-2222-4222-8222-222222222222', 'Spa B', 'spa-b')
on conflict (id) do nothing;
insert into business_users (business_id, user_id, role_code, status)
values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'BUSINESS_ADMIN', 'ACTIVE')
on conflict (business_id, user_id) do nothing;
insert into customers (business_id, full_name, phone, referral_code)
select '22222222-2222-4222-8222-222222222222', 'Cliente Secreto B', '900000001', 'SECRETO-001'
where not exists (select 1 from customers where phone = '900000001');

\echo '════ 7. RLS: usuario A (Carlos) NO ve clientes de Business B ════'
set role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from public.users where email = 'carlos@blackhouse.pe'), false);
select count(*) as clientes_B_visibles_por_A_debe_ser_0 from customers where business_id = '22222222-2222-4222-8222-222222222222';
select count(*) as clientes_A_visibles_por_A_mayor_a_29 from customers where business_id = (select business_id from business_users where user_id = auth.uid() limit 1);

\echo '════ 8. RLS: usuario B NO ve clientes de Business A ════'
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select count(*) as clientes_A_visibles_por_B_debe_ser_0 from customers where business_id = (select id from businesses where slug = 'barberia-black');
select count(*) as clientes_B_visibles_por_B_debe_ser_1 from customers where business_id = '22222222-2222-4222-8222-222222222222';

\echo '════ 9. RLS: SIN sesión no ve nada ════'
reset request.jwt.claim.sub;
select count(*) as clientes_sin_sesion_debe_ser_0 from customers;

\echo '════ 10. ANTI-ESCALAMIENTO: no se puede crear otro BUSINESS_ADMIN ════'
select set_config('request.jwt.claim.sub', (select id::text from public.users where email = 'carlos@blackhouse.pe'), false);
do $$
begin
  begin
    insert into business_users (business_id, user_id, role_code, status)
    values ((select business_id from business_users where user_id = auth.uid() limit 1),
            '11111111-1111-4111-8111-111111111111', 'BUSINESS_ADMIN', 'ACTIVE');
    raise notice '❌ FALLO: se permitió escalar privilegios';
  exception when others then
    raise notice '✅ bloqueado por trigger: %', sqlerrm;
  end;
end $$;

reset role;
\echo '════ FIN SMOKE TESTS ════'
