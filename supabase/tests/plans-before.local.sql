-- SOLO base local: Auth es un stub. Verifica integridad de la migración, no login.
insert into auth.users(id,email,raw_user_meta_data) values
 ('a0000000-0000-0000-0000-000000000001','super@local.invalid','{}'),
 ('a0000000-0000-0000-0000-000000000002','owner@local.invalid','{}'),
 ('a0000000-0000-0000-0000-000000000003','other@local.invalid','{}'),
 ('a0000000-0000-0000-0000-000000000004','worker@local.invalid','{}');
update public.users set platform_role='SUPER_ADMIN' where id='a0000000-0000-0000-0000-000000000001';
insert into public.plans(id,code,name,price_monthly) values
 ('f0000000-0000-0000-0000-000000000001','STARTER','Starter',79),
 ('f0000000-0000-0000-0000-000000000002','PRO','Pro',149),
 ('f0000000-0000-0000-0000-000000000003','BUSINESS','Business',299);
insert into public.businesses(id,name,slug,status) values
 ('b0000000-0000-0000-0000-000000000001','Local Starter','local-starter','ACTIVE'),
 ('b0000000-0000-0000-0000-000000000002','Local Business','local-business','ACTIVE');
insert into public.subscriptions(id,business_id,plan_id,status) values
 ('d0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','ACTIVE'),
 ('d0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-000000000002','ACTIVE');
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',false);
insert into public.business_users(business_id,user_id,role_code,status) values
 ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','BUSINESS_ADMIN','ACTIVE'),
 ('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003','BUSINESS_ADMIN','ACTIVE'),
 ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004','BARBER','ACTIVE');
