-- SOLO PostgreSQL local con stubs Auth/Storage. Requiere migraciones 01-04 y fixtures locales.
\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(b boolean,label text) returns void language plpgsql as $$ begin if not coalesce(b,false) then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end $$;
create function pg_temp.reject(q text,fragment text,label text) returns void language plpgsql as $$ begin begin execute q;exception when others then if position(fragment in sqlerrm)=0 then raise exception 'FAIL: % error inesperado %',label,sqlerrm;end if;raise notice 'PASS: %',label;return;end;raise exception 'FAIL: % no se rechazó',label;end $$;
create function pg_temp.draft() returns jsonb language sql as $$ select jsonb_build_object(
 'business',jsonb_build_object('name','Nombre público','slug','slug-inyectado','description','Nuestra historia','phone','999123456','whatsapp','51999123456','email','local@example.invalid','address','Dirección real'),
 'branding','{"preset":"ELEGANT","font_key":"serif","colors":{"primary":"#813c30","button":"#813c30"},"cover_url":"https://unit.invalid/portada.webp","logo_url":""}'::jsonb,
 'website','{"template_key":"EDITORIAL","tagline":"Frase","map_query":"Lima","socials":{"instagram":"https://instagram.com/local"}}'::jsonb,
 'services','[{"name":"Servicio inyectado","price":0}]'::jsonb,
 'sections',(select jsonb_agg(jsonb_build_object('type',type,'position',ord-1,'active',true,'content',jsonb_build_object('title','Título '||type,'body','Texto real'))) from unnest(array['HERO','SERVICES','ABOUT','GALLERY','TEAM','PROMOTIONS','TESTIMONIALS','LOCATION','CTA','FOOTER']) with ordinality x(type,ord))
 ) $$;
