-- SOLO PostgreSQL LOCAL: .pgtest/rebuild-plans.sh + migraciones 04 y 05. Rollback final.
\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(b boolean,label text) returns void language plpgsql as $$ begin
 if not coalesce(b,false) then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label;
end $$;
create function pg_temp.reject(q text,label text) returns void language plpgsql as $$ begin
 begin execute q; exception when others then raise notice 'PASS: % (%)',label,sqlerrm; return; end;
 raise exception 'FAIL: % no bloqueado',label;
end $$;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select id as loc from public.locations where business_id='b0000000-0000-0000-0000-000000000001' and is_default \gset
select ((now() at time zone 'America/Lima')::date+2) as day \gset
insert into public.services(id,business_id,name,price,duration_min) values('f2000000-0000-0000-0000-000000000099','b0000000-0000-0000-0000-000000000001','Corte disponibilidad',15,30);
select public.save_team_member('b0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000099',jsonb_build_object('location_id',:'loc','full_name','Profesional local','role_label','Barbero','specialty','','bio','','commission_rate',10,'show_on_website',true,'active',true),array['f2000000-0000-0000-0000-000000000099'::uuid]);
select jsonb_agg(jsonb_build_object('weekday',i,'open_time','09:00','close_time','11:00','is_closed',false)) as hours from generate_series(0,6) i \gset
select pg_temp.ok((select count(*)=0 from public.appointments where business_id='b0000000-0000-0000-0000-000000000001'),'Día de prueba sin reservas');
set local role anon;
select pg_temp.ok(public.get_public_availability('local-starter',:'day',array['f2000000-0000-0000-0000-000000000099'::uuid],null,:'loc')='[]','Sin horario guardado devuelve vacío aunque no haya citas');
set local role authenticated;
select public.save_branch('b0000000-0000-0000-0000-000000000001',:'loc',jsonb_build_object('name','Principal','active',true,'hours',:'hours'::jsonb));
select pg_temp.ok((select count(*)=7 from public.business_hours where location_id=:'loc'),'Guardar horarios persiste los siete días en la sucursal');
insert into public.business_settings(business_id,slot_minutes,min_lead_minutes,cancel_window_hours,rebooking_days)
 values('b0000000-0000-0000-0000-000000000001',30,0,12,28) on conflict(business_id) do update set min_lead_minutes=excluded.min_lead_minutes;
