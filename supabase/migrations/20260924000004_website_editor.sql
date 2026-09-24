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
