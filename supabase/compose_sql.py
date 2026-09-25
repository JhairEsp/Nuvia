"""Reproduce paquetes SQL; no conecta ni ejecuta nada contra una base de datos."""
from pathlib import Path
root = Path(__file__).resolve().parent
migration = root / 'migrations/20260924000003_two_plans.sql'
(root / 'PLANES_Y_SUCURSALES.sql').write_bytes(migration.read_bytes())
(root / 'EDITOR_WEB.sql').write_bytes((root / 'migrations/20260924000004_website_editor.sql').read_bytes())
(root / 'VENTAS_Y_EQUIPO.sql').write_bytes((root / 'migrations/20260924000005_business_media.sql').read_bytes())
header = """-- Nuvia · instalación NUEVA exclusivamente (2026-09-24).
-- NO idempotente. NO ejecutar en un proyecto Nuvia existente.
-- Existentes: seguir README; aplicar incrementales 03/04/05 solo si faltan.
-- Solo esquema, RBAC y dos planes; no usuarios Auth, contraseñas ni datos demo.
-- Generado por python3 supabase/compose_sql.py; modificar las migraciones originales.
do $$ begin
 if to_regclass('public.businesses') is not null or to_regclass('public.plans') is not null then
  raise exception 'Nuvia ya existe. No ejecutar SUPABASE.sql: utilizar la migración incremental documentada.';
 end if;
end $$;

"""
parts = ['migrations/20260921000001_init.sql', 'seed.sql', 'migrations/20260922000002_platform_admin.sql', 'migrations/20260924000003_two_plans.sql', 'migrations/20260924000004_website_editor.sql', 'migrations/20260924000005_business_media.sql']
(root / 'SUPABASE.sql').write_text(header + '\n\n'.join('-- FUENTE: ' + name + '\n' + (root/name).read_text() for name in parts))
print('Paquetes regenerados: SUPABASE.sql (01–05), PLANES_Y_SUCURSALES.sql (03), EDITOR_WEB.sql (04) y VENTAS_Y_EQUIPO.sql (05)')
