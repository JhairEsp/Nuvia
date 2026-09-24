-- SOLO LECTURA. Ejecutar antes de PLANES_Y_SUCURSALES.sql. No compartir datos personales.
select code,id,name,price_monthly,limits,modules,is_active from public.plans order by code;
select table_name,column_name,data_type,is_nullable from information_schema.columns
where table_schema='public' and table_name in ('plans','subscriptions','locations','employees','appointments','services','products','sales') order by table_name,ordinal_position;
select p.code,s.status,count(*) from public.subscriptions s join public.plans p on p.id=s.plan_id group by p.code,s.status order by p.code,s.status;
select b.id,b.name,p.code,
 (select count(*) from public.employees e where e.business_id=b.id) workers,
 (select count(*) from public.locations l where l.business_id=b.id) branches,
 (select count(*) from public.appointments a where a.business_id=b.id and a.status<>'CANCELLED'
  and date_trunc('month',a.scheduled_start at time zone b.timezone)=date_trunc('month',now() at time zone b.timezone)) appointments_this_month,
 (select coalesce(sum(coalesce((o.metadata->>'size')::bigint,0)),0) from storage.objects o
  where bucket_id in ('brand-assets','website-media','client-photos') and lower(split_part(o.name,'/',1))=b.id::text) storage_bytes
from public.businesses b left join lateral(select plan_id from public.subscriptions where business_id=b.id order by created_at desc,id desc limit 1) s on true
left join public.plans p on p.id=s.plan_id;
select schemaname,tablename,policyname,cmd,qual,with_check from pg_policies where schemaname in ('public','storage') and tablename in ('plans','subscriptions','locations','employees','appointments','objects');
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef security_definer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and (p.proname like '%plan%' or p.proname like '%booking%' or p.proname like 'ai_tool_%');

-- Meses actuales/futuros con exceso potencial de Starter, antes de instalar was_completed.
-- La migración reconstruye además evidencia de citas completadas desde auditoría.
select b.id business_id,b.name,date_trunc('month',a.scheduled_start at time zone b.timezone)::date as period_month,count(*) appointments
from public.businesses b
join lateral(select plan_id from public.subscriptions where business_id=b.id order by created_at desc,id desc limit 1) sub on true
join public.plans p on p.id=sub.plan_id and p.code='STARTER'
join public.appointments a on a.business_id=b.id and a.status<>'CANCELLED'
where a.scheduled_start >= date_trunc('month',now() at time zone b.timezone) at time zone b.timezone
group by b.id,b.name,date_trunc('month',a.scheduled_start at time zone b.timezone)::date having count(*)>300;
select to_regclass('public.subscription_plan_history') as migration_03_history_table,
 to_regprocedure('public.get_plan_usage(uuid)') as migration_03_usage_rpc;
