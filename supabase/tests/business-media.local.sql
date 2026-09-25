-- SOLO PG local con stubs y fixtures plans-before. No ejecutar en producción.
\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(b boolean,label text) returns void language plpgsql as $$ begin if not coalesce(b,false) then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end $$;
create function pg_temp.reject(q text,fragment text,label text) returns void language plpgsql as $$ begin begin execute q;exception when others then if position(fragment in sqlerrm)=0 then raise exception 'FAIL: % error inesperado %',label,sqlerrm;end if;raise notice 'PASS: %',label;return;end;raise exception 'FAIL: % no se rechazó',label;end $$;
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select id as loc from public.locations where business_id='b0000000-0000-0000-0000-000000000001' and is_default \gset
select pg_temp.ok(public.get_payment_qrs('b0000000-0000-0000-0000-000000000001')='[]'::jsonb,'QR inicial vacío, sin datos demo');
insert into storage.objects(bucket_id,name,metadata) values('brand-assets','b0000000-0000-0000-0000-000000000001/payments/yape/00000000-0000-0000-0000-000000000001.png','{"size":1000}');
select public.save_payment_qr('b0000000-0000-0000-0000-000000000001','YAPE','b0000000-0000-0000-0000-000000000001/payments/yape/00000000-0000-0000-0000-000000000001.png','Titular real');
select pg_temp.ok(public.get_payment_qrs('b0000000-0000-0000-0000-000000000001')->0->>'holder'='Titular real','Admin guarda y recupera QR propio');
select pg_temp.reject($q$select public.save_payment_qr('b0000000-0000-0000-0000-000000000001','PLIN','b0000000-0000-0000-0000-000000000001/payments/plin/00000000-0000-0000-0000-000000000001.png','')$q$,'No se encontró','No acepta archivo inexistente');
select pg_temp.reject($q$select public.save_payment_qr('b0000000-0000-0000-0000-000000000001','YAPE','b0000000-0000-0000-0000-000000000002/payments/yape/00000000-0000-0000-0000-000000000001.png','')$q$,'este negocio','No acepta ruta ajena');
select pg_temp.reject($q$select public.get_payment_qrs('b0000000-0000-0000-0000-000000000002')$q$,'Sin permiso','QR lectura IDOR');
select pg_temp.reject($q$select public.remove_payment_qr('b0000000-0000-0000-0000-000000000002','YAPE')$q$,'Sin permiso','QR eliminación IDOR');
select pg_temp.reject($q$insert into public.business_payment_qrs(business_id,method,storage_path) values('b0000000-0000-0000-0000-000000000001','PLIN','cualquier')$q$,'permission denied','Sin escritura directa de QR');
select public.save_team_member('b0000000-0000-0000-0000-000000000001','e9000000-0000-0000-0000-000000000001',jsonb_build_object('location_id',:'loc','full_name','Foto persona','role_label','Stylist','specialty','','bio','','commission_rate',10,'show_on_website',true,'active',true,'photo_url','https://unit.invalid/equipo.png'),'{}');
select pg_temp.ok((select photo_url='https://unit.invalid/equipo.png' from public.employees where id='e9000000-0000-0000-0000-000000000001'),'RPC guarda foto trabajador');
select public.save_team_member('b0000000-0000-0000-0000-000000000001','e9000000-0000-0000-0000-000000000001',jsonb_build_object('location_id',:'loc','full_name','Cliente anterior','role_label','Stylist','specialty','','bio','','commission_rate',10,'show_on_website',true,'active',true),'{}');
select pg_temp.ok((select photo_url='https://unit.invalid/equipo.png' from public.employees where id='e9000000-0000-0000-0000-000000000001'),'Cliente antiguo no borra foto al omitir campo');
select pg_temp.reject($q$select public.save_team_member('b0000000-0000-0000-0000-000000000001','e9000000-0000-0000-0000-000000000001','{"photo_url":"javascript:alert(1)"}','{}')$q$,'Foto inválida','Foto rechaza esquema peligroso');
select public.save_team_member('b0000000-0000-0000-0000-000000000001','e9000000-0000-0000-0000-000000000001',jsonb_build_object('location_id',:'loc','full_name','Sin foto','role_label','Stylist','specialty','','bio','','commission_rate',10,'show_on_website',true,'active',true,'photo_url',null),'{}');
select pg_temp.ok((select photo_url is null from public.employees where id='e9000000-0000-0000-0000-000000000001'),'Quitar foto persiste sin borrar trabajador');
-- La regla de puntos existente debe funcionar igual para ambos pagos, sin duplicación.
insert into public.customers(id,business_id,full_name,phone,referral_code) values('c9000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','Cliente puntos','999000999','MEDIA1');
insert into public.products(id,business_id,name,sku,price,stock) values('f9000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','Producto puntos','MEDIA1',25.50,10);
select public.create_branch_sale('b0000000-0000-0000-0000-000000000001',:'loc','c9000000-0000-0000-0000-000000000001',null,0,'[{"kind":"PRODUCT","refId":"f9000000-0000-0000-0000-000000000001","qty":1,"discount":0}]','[{"method":"YAPE","amount":25.50}]');
select public.create_branch_sale('b0000000-0000-0000-0000-000000000001',:'loc','c9000000-0000-0000-0000-000000000001',null,5,'[{"kind":"PRODUCT","refId":"f9000000-0000-0000-0000-000000000001","qty":1,"discount":0}]','[{"method":"PLIN","amount":20.50}]');
select pg_temp.ok((select points=45 and lifetime_points=45 from public.loyalty_accounts where customer_id='c9000000-0000-0000-0000-000000000001'),'Yape y Plin suman 25+20 puntos después de descuentos');
select pg_temp.ok((select count(*)=2 and sum(points)=45 from public.loyalty_transactions where ref_type='sale'),'Un movimiento por venta, sin doble suma');
select pg_temp.reject(format($q$select public.create_branch_sale('b0000000-0000-0000-0000-000000000001',%L,'c9000000-0000-0000-0000-000000000001',null,0,'[{"kind":"PRODUCT","refId":"f9000000-0000-0000-0000-000000000001","qty":1,"discount":0}]','[{"method":"PLIN","amount":1}]')$q$,:'loc'),'no coinciden','Pago incorrecto no registra venta');
select pg_temp.ok((select points=45 from public.loyalty_accounts where customer_id='c9000000-0000-0000-0000-000000000001'),'Venta rechazada no suma puntos');
select public.create_branch_sale('b0000000-0000-0000-0000-000000000001',:'loc',null,null,0,'[{"kind":"PRODUCT","refId":"f9000000-0000-0000-0000-000000000001","qty":1,"discount":0}]','[{"method":"CASH","amount":25.50}]');
select pg_temp.ok((select points=45 from public.loyalty_accounts where customer_id='c9000000-0000-0000-0000-000000000001'),'Venta sin cliente no adjudica puntos a otra persona');
-- BARBER tiene ventas, pero no settings/team. Puede leer QR sin sustituirlo.
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000004',true);
select pg_temp.ok(jsonb_array_length(public.get_payment_qrs('b0000000-0000-0000-0000-000000000001'))=1,'Operador de ventas lee QR');
select pg_temp.reject($q$select public.save_payment_qr('b0000000-0000-0000-0000-000000000001','YAPE','b0000000-0000-0000-0000-000000000001/payments/yape/00000000-0000-0000-0000-000000000001.png','Fraude')$q$,'Sin permiso','Operador no cambia cuenta de cobro');
select pg_temp.reject($q$insert into storage.objects(bucket_id,name,metadata) values('brand-assets','b0000000-0000-0000-0000-000000000001/payments/yape/00000000-0000-0000-0000-000000000002.png','{"size":100}')$q$,'row-level security','Operador no sube QR por Storage directo');
select pg_temp.reject($q$select public.save_team_member('b0000000-0000-0000-0000-000000000001','e9000000-0000-0000-0000-000000000001','{"full_name":"Intruso"}','{}')$q$,'Sin permiso','Operador no cambia trabajador');
-- Un rol con team.manage pero sin website.manage puede subir retrato, no QR.
reset role;
insert into public.role_permissions(role_code,permission_key) values('BARBER','team.manage');
set local role authenticated;
insert into storage.objects(bucket_id,name,metadata) values('website-media','b0000000-0000-0000-0000-000000000001/team/e9000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000001.png','{"size":100}');
select pg_temp.ok(true,'team.manage permite retrato sin permiso website.manage');
select pg_temp.reject($q$insert into storage.objects(bucket_id,name,metadata) values('website-media','b0000000-0000-0000-0000-000000000002/team/e9000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000001.png','{"size":100}')$q$,'row-level security','Retrato de otro tenant bloqueado');
set local role anon;
select pg_temp.reject($q$select public.get_payment_qrs('b0000000-0000-0000-0000-000000000001')$q$,'permission denied','Anónimo no consulta configuración QR');
rollback;
