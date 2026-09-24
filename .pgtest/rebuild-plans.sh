#!/usr/bin/env bash
# Exclusivamente PostgreSQL LOCAL con Auth/Storage simulados. No usar DATABASE_URL.
set -euo pipefail
cd /home/user
sudo -u postgres dropdb -h /var/run/postgresql -p 55432 --if-exists beautyos_plans_test
sudo -u postgres createdb -h /var/run/postgresql -p 55432 -T template0 -E UTF8 --locale=C beautyos_plans_test
psql_local() { sudo -u postgres psql -h /var/run/postgresql -p 55432 -d beautyos_plans_test -v ON_ERROR_STOP=1; }
psql_local < .pgtest/stubs.sql > .pgtest/plans-setup.log 2>&1
psql_local >> .pgtest/plans-setup.log 2>&1 <<'SQL'
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
alter table storage.objects add column metadata jsonb;
SQL
psql_local < supabase/migrations/20260921000001_init.sql >> .pgtest/plans-setup.log 2>&1
psql_local < supabase/seed.sql >> .pgtest/plans-setup.log 2>&1
psql_local < supabase/migrations/20260922000002_platform_admin.sql >> .pgtest/plans-setup.log 2>&1
psql_local < supabase/tests/plans-before.local.sql >> .pgtest/plans-setup.log 2>&1
psql_local < supabase/migrations/20260924000003_two_plans.sql >> .pgtest/plans-setup.log 2>&1