-- Conviven horario legado y horario de sucursal: mostrar solo el de la principal.
delete from public.business_hours where business_id='b0000000-0000-0000-0000-000000000001' and weekday=1;
insert into public.business_hours(business_id,location_id,weekday,open_time,close_time) values ('b0000000-0000-0000-0000-000000000001',null,1,'09:00','20:00');
insert into public.business_hours(business_id,location_id,weekday,open_time,close_time) select business_id,id,1,'12:00','20:00' from public.locations where business_id='b0000000-0000-0000-0000-000000000001' and is_default;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select pg_temp.ok((public.get_website_editor('b0000000-0000-0000-0000-000000000001')->>'revision')::int=0,'Editor inicial sin filas devuelve revisión cero');
select pg_temp.ok((select count(*)=1 and min(h->>'open_time')='12:00:00' from jsonb_array_elements(public.get_website_editor('b0000000-0000-0000-0000-000000000001')->'draft'->'hours') h where h->>'weekday'='1'),'Horario principal prevalece sin duplicar días heredados');
select public.save_website_draft('b0000000-0000-0000-0000-000000000001',pg_temp.draft(),0);
select pg_temp.ok((select count(*)=10 from public.website_sections where business_id='b0000000-0000-0000-0000-000000000001'),'Guardar crea las diez secciones faltantes');
select pg_temp.ok((select name='Local Starter' and slug='local-starter' from public.businesses where id='b0000000-0000-0000-0000-000000000001'),'Nombre público no altera negocio ni slug operativo');
select pg_temp.ok((select count(*)=0 from public.website_releases),'Guardar borrador no publica');
select pg_temp.ok((public.get_website_editor('b0000000-0000-0000-0000-000000000001')->'draft'->'branding'->>'cover_url')='https://unit.invalid/portada.webp','Portada persistida en borrador');
select pg_temp.ok((public.get_website_editor('b0000000-0000-0000-0000-000000000001')->'draft'->'business'->>'name')='Nombre público','Editor conserva datos públicos personalizados');
select pg_temp.reject($q$select public.save_website_draft('b0000000-0000-0000-0000-000000000001',pg_temp.draft(),0)$q$,'otra sesión','Revisión antigua no sobrescribe');
select pg_temp.reject($q$select public.save_website_draft('b0000000-0000-0000-0000-000000000001',jsonb_set(pg_temp.draft(),'{website,template_key}','"CUARTA"'),1)$q$,'tres plantillas','Solo tres plantillas válidas');
select pg_temp.reject($q$select public.save_website_draft('b0000000-0000-0000-0000-000000000001',jsonb_set(pg_temp.draft(),'{website,socials,instagram}','"javascript:alert(1)"'),1)$q$,'http o https','Redes rechazan esquemas peligrosos');
select pg_temp.reject($q$select public.save_website_draft('b0000000-0000-0000-0000-000000000001',jsonb_set(pg_temp.draft(),'{branding,colors,primary}','"red;url(foo)"'),1)$q$,'hexadecimal','Colores rechazan contenido CSS arbitrario');
select pg_temp.reject($q$select public.save_website_draft('b0000000-0000-0000-0000-000000000001',jsonb_set(pg_temp.draft(),'{sections}','[]'),1)$q$,'diez secciones','Borrador incompleto se rechaza');
select pg_temp.ok((public.get_website_editor('b0000000-0000-0000-0000-000000000001')->>'revision')::int=1,'Validaciones fallidas no cambian revisión');
select pg_temp.reject($q$select public.publish_website_draft('b0000000-0000-0000-0000-000000000001',jsonb_set(pg_temp.draft(),'{sections,0,active}','false'),1)$q$,'Activa la portada','Publicación inválida revierte guardado');
select pg_temp.ok((public.get_website_editor('b0000000-0000-0000-0000-000000000001')->>'revision')::int=1,'Publicación fallida conserva versión del borrador');
select public.publish_website_draft('b0000000-0000-0000-0000-000000000001',pg_temp.draft(),1) as result \gset
select pg_temp.ok(:'result'::jsonb->>'slug'='local-starter' and :'result'::jsonb->>'release_id' is not null,'Publicar devuelve slug real e ID confirmado');
select pg_temp.ok((select count(*)=1 from public.website_releases),'Publicar crea solo un release');
select pg_temp.ok((public.get_website_editor('b0000000-0000-0000-0000-000000000001')->>'published_revision')::int=2,'Revisión publicada identificable');
select pg_temp.ok(jsonb_array_length(public.get_public_site('local-starter')->'services')=0,'Snapshot no acepta servicios inyectados por cliente');
select public.save_website_draft('b0000000-0000-0000-0000-000000000001',jsonb_set(pg_temp.draft(),'{sections,0,content,title}','"Solo borrador"'),2);
set local role anon;
select pg_temp.ok(public.get_public_site('local-starter')->'sections'->0->'content'->>'title'='Título HERO','Público no ve cambios sin publicar');
select pg_temp.reject($q$select public.get_website_editor('b0000000-0000-0000-0000-000000000001')$q$,'permission denied','Anónimo no lee borrador');
set local role authenticated;
select pg_temp.reject($q$select public.get_website_editor('b0000000-0000-0000-0000-000000000002')$q$,'Sin permiso','IDOR lectura borrador');
select pg_temp.reject($q$select public.publish_website_draft('b0000000-0000-0000-0000-000000000002',pg_temp.draft(),0)$q$,'Sin permiso','IDOR publicación');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000004',true);
select pg_temp.reject($q$select public.save_website_draft('b0000000-0000-0000-0000-000000000001',pg_temp.draft(),3)$q$,'Sin permiso','Trabajador sin website.manage no guarda');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000003',true);
select public.publish_website_draft('b0000000-0000-0000-0000-000000000002',jsonb_set(pg_temp.draft(),'{website,template_key}','"STUDIO"'),0);
select pg_temp.ok(public.get_public_site('local-business')->'website'->>'template_key'='STUDIO','Business publica plantilla Studio');
select public.publish_website_draft('b0000000-0000-0000-0000-000000000002',jsonb_set(pg_temp.draft(),'{website,template_key}','"SERENE"'),1);
select pg_temp.ok(public.get_public_site('local-business')->'website'->>'template_key'='SERENE','Business cambia a Serene sin borrar historial');
select pg_temp.ok((select count(*)=2 from public.website_releases where business_id='b0000000-0000-0000-0000-000000000002'),'Conserva historial de publicaciones');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
update public.plans set modules=jsonb_set(modules,'{website}','false') where code='STARTER';
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select pg_temp.reject($q$select public.save_website_draft('b0000000-0000-0000-0000-000000000001',pg_temp.draft(),3)$q$,'capacidad','Capacidad deshabilitada bloquea guardado directo');
select pg_temp.reject($q$select beautyos_private.website_snapshot('b0000000-0000-0000-0000-000000000002')$q$,'permission denied','Snapshot privado no es API pública');
rollback;
