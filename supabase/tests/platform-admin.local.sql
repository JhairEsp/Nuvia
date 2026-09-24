-- SOLO entorno local con .pgtest/stubs.sql. NUNCA ejecutar este test en Supabase real.
-- auth.users aquí es una TABLA SIMULADA, no GoTrue. No demuestra login de Auth real.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_ok(ok boolean, label text) returns void language plpgsql as $$ begin
  if not coalesce(ok,false) then raise exception 'FAIL: %',label; end if;
  raise notice 'PASS: %',label;
end $$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('a0000000-0000-0000-0000-000000000001','admin@local.invalid','{}'),
 ('a0000000-0000-0000-0000-000000000002','user@local.invalid','{}'),
 ('a0000000-0000-0000-0000-000000000003','other@local.invalid','{}');
update public.users set platform_role='SUPER_ADMIN' where id='a0000000-0000-0000-0000-000000000001';
insert into public.roles(code,name) values('BUSINESS_ADMIN','Administrador'),('BARBER','Barbero');
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.admin_save_plan(null,'{"code":"TEST","name":"Plan test","price_monthly":39.9,"limits":{"max_employees":5,"max_storage_mb":100},"modules":{"calendar":true},"is_active":true}') as plan_id \gset
select public.admin_save_business(null,jsonb_build_object('name','Negocio test','slug','negocio-test','type','BARBERSHOP','status','TRIAL','plan_id',:'plan_id','subscription_status','TRIALING')) as biz_id \gset
select pg_temp.assert_ok((select count(*)=10 from public.website_sections where business_id=:'biz_id'),'Crear negocio inicializa secciones');
select pg_temp.assert_ok((select count(*)=1 from public.business_settings where business_id=:'biz_id'),'Crear negocio inicializa configuración');
select public.admin_save_business(:'biz_id',jsonb_build_object('name','Negocio editado','slug','negocio-editado','type','SALON','status','ACTIVE','plan_id',:'plan_id','subscription_status','ACTIVE'));
select pg_temp.assert_ok((select name='Negocio editado' and type='SALON' from public.businesses where id=:'biz_id'),'Editar negocio persiste');
select pg_temp.assert_ok((select count(*)=1 from public.subscriptions where business_id=:'biz_id' and status='ACTIVE'),'Editar suscripción no duplica');
select public.admin_save_plan(:'plan_id','{"code":"EDIT","name":"Plan editado","price_monthly":50,"limits":{"max_employees":10,"max_storage_mb":100},"modules":{"calendar":true,"sales":false},"is_active":false}');
select pg_temp.assert_ok((select price_monthly=50 and not is_active and (limits->>'max_storage_mb')::int=100 from public.plans where id=:'plan_id'),'Editar plan conserva límites adicionales');
do $$ declare b uuid; p uuid; begin
  select id into b from public.businesses where slug='negocio-editado';
  select id into p from public.plans where code='EDIT';
  begin
    perform public.admin_save_business(b,jsonb_build_object('name','No debe quedar','slug','negocio-editado','type','SALON','status','ACTIVE','plan_id',p,'subscription_status','BAD'));
    raise exception 'FAIL: estado inválido aceptado';
  exception when invalid_text_representation then raise notice 'PASS: transacción inválida rechazada'; end;
  perform pg_temp.assert_ok((select name='Negocio editado' from public.businesses where id=b),'Rollback de negocio ante suscripción inválida');
  begin
    perform public.admin_delete_plan(p);
    raise exception 'FAIL: plan referenciado eliminado';
  exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; raise notice 'PASS: plan con suscripciones protegido'; end;
