-- SOLO LECTURA. No modifica ni elimina cuentas, perfiles o membresías.
-- Reemplaza el correo de la siguiente línea por el usuario que intentas gestionar.
with filtro as (
  select lower('REEMPLAZA_POR_EL_CORREO_DEL_USUARIO') as correo
)
select
  p.id as uid_perfil,
  p.email as correo_perfil,
  a.id as uid_auth,
  a.email as correo_auth,
  case
    when p.id is null then 'SOLO_AUTH: falta el perfil de la aplicación'
    when a.id is null then 'SOLO_PERFIL: no existe Auth con ese UID'
    when lower(p.email) is distinct from lower(a.email) then 'MISMO_UID: correos diferentes'
    else 'MISMO_UID: existen perfil y fila Auth'
  end as resultado
from public.users p
full outer join auth.users a on a.id = p.id
cross join filtro f
where lower(p.email) = f.correo or lower(a.email) = f.correo;

-- Que la fila Auth exista NO demuestra que GoTrue pueda leerla correctamente.
-- Si no hay resultados, revisa el correo introducido; no concluyas que fue eliminada.
-- No compartir contraseñas, tokens, claves administrativas ni datos de otros usuarios.
