-- ═══════════════════════════════════════════════════════════════════════════
--  🔧 FIX_AUTH.sql — Nuvia · Reparación de login de usuarios demo
--  Síntoma: GoTrue responde 500 "Database error finding user" / "querying schema"
--  al hacer login con los usuarios seed, pero el signup de usuarios nuevos funciona.
--
--  ▸ Pega este archivo COMPLETO en: Supabase Dashboard → SQL Editor → New query → Run
--  ▸ Mira el resultado de las consultas del BLOQUE 0 (diagnóstico) y luego el BLOQUE 6
--  ▸ Repite el intento de login desde la app
-- ═══════════════════════════════════════════════════════════════════════════

-- ── BLOQUE 0 · DIAGNÓSTICO (léelas: te dicen qué estaba roto) ──────────────
-- 0a) Usuarios DUPLICADOS por email (rompen el "Single()" de GoTrue → 500)
select email, count(*) as copias
from auth.users
where email like '%blackhouse.pe' or email like '%beautyapp.pe' or email like '%test.pe'
group by email
having count(*) > 1;

-- 0b) Identidades DUPLICADAS por (usuario, provider)
select u.email, i.provider, count(*) as copias
from auth.identities i
join auth.users u on u.id = i.user_id
group by u.email, i.provider
having count(*) > 1;

-- 0c) Estado de los 4 usuarios demo
select u.email,
       (u.email_confirmed_at is not null) as confirmado,
       (u.encrypted_password like '$2%')  as pass_hash_ok,
       (select count(*) from auth.identities i
         where i.user_id = u.id and i.provider = 'email') as identidades
from auth.users u
where u.email in ('super@beautyapp.pe','admin@blackhouse.pe','carlos@blackhouse.pe','andrea@blackhouse.pe');

-- 0d) Membresías (deben seguir intactas: RBAC del seed)
select bu.role_code, count(*) as miembros
from public.business_users bu
group by bu.role_code
order by 1;

begin;

-- ── BLOQUE 1 · Dedupe identidades (conserva 1 por usuario+provider) ────────
delete from auth.identities a
using auth.identities b
where a.user_id = b.user_id
  and a.provider = b.provider
  and a.ctid > b.ctid;

-- ── BLOQUE 2 · Dedupe usuarios por email (conserva el más antiguo,
--               que es el que tiene business_users/membresías) ─────────────
delete from auth.users u
using auth.users v
where lower(u.email::text) = lower(v.email::text)
  and u.ctid > v.ctid;

-- ── BLOQUE 3 · Normaliza los 4 usuarios demo ──────────────────────────────
update auth.users
set instance_id = '00000000-0000-0000-0000-000000000000',
    aud = 'authenticated',
    role = 'authenticated',
    encrypted_password = crypt('Demo123!', gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
    updated_at = now()
where email in ('super@beautyapp.pe','admin@blackhouse.pe','carlos@blackhouse.pe','andrea@blackhouse.pe');

-- ── BLOQUE 4 · Recrea EXACTAMENTE 1 identidad email por usuario demo ───────
-- (borra las que haya — posibles filas con valores que rompen el scan de GoTrue —
--  y las reconstruye con el patrón canónico)
delete from auth.identities
where user_id in (select id from auth.users
                  where email in ('super@beautyapp.pe','admin@blackhouse.pe','carlos@blackhouse.pe','andrea@blackhouse.pe'));

insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                             last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email,
                          'email_verified', true, 'provider', 'email'),
       'email', now(), now(), now()
from auth.users u
where u.email in ('super@beautyapp.pe','admin@blackhouse.pe','carlos@blackhouse.pe','andrea@blackhouse.pe');

commit;

-- ── BLOQUE 5 · Anti-reincidencia (índices únicos; fallan si queda basura) ──
create unique index if not exists auth_users_email_key
  on auth.users (lower(email::text));
create unique index if not exists auth_identities_user_provider_key
  on auth.identities (user_id, provider);

-- ── BLOQUE 6 · VERIFICACIÓN (debe salir 1 fila por usuario, sin duplicados) ─
select u.email,
       count(distinct i.id) as identidades,
       count(*) as filas_join
from auth.users u
left join auth.identities i on i.user_id = u.id and i.provider = 'email'
where u.email in ('super@beautyapp.pe','admin@blackhouse.pe','carlos@blackhouse.pe','andrea@blackhouse.pe')
group by u.email
order by 1;

-- Si el BLOQUE 6 sale limpio (1 fila/usuario) → prueba login en la app otra vez.