select pg_temp.ok((select min_lead_minutes=0 from public.business_settings where business_id='b0000000-0000-0000-0000-000000000001'),'Reglas se guardan mediante tabla RLS usada por la UI');
set local role anon;
select pg_temp.ok(jsonb_array_length(public.get_public_availability('local-starter',:'day',array['f2000000-0000-0000-0000-000000000099'::uuid],null,:'loc'))=4,'Día vacío configurado ofrece cuatro horas reales sin republicar');
select public.create_booking('local-starter',array['f2000000-0000-0000-0000-000000000099'::uuid],null,(:'day'::date+time '09:00') at time zone 'America/Lima','Cliente de prueba local','999111222','Prueba local',:'loc')->>'appointment_id' as ap \gset
select pg_temp.ok(jsonb_array_length(public.get_public_availability('local-starter',:'day',array['f2000000-0000-0000-0000-000000000099'::uuid],null,:'loc'))=3,'Reserva ocupa solo su intervalo, conserva las demás horas');
select pg_temp.reject(format($q$select public.create_booking('local-starter',array['f2000000-0000-0000-0000-000000000099'::uuid],null,%L,'Otro cliente','999111333','',%L)$q$,(:'day'::date+time '09:00') at time zone 'America/Lima',:'loc'),'No permite reservar dos veces la misma hora');
set local role authenticated;
select pg_temp.ok((select status='PENDING' and source='LANDING' and price_total=15 from public.appointments where id=:'ap'),'Reserva persistida pendiente con precio real');
select pg_temp.ok((select count(*)=1 from public.appointment_items where appointment_id=:'ap'),'Items persistidos en la misma transacción');
update public.appointments set status='CANCELLED' where id=:'ap';
select pg_temp.ok(jsonb_array_length(public.get_public_availability('local-starter',:'day',array['f2000000-0000-0000-0000-000000000099'::uuid],null,:'loc'))=4,'Cancelar no atendida libera horario');
update public.business_settings set min_lead_minutes=14400 where business_id='b0000000-0000-0000-0000-000000000001';
select pg_temp.ok(public.get_public_availability('local-starter',:'day',array['f2000000-0000-0000-0000-000000000099'::uuid],null,:'loc')='[]','Anticipación real puede ocultar un día sin citas');
update public.business_settings set min_lead_minutes=0 where business_id='b0000000-0000-0000-0000-000000000001';
select pg_temp.ok(jsonb_array_length(public.get_public_availability('local-starter',:'day',array['f2000000-0000-0000-0000-000000000099'::uuid],null,:'loc'))=4,'Corregir anticipación recupera horas inmediatamente');
insert into public.business_hours(business_id,weekday,open_time,close_time,is_closed) select 'b0000000-0000-0000-0000-000000000001',i,'08:00','20:00',false from generate_series(0,6) i;
select pg_temp.ok(jsonb_array_length(public.get_public_availability('local-starter',:'day',array['f2000000-0000-0000-0000-000000000099'::uuid],null,:'loc'))=4,'Horario de sucursal prevalece sobre general');
update public.business_hours set is_closed=true where location_id=:'loc';
select pg_temp.ok(public.get_public_availability('local-starter',:'day',array['f2000000-0000-0000-0000-000000000099'::uuid],null,:'loc')='[]','Cierre explícito no se sustituye por horario general abierto');
select public.save_branch('b0000000-0000-0000-0000-000000000001',:'loc',jsonb_build_object('name','Principal','active',true,'hours',:'hours'::jsonb));
select pg_temp.reject(format($q$select public.save_branch('b0000000-0000-0000-0000-000000000001',%L,jsonb_build_object('name','Principal','active',true,'hours',jsonb_set(%L::jsonb,'{0,close_time}','"08:00"')))$q$,:'loc',:'hours'),'Servidor rechaza cierre anterior a apertura');
select pg_temp.ok(jsonb_array_length(public.get_public_availability('local-starter',:'day',array['f2000000-0000-0000-0000-000000000099'::uuid],null,:'loc'))=4,'Guardado fallido revierte borrado y conserva horario anterior');
delete from public.employee_services where employee_id='e0000000-0000-0000-0000-000000000099';
select pg_temp.ok(public.get_public_availability('local-starter',:'day',array['f2000000-0000-0000-0000-000000000099'::uuid],null,:'loc')='[]','Sin asignación no inventa un profesional para el servicio');
insert into public.employee_services(business_id,employee_id,service_id) values('b0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000099','f2000000-0000-0000-0000-000000000099');
select pg_temp.ok(jsonb_array_length(public.get_public_availability('local-starter',:'day',array['f2000000-0000-0000-0000-000000000099'::uuid],null,:'loc'))=4,'Asignar servicio al profesional recupera disponibilidad');
insert into public.employee_schedules(employee_id,business_id,weekday,start_time,end_time) values('e0000000-0000-0000-0000-000000000099','b0000000-0000-0000-0000-000000000001',extract(dow from :'day'::date),'10:00','11:00');
select pg_temp.ok(jsonb_array_length(public.get_public_availability('local-starter',:'day',array['f2000000-0000-0000-0000-000000000099'::uuid],null,:'loc'))=2,'Turno del profesional reduce a sus horas de trabajo');
insert into public.time_off(business_id,employee_id,starts_at,ends_at) values('b0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000099',(:'day'::date+time '10:00') at time zone 'America/Lima',(:'day'::date+time '11:00') at time zone 'America/Lima');
select pg_temp.ok(public.get_public_availability('local-starter',:'day',array['f2000000-0000-0000-0000-000000000099'::uuid],null,:'loc')='[]','Ausencia bloquea aunque no haya reservas activas');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000003',true);
select pg_temp.ok((select count(*)=0 from public.business_settings where business_id='b0000000-0000-0000-0000-000000000001'),'Otro negocio no puede leer reglas por ID');
select pg_temp.reject($q$insert into public.business_settings(business_id,slot_minutes) values('b0000000-0000-0000-0000-000000000001',5) on conflict(business_id) do update set slot_minutes=excluded.slot_minutes$q$,'RLS bloquea escribir reglas de otro tenant');
select pg_temp.reject(format($q$select public.save_branch('b0000000-0000-0000-0000-000000000001',%L,jsonb_build_object('name','Intruso','active',true,'hours',%L::jsonb))$q$,:'loc',:'hours'),'RPC impide cambiar horarios de otro tenant');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000004',true);
select pg_temp.reject($q$insert into public.business_settings(business_id,slot_minutes) values('b0000000-0000-0000-0000-000000000001',5) on conflict(business_id) do update set slot_minutes=excluded.slot_minutes$q$,'Trabajador sin settings.manage no puede modificar reglas');
select pg_temp.reject(format($q$select public.save_branch('b0000000-0000-0000-0000-000000000001',%L,jsonb_build_object('name','Sin permiso','active',true,'hours',%L::jsonb))$q$,:'loc',:'hours'),'Trabajador sin permiso no modifica horarios por RPC');
rollback;
