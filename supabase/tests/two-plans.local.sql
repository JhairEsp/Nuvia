-- SOLO PostgreSQL LOCAL preparado por .pgtest/rebuild-plans.sh. Auth/Storage son stubs.
\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(b boolean,label text) returns void language plpgsql as $$ begin
 if not coalesce(b,false) then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label;
end $$;
create function pg_temp.reject(q text, fragment text,label text) returns void language plpgsql as $$ begin
 begin execute q; exception when others then
  if position(fragment in sqlerrm)=0 then raise exception 'FAIL: % error inesperado: %',label,sqlerrm; end if;
  raise notice 'PASS: %',label; return;
 end;
 raise exception 'FAIL: % operación no bloqueada',label;
end $$;
select pg_temp.ok((select count(*)=2 and bool_and(code in ('STARTER','BUSINESS')) from public.plans),'Solo dos planes comerciales');
select pg_temp.ok((select id='f0000000-0000-0000-0000-000000000001' from public.plans where code='STARTER'),'Conservar UUID Starter');
select pg_temp.ok((select id='f0000000-0000-0000-0000-000000000003' from public.plans where code='BUSINESS'),'Conservar UUID Business');
select pg_temp.ok((select old_plan->>'code'='PRO' and (old_plan->>'price_monthly')::numeric=149 from public.subscription_plan_history where subscription_id='d0000000-0000-0000-0000-000000000002'),'Conservar snapshot histórico Pro');
select pg_temp.ok((select plan_id='f0000000-0000-0000-0000-000000000003' from public.subscriptions where id='d0000000-0000-0000-0000-000000000002'),'Suscripción Pro conserva UUID y ahora usa Business');
select pg_temp.ok((select limits->'max_employees'='null'::jsonb and limits->'max_monthly_appointments'='null'::jsonb and limits->'max_branches'='null'::jsonb and limits->>'max_storage_mb'='10240' from public.plans where code='BUSINESS'),'Business ilimitado explícito y 10 GB');
select pg_temp.reject($q$insert into public.plans(code,name) values('PRO','Otra vez')$q$,'Solo existen','No recrear tercer plan');
-- Storage local emula las policies de un proyecto Supabase.
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select pg_temp.ok((public.get_plan_usage('b0000000-0000-0000-0000-000000000001')->'capabilities'->>'maxWorkers')::int=5,'Capacidad Starter en API');
select pg_temp.ok(public.plan_module_enabled('b0000000-0000-0000-0000-000000000001','loyalty'),'Starter fidelización');
select pg_temp.ok(public.plan_module_enabled('b0000000-0000-0000-0000-000000000001','aiCopilot'),'Starter Copiloto IA');
select pg_temp.ok(public.plan_module_enabled('b0000000-0000-0000-0000-000000000001','whatsapp'),'Starter WhatsApp');
select public.require_plan_capability('b0000000-0000-0000-0000-000000000001','aiCopilot','ai.use');
select public.ai_tool_loyalty_summary('b0000000-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*)=1 from public.locations where business_id='b0000000-0000-0000-0000-000000000001'),'Starter una sucursal');
select pg_temp.reject($q$insert into public.locations(business_id,name) values('b0000000-0000-0000-0000-000000000001','Segunda')$q$,'múltiples sucursales','Starter bloquea segunda por INSERT directo');
select pg_temp.reject($q$select public.save_branch('b0000000-0000-0000-0000-000000000001',null,'{"name":"Otra"}')$q$,'múltiples sucursales','Starter bloquea segunda por RPC');
insert into public.employees(id,business_id,full_name) values('e0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','Primero');
select pg_temp.ok((select count(*)=1 from public.employees),'Crear trabajador 1');
insert into public.employees(business_id,full_name) select 'b0000000-0000-0000-0000-000000000001','Empleado '||i from generate_series(2,5) i;
select pg_temp.ok((select count(*)=5 from public.employees),'Crear trabajador 5');
select pg_temp.reject($q$insert into public.employees(business_id,full_name) values('b0000000-0000-0000-0000-000000000001','Sexto')$q$,'límite de 5','Bloquear trabajador 6 directamente');
select pg_temp.reject($q$select public.save_team_member('b0000000-0000-0000-0000-000000000001',null,'{"full_name":"Sexto","role_label":"Barber","specialty":"","bio":"","commission_rate":10,"show_on_website":true,"active":true}','{}')$q$,'límite de 5','Bloquear trabajador 6 por RPC');
update public.employees set active=false where id='e0000000-0000-0000-0000-000000000001';
select pg_temp.reject($q$insert into public.employees(business_id,full_name) values('b0000000-0000-0000-0000-000000000001','Inactivo tampoco libera')$q$,'límite de 5','Desactivar trabajador no permite bypass');
insert into public.employees(id,business_id,full_name) values('e0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','Editar en cupo completo') on conflict(id) do update set full_name=excluded.full_name;
select pg_temp.ok((select count(*)=5 from public.employees),'UPSERT edición no consume trabajador extra');
insert into public.customers(id,business_id,full_name,phone,referral_code) values('c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','Cliente','999000111','LOCAL1');
insert into public.appointments(business_id,customer_id,scheduled_start,scheduled_end,status)
 select 'b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',date_trunc('month',now() at time zone 'America/Lima') at time zone 'America/Lima'+interval '1 day',date_trunc('month',now() at time zone 'America/Lima') at time zone 'America/Lima'+interval '1 day 1 hour','PENDING' from generate_series(1,300);
select pg_temp.ok((public.get_plan_usage('b0000000-0000-0000-0000-000000000001')->'usage'->>'appointments')::int=300,'Crear citas 1 a 300 y consumo del mes');
select pg_temp.reject($q$insert into public.appointments(business_id,customer_id,scheduled_start,scheduled_end) values('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',now(),now()+interval '1 hour')$q$,'límite de 300','Bloquear cita 301 directamente');
insert into public.appointments(id,business_id,customer_id,scheduled_start,scheduled_end,status) values('a1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',now()+interval '1 month',now()+interval '1 month 1 hour','PENDING');
select pg_temp.ok((public.get_plan_usage('b0000000-0000-0000-0000-000000000001')->'usage'->>'appointments')::int=300,'Mes futuro independiente');
select pg_temp.reject($q$update public.appointments set scheduled_start=now(),scheduled_end=now()+interval '1 hour' where id='a1000000-0000-0000-0000-000000000001'$q$,'límite de 300','Reprogramar al mes completo no evita cuota');
select id as cancel_id from public.appointments where status='PENDING' and scheduled_start<now()+interval '1 day' limit 1 \gset
update public.appointments set status='CANCELLED' where id=:'cancel_id';
select pg_temp.ok((public.get_plan_usage('b0000000-0000-0000-0000-000000000001')->'usage'->>'appointments')::int=299,'Cancelar no atendida libera cupo');
insert into public.appointments(business_id,customer_id,scheduled_start,scheduled_end,status) values('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',now(),now()+interval '1 hour','COMPLETED') returning id as completed_id \gset
select pg_temp.reject(format('update public.appointments set status=''CONFIRMED'' where id=%L',:'cancel_id'),'límite de 300','Reactivar cancelada valida consumo');
select pg_temp.reject(format('update public.appointments set status=''CANCELLED'',was_completed=false where id=%L',:'completed_id'),'conserva su estado','Completada no se cancela para recuperar cupo');
select pg_temp.reject(format('delete from public.appointments where id=%L',:'completed_id'),'No se elimina','Completada no se elimina para recuperar cupo');
-- Reserva pública utiliza la misma cuota del mes de destino.
update public.employees set active=true where id='e0000000-0000-0000-0000-000000000001';
insert into public.services(id,business_id,name,duration_min,price) values('f2000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','Servicio público',30,30);
insert into public.employee_services(employee_id,service_id,business_id) values('e0000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001');
insert into public.business_settings(business_id) values('b0000000-0000-0000-0000-000000000001');
insert into public.business_hours(business_id,weekday,open_time,close_time) select 'b0000000-0000-0000-0000-000000000001',i,'09:00','18:00' from generate_series(0,6) i;
select public.publish_website('b0000000-0000-0000-0000-000000000001');
insert into public.appointments(business_id,customer_id,scheduled_start,scheduled_end)
 select 'b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',now()+interval '1 month',now()+interval '1 month 1 hour' from generate_series(1,299);
select (date_trunc('month',now() at time zone 'America/Lima')+interval '1 month 10 days')::date as booking_day \gset
set local role anon;
select pg_temp.ok(jsonb_array_length(public.get_public_branches('local-starter'))=1,'Catálogo público de una sucursal Starter');
select pg_temp.ok(jsonb_array_length(public.get_public_availability('local-starter',:'booking_day',array['f2000000-0000-0000-0000-000000000001'::uuid],null))>0,'Disponibilidad pública con horarios configurados');
select pg_temp.reject(format($q$select public.create_booking('local-starter',array['f2000000-0000-0000-0000-000000000001'::uuid],null,%L,'Reserva','999123456')$q$,(:'booking_day'::date+time '10:00') at time zone 'America/Lima'),'límite de 300','Reserva pública anónima no evita cuota');
set local role authenticated;
select pg_temp.ok((select count(*)=1 from public.customers where business_id='b0000000-0000-0000-0000-000000000001'),'Reserva rechazada revierte alta del cliente');

insert into public.loyalty_accounts(business_id,customer_id,points,lifetime_points,tier) values('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',20,20,'SILVER') returning id as loyalty_id \gset
insert into public.loyalty_transactions(business_id,account_id,type,points,reason) values('b0000000-0000-0000-0000-000000000001',:'loyalty_id','EARN',20,'Prueba de recompensa');
insert into public.promotions(business_id,name,starts_at,ends_at) values('b0000000-0000-0000-0000-000000000001','Clientes frecuentes',current_date,current_date+7);
select pg_temp.ok((select count(*)=1 from public.loyalty_transactions),'Starter registra historial de fidelización');
select pg_temp.ok((select count(*)=1 from public.promotions),'Starter registra promociones');
select public.adjust_loyalty_points('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',300,'Compra');
select public.adjust_loyalty_points('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',-100,'Canje');
select pg_temp.ok((select points=220 and lifetime_points=320 and tier='SILVER' from public.loyalty_accounts where id=:'loyalty_id'),'Starter gana/canjea puntos y conserva nivel acumulado');
select pg_temp.ok((select count(*)=3 from public.loyalty_transactions),'Canje conserva historial completo');
select pg_temp.reject($q$select public.adjust_loyalty_points('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',-221,'Exceso')$q$,'Puntos insuficientes','Canje rechaza saldo negativo');
select pg_temp.reject($q$select public.adjust_loyalty_points('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002',100,'IDOR')$q$,'otro negocio','Fidelización rechaza cliente ajeno');
insert into public.automation_rules(business_id,name,trigger_event,template) values('b0000000-0000-0000-0000-000000000001','Recordatorio','REMINDER_24H','Recordatorio de cita');
insert into public.whatsapp_messages(business_id,to_phone,body) values('b0000000-0000-0000-0000-000000000001','999000111','Recordatorio de cita');
select pg_temp.ok((select count(*)=1 from public.whatsapp_messages),'Starter puede encolar WhatsApp');
select pg_temp.ok((select count(*)=1 from public.automation_rules),'Starter puede configurar automatizaciones');
insert into public.ai_insights(business_id,type,title,body) values('b0000000-0000-0000-0000-000000000001','OPPORTUNITY','Datos reales','Datos de prueba local');
select pg_temp.ok((select count(*)=1 from public.ai_insights),'Starter persiste insights IA autorizados');
select pg_temp.reject($q$select public.system_ai_metrics('b0000000-0000-0000-0000-000000000002')$q$,'permission denied','Usuario no usa el endpoint del job de IA');

-- Envío a un tenant ajeno, incluso IDs existentes.
select pg_temp.reject($q$select public.get_plan_usage('b0000000-0000-0000-0000-000000000002')$q$,'Sin acceso','IDOR consumo');
select pg_temp.reject($q$select public.ai_tool_top_services('b0000000-0000-0000-0000-000000000002',now()-interval '1 day',now())$q$,'Sin permiso','IDOR tool IA');
select pg_temp.reject($q$select public.save_branch('b0000000-0000-0000-0000-000000000002',null,'{"name":"Ajena"}')$q$,'Sin permiso','IDOR sucursales');
select pg_temp.reject($q$update public.employees set business_id='b0000000-0000-0000-0000-000000000002' where id='e0000000-0000-0000-0000-000000000001'$q$,'business_id','business_id inmutable');
update public.subscriptions set plan_id='f0000000-0000-0000-0000-000000000003' where business_id='b0000000-0000-0000-0000-000000000001';
select pg_temp.ok((select plan_id='f0000000-0000-0000-0000-000000000001' from public.subscriptions where business_id='b0000000-0000-0000-0000-000000000001'),'RLS bloquea cambio de plan directo');
select pg_temp.reject($q$select public.admin_save_plan('f0000000-0000-0000-0000-000000000001','{}')$q$,'exclusivo','Usuario no modifica capacidades');
select pg_temp.reject($q$update public.users set platform_role='SUPER_ADMIN' where id=auth.uid()$q$,'Solo Super Admin','No escalamiento de rol');
-- Tamaño real simulado por Storage: sin cargar archivos ni ocupar MB en disco.
insert into storage.objects(bucket_id,name,metadata) values('brand-assets','b0000000-0000-0000-0000-000000000001/test.bin','{"size":524288000}');
select pg_temp.ok((public.get_plan_usage('b0000000-0000-0000-0000-000000000001')->'usage'->>'storageBytes')::bigint=524288000,'Almacenamiento 500 MB exactos');
select pg_temp.reject($q$insert into storage.objects(bucket_id,name,metadata) values('brand-assets','b0000000-0000-0000-0000-000000000001/extra.bin','{"size":1}')$q$,'almacenamiento','Almacenamiento bloquea exceso');
select pg_temp.reject($q$update storage.objects set metadata='{"size":524288001}' where name='b0000000-0000-0000-0000-000000000001/test.bin'$q$,'almacenamiento','Overwrite no evita cuota');
update storage.objects set metadata='{"size":523239424}' where name='b0000000-0000-0000-0000-000000000001/test.bin';
insert into storage.objects(bucket_id,name,metadata) values('brand-assets','b0000000-0000-0000-0000-000000000001/extra.bin','{"size":1048576}');
select pg_temp.ok((public.get_plan_usage('b0000000-0000-0000-0000-000000000001')->'usage'->>'storageBytes')::bigint=524288000,'Reducir tamaño libera espacio');
select pg_temp.reject($q$update storage.objects set name='b0000000-0000-0000-0000-000000000002/robado.bin' where name='b0000000-0000-0000-0000-000000000001/test.bin'$q$,'trasladan','Storage no cambia tenant');
select pg_temp.reject($q$insert into storage.objects(bucket_id,name,metadata) values('brand-assets','B0000000-0000-0000-0000-000000000001/bypass.bin','{"size":1}')$q$,'canónico','Ruta con UUID en mayúsculas no evita cuota');
-- Usuario trabajador conserva RBAC incluso con IA incluida en Starter.
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000004',true);
select pg_temp.reject($q$select public.ai_tool_loyalty_summary('b0000000-0000-0000-0000-000000000001')$q$,'Sin permiso','IA incluida no concede permiso al trabajador');
set local role anon;
select pg_temp.reject($q$select public.get_plan_usage('b0000000-0000-0000-0000-000000000001')$q$,'permission denied','Anónimo no lee consumo');
select pg_temp.reject($q$select beautyos_private.capabilities('b0000000-0000-0000-0000-000000000001')$q$,'permission denied','Helpers privados no son API');
select pg_temp.ok(jsonb_array_length(public.get_plan_catalog())=2,'Catálogo público solo dos planes');
-- Business: superar los antiguos topes sin grandes números artificiales en capacidades.
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000003',true);
insert into public.employees(business_id,full_name) select 'b0000000-0000-0000-0000-000000000002','Business '||i from generate_series(1,55) i;
select pg_temp.ok((select count(*)=55 from public.employees where business_id='b0000000-0000-0000-0000-000000000002'),'Business supera 5,12,50 trabajadores');
select public.save_branch('b0000000-0000-0000-0000-000000000002',null,'{"name":"Sucursal 2","active":true}') as branch2 \gset
select public.save_branch('b0000000-0000-0000-0000-000000000002',null,'{"name":"Sucursal 3","active":true}');
select pg_temp.ok((public.get_plan_usage('b0000000-0000-0000-0000-000000000002')->'usage'->>'branches')::int=3,'Business varias sucursales');
select pg_temp.ok(public.plan_module_enabled('b0000000-0000-0000-0000-000000000002','loyalty') and public.plan_module_enabled('b0000000-0000-0000-0000-000000000002','aiCopilot') and public.plan_module_enabled('b0000000-0000-0000-0000-000000000002','whatsapp'),'Business mismas capacidades principales');
insert into public.customers(id,business_id,full_name,phone,referral_code) values('c0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002','Cliente Business','999000222','LOCAL2');
insert into public.appointments(business_id,customer_id,scheduled_start,scheduled_end) select 'b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002',now(),now()+interval '1 hour' from generate_series(1,20001);
select pg_temp.ok((public.get_plan_usage('b0000000-0000-0000-0000-000000000002')->'usage'->>'appointments')::int=20001,'Business supera antiguo tope 20000 citas');
insert into public.products(id,business_id,location_id,name,sku,price,stock) values('f1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',:'branch2','Producto sucursal 2','SKU-1',20,10);
select public.create_branch_sale('b0000000-0000-0000-0000-000000000002',:'branch2','c0000000-0000-0000-0000-000000000002',null,0,'[{"kind":"PRODUCT","refId":"f1000000-0000-0000-0000-000000000001","qty":2,"discount":0}]','[{"method":"CASH","amount":40}]');
select pg_temp.ok((select stock=8 from public.products where id='f1000000-0000-0000-0000-000000000001'),'POS descuenta stock de sucursal');
select pg_temp.ok((select points=40 from public.loyalty_accounts where customer_id='c0000000-0000-0000-0000-000000000002'),'POS otorga fidelización');
select pg_temp.ok((public.get_branch_report('b0000000-0000-0000-0000-000000000002',:'branch2',now()-interval '1 day',now()+interval '1 day')->'branches'->0->>'revenue')::numeric=40,'Reporte por sucursal correcto');
select pg_temp.reject(format($q$select public.create_branch_sale('b0000000-0000-0000-0000-000000000002',%L,null,null,0,'[{"kind":"PRODUCT","refId":"f1000000-0000-0000-0000-000000000001","qty":20,"discount":0}]','[{"method":"CASH","amount":400}]')$q$,:'branch2'),'Stock insuficiente','POS no crea venta parcial sin stock');
select pg_temp.ok((select count(*)=1 from public.sales where business_id='b0000000-0000-0000-0000-000000000002'),'Rollback conserva solo venta confirmada');
select pg_temp.reject($q$insert into public.appointments(business_id,customer_id,scheduled_start,scheduled_end) values('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001',now(),now()+interval '1 hour')$q$,'otro negocio','FK de cliente no cruza tenants');
select pg_temp.reject($q$select public.get_branch_report_dates('b0000000-0000-0000-0000-000000000001',null,'2026-03-08','2026-03-08')$q$,'Sin permiso','IDOR reporte por fechas');
select pg_temp.reject($q$select public.get_branch_report_dates('b0000000-0000-0000-0000-000000000002',null,'2026-03-09','2026-03-08')$q$,'inválido','Reporte rechaza período invertido');
-- Incluso Super Admin debe revisar exceso al bajar de Business a Starter.
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select pg_temp.reject($q$update public.subscriptions set plan_id='f0000000-0000-0000-0000-000000000001' where business_id='b0000000-0000-0000-0000-000000000002'$q$,'supera el plan destino','Downgrade no elimina datos y rechaza exceso');
select pg_temp.ok((select count(*)=55 from public.employees where business_id='b0000000-0000-0000-0000-000000000002'),'Downgrade rechazado conserva empleados');
-- El día 8/3/2026 de Nueva York dura 23 horas, no un offset fijo -05.
update public.businesses set timezone='America/New_York' where id='b0000000-0000-0000-0000-000000000002';
update public.sales set created_at='2026-03-09T03:30:00Z' where business_id='b0000000-0000-0000-0000-000000000002';
select pg_temp.ok((public.get_branch_report_dates('b0000000-0000-0000-0000-000000000002',:'branch2','2026-03-08','2026-03-08')->'branches'->0->>'revenue')::numeric=40,'Reporte incluye última hora local con DST');
update public.sales set created_at='2026-03-09T04:30:00Z' where business_id='b0000000-0000-0000-0000-000000000002';
select pg_temp.ok((public.get_branch_report_dates('b0000000-0000-0000-0000-000000000002',:'branch2','2026-03-08','2026-03-08')->'branches'->0->>'revenue')::numeric=0,'Reporte excluye siguiente día con DST');
select public.admin_delete_business('b0000000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*)=0 from public.businesses where id='b0000000-0000-0000-0000-000000000002'),'Eliminación explícita de negocio conserva el CRUD y cascadas');
rollback;
\echo 'PASS: suite terminada; datos locales de prueba revertidos'