end $$;
select public.admin_save_user_profile('a0000000-0000-0000-0000-000000000002',jsonb_build_object('full_name','Usuario real','platform_role','USER','memberships',jsonb_build_array(jsonb_build_object('business_id',:'biz_id','role_code','BUSINESS_ADMIN','status','ACTIVE','employee_id',null))));
select pg_temp.assert_ok((select count(*)=1 from public.business_users where user_id='a0000000-0000-0000-0000-000000000002'),'Guardar perfil y membresía');
do $$ begin
  begin
    perform public.admin_save_user_profile('a0000000-0000-0000-0000-000000000002','{"full_name":"No persistir","platform_role":"USER","memberships":[{"business_id":"b0000000-0000-0000-0000-000000000099","role_code":"BARBER","status":"ACTIVE"}]}');
    raise exception 'FAIL: negocio inválido aceptado';
  exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;
  perform pg_temp.assert_ok((select full_name='Usuario real' from public.users where id='a0000000-0000-0000-0000-000000000002'),'Membresía inválida no modifica perfil');
  begin
    perform public.admin_save_user_profile('a0000000-0000-0000-0000-000000000001','{"full_name":"Admin","platform_role":"USER","memberships":[]}');
    raise exception 'FAIL: autodegradación permitida';
  exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; raise notice 'PASS: autodegradación bloqueada'; end;
end $$;
-- Usuario normal: ni RPC ni autoescalamiento vía tabla.
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
do $$ begin
  begin perform public.admin_require_super(); raise exception 'FAIL: usuario normal autorizado';
  exception when insufficient_privilege then raise notice 'PASS: RPC rechaza usuario normal'; end;
  begin update public.users set platform_role='SUPER_ADMIN' where id=auth.uid(); raise exception 'FAIL: autoescalamiento permitido';
  exception when insufficient_privilege then raise notice 'PASS: autoescalamiento bloqueado'; end;
end $$;
set local role anon;
do $$ begin
  begin perform public.admin_require_super(); raise exception 'FAIL: anon autorizado';
  exception when insufficient_privilege then raise notice 'PASS: anónimo bloqueado'; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','',true);
-- Referencia de autor que debe sobrevivir al borrado de cuenta.
insert into public.customers(business_id,full_name,phone,referral_code) values(:'biz_id','Cliente','999111222','LOCALTEST') returning id as customer_id \gset
insert into public.customer_notes(business_id,customer_id,created_by,note) values(:'biz_id',:'customer_id','a0000000-0000-0000-0000-000000000002','Conservar');
create role supabase_auth_admin;
grant usage on schema auth, public to supabase_auth_admin;
grant select,delete on auth.users to supabase_auth_admin;
set session authorization supabase_auth_admin;
delete from auth.users where id='a0000000-0000-0000-0000-000000000002';
do $$ begin
  begin delete from auth.users where id='a0000000-0000-0000-0000-000000000001'; raise exception 'FAIL: último super eliminado';
  exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; raise notice 'PASS: último Super Admin protegido en cascada Auth'; end;
end $$;
reset session authorization;
select pg_temp.assert_ok((select count(*)=0 from public.business_users where user_id='a0000000-0000-0000-0000-000000000002'),'Eliminar Auth limpia membresías BUSINESS_ADMIN');
select pg_temp.assert_ok((select created_by is null from public.customer_notes where note='Conservar'),'Eliminar usuario conserva notas con autor desvinculado');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select public.admin_delete_business(:'biz_id');
select pg_temp.assert_ok((select count(*)=0 from public.businesses where id=:'biz_id'),'Eliminar negocio real');
select pg_temp.assert_ok((select count(*)=0 from public.website_sections where business_id=:'biz_id'),'Eliminar negocio limpia dependencias');
select pg_temp.assert_ok((select count(*)>0 from public.audit_logs where entity_table='businesses' and entity_id=:'biz_id' and action='DELETE'),'Eliminar negocio conserva auditoría');
select public.admin_delete_plan(:'plan_id');
select pg_temp.assert_ok((select count(*)=0 from public.plans where id=:'plan_id'),'Eliminar plan sin referencias');
rollback;
\echo 'Todos los tests locales pasaron. Sin cambios persistentes.'
