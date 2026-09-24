#!/usr/bin/env bash
# Solo cluster LOCAL de pruebas. Recrea únicamente beautyos_preflight_test.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=beautyos_preflight_test
sudo -u postgres dropdb -h /var/run/postgresql -p 55432 --if-exists "$DB"
sudo -u postgres createdb -h /var/run/postgresql -p 55432 "$DB"
local_sql() { sudo -u postgres psql -h /var/run/postgresql -p 55432 -d "$DB" -v ON_ERROR_STOP=1 "$@"; }
{
 cat .pgtest/stubs.sql
 cat <<'SQL'
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
alter table storage.objects add column metadata jsonb;
SQL
 cat supabase/migrations/20260921000001_init.sql supabase/seed.sql supabase/migrations/20260922000002_platform_admin.sql supabase/tests/plans-before.local.sql
 echo "insert into public.employees(business_id,full_name) select 'b0000000-0000-0000-0000-000000000001','Preflight '||i from generate_series(1,6) i;"
} | local_sql > .pgtest/preflight-setup.log 2>&1
if local_sql < supabase/migrations/20260924000003_two_plans.sql > .pgtest/preflight-rejection.log 2>&1; then
 echo 'FAIL: migración aceptó Starter con 6 trabajadores'; exit 1
fi
local_sql <<'SQL'
do $$ begin
 if (select count(*) from public.employees)<>6 or to_regclass('public.subscription_plan_history') is not null
 or not exists(select 1 from public.plans where code='PRO') then raise exception 'FAIL: preflight no revirtió la migración'; end if;
end $$;
SQL
printf 'PASS: preflight rechaza Starter excedido y revierte catálogo/historial, sin borrar trabajadores\n'
# Paquete completo sobre base existente debe detenerse en su guard inicial.
if local_sql < supabase/SUPABASE.sql > .pgtest/fresh-guard-rejection.log 2>&1; then
 echo 'FAIL: paquete nuevo aceptó una base existente'; exit 1
fi
grep -q 'Nuvia ya existe' .pgtest/fresh-guard-rejection.log
printf 'PASS: SUPABASE.sql bloquea ejecución en proyecto Nuvia existente\n'
