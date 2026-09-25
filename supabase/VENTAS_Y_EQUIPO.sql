-- Nuvia · migración 05 no destructiva. Requiere 01–04. Aplicar UNA VEZ.
begin;
select pg_advisory_xact_lock(2409202605);
do $$ begin
 if to_regprocedure('public.get_website_editor(uuid)') is null then raise exception 'Primero instala EDITOR_WEB.sql (04)'; end if;
end $$;

create table public.business_payment_qrs (
 business_id uuid not null references public.businesses(id) on delete cascade,
 method public.payment_method not null check (method in ('YAPE','PLIN')),
 storage_path text not null,
 holder text not null default '' check(length(holder)<=120),
 updated_at timestamptz not null default now(),
 primary key(business_id,method)
);
alter table public.business_payment_qrs enable row level security;
-- Solo RPCs; no DML directo ni lectura pública del registro de configuración.
revoke all on public.business_payment_qrs from anon,authenticated;

create function public.get_payment_qrs(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if public.is_super_admin() or public.has_permission(p_business_id,'settings.manage') then
  perform public.require_plan_capability(p_business_id,null,'settings.manage');
 else perform public.require_plan_capability(p_business_id,null,'sales.manage'); end if;
 return coalesce((select jsonb_agg(jsonb_build_object('method',method,'storage_path',storage_path,'holder',holder,'updated_at',updated_at) order by method) from public.business_payment_qrs where business_id=p_business_id),'[]'::jsonb);
end $$;

create function public.save_payment_qr(p_business_id uuid,p_method text,p_storage_path text,p_holder text default '') returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 perform public.require_plan_capability(p_business_id,null,'settings.manage');
 if p_method is null or p_method not in ('YAPE','PLIN') then raise exception 'Método inválido'; end if;
 if length(coalesce(p_holder,''))>120 then raise exception 'Titular demasiado largo'; end if;
 if p_storage_path is null or p_storage_path !~ ('^'||p_business_id::text||'/payments/'||lower(p_method)||'/[0-9a-f-]{36}[.](png|jpg|webp)$') then raise exception 'El QR debe ser una imagen subida para este negocio y método'; end if;
 if not exists(select 1 from storage.objects where bucket_id='brand-assets' and name=p_storage_path) then raise exception 'No se encontró la imagen subida'; end if;
 insert into public.business_payment_qrs(business_id,method,storage_path,holder) values(p_business_id,p_method::public.payment_method,p_storage_path,trim(coalesce(p_holder,'')))
 on conflict(business_id,method) do update set storage_path=excluded.storage_path,holder=excluded.holder,updated_at=clock_timestamp();
 return jsonb_build_object('method',p_method,'storage_path',p_storage_path,'holder',trim(coalesce(p_holder,'')));
end $$;
create function public.remove_payment_qr(p_business_id uuid,p_method text) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform public.require_plan_capability(p_business_id,null,'settings.manage');
 if p_method is null or p_method not in ('YAPE','PLIN') then raise exception 'Método inválido'; end if;
 delete from public.business_payment_qrs where business_id=p_business_id and method=p_method::public.payment_method;
end $$;
revoke all on function public.get_payment_qrs(uuid),public.save_payment_qr(uuid,text,text,text),public.remove_payment_qr(uuid,text) from public,anon;
grant execute on function public.get_payment_qrs(uuid),public.save_payment_qr(uuid,text,text,text),public.remove_payment_qr(uuid,text) to authenticated;

-- Refuerza las políticas existentes; no abre los demás prefijos/buckets.
create function public.can_write_business_media(p_bucket text,p_name text) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare permission text;
begin
 if p_bucket='brand-assets' and split_part(p_name,'/',2)='payments' then permission:='settings.manage';
 elsif p_bucket='website-media' and split_part(p_name,'/',2)='team' then permission:='team.manage';
 else return true; end if;
 if split_part(p_name,'/',1) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
 return public.is_super_admin() or public.has_permission(split_part(p_name,'/',1)::uuid,permission);
end $$;
revoke all on function public.can_write_business_media(text,text) from public,anon;
grant execute on function public.can_write_business_media(text,text) to authenticated;
-- Autoriza ajustes/equipo sin exigir además website.manage; los restrictivos evitan bypass.
create policy business_media_scoped_insert on storage.objects for insert to authenticated with check(((bucket_id='brand-assets' and split_part(name,'/',2)='payments') or (bucket_id='website-media' and split_part(name,'/',2)='team')) and public.can_write_business_media(bucket_id,name));
create policy business_media_scoped_update on storage.objects for update to authenticated using(((bucket_id='brand-assets' and split_part(name,'/',2)='payments') or (bucket_id='website-media' and split_part(name,'/',2)='team')) and public.can_write_business_media(bucket_id,name)) with check(((bucket_id='brand-assets' and split_part(name,'/',2)='payments') or (bucket_id='website-media' and split_part(name,'/',2)='team')) and public.can_write_business_media(bucket_id,name));
create policy business_media_insert on storage.objects as restrictive for insert to authenticated with check(public.can_write_business_media(bucket_id,name));
create policy business_media_update on storage.objects as restrictive for update to authenticated using(public.can_write_business_media(bucket_id,name)) with check(public.can_write_business_media(bucket_id,name));
create policy business_media_delete on storage.objects as restrictive for delete to authenticated using(public.can_write_business_media(bucket_id,name));

create or replace function public.save_team_member(p_business_id uuid,p_id uuid,p_data jsonb,p_services uuid[]) returns uuid language plpgsql security definer set search_path=public as $$
declare eid uuid; loc uuid:=nullif(p_data->>'location_id','')::uuid;
begin
 perform public.require_plan_capability(p_business_id,null,'team.manage');
 if p_data ? 'photo_url' and coalesce(p_data->>'photo_url','')<>'' and (length(p_data->>'photo_url')>2048 or (p_data->>'photo_url') !~ '^https?://') then raise exception 'Foto inválida: usa una imagen HTTP(S)'; end if;
 if length(trim(coalesce(p_data->>'full_name','')))=0 then raise exception 'Nombre requerido'; end if;
 if p_id is not null and exists(select 1 from public.employees where id=p_id) then
  update public.employees set photo_url=case when p_data ? 'photo_url' then nullif(p_data->>'photo_url','') else photo_url end,full_name=trim(p_data->>'full_name'),role_label=p_data->>'role_label',specialty=p_data->>'specialty',bio=p_data->>'bio',commission_rate=(p_data->>'commission_rate')::numeric,show_on_website=(p_data->>'show_on_website')::boolean,active=(p_data->>'active')::boolean
  where id=p_id and business_id=p_business_id returning id into eid;
  if eid is null then raise exception 'Trabajador de otro negocio' using errcode='42501'; end if;
 else
  insert into public.employees(id,business_id,location_id,full_name,role_label,specialty,bio,commission_rate,show_on_website,active,photo_url)
  values(coalesce(p_id,gen_random_uuid()),p_business_id,loc,trim(p_data->>'full_name'),p_data->>'role_label',p_data->>'specialty',p_data->>'bio',(p_data->>'commission_rate')::numeric,(p_data->>'show_on_website')::boolean,(p_data->>'active')::boolean,nullif(p_data->>'photo_url','')) returning id into eid;
 end if;
 delete from public.employee_services where employee_id=eid;
 insert into public.employee_services(business_id,employee_id,service_id) select p_business_id,eid,x from unnest(p_services) x;
 return eid;
end $$;

notify pgrst,'reload schema';
commit;
