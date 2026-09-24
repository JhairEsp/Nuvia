# Activar la administración total de Nuvia

> **Actualización de planes 2026-09-24:** después del SQL de administración corresponde la [migración de dos planes y sucursales](entrega-planes-y-sucursales.md). El editor solo permite STARTER/BUSINESS; no crear códigos arbitrarios. Las verificaciones antiguas de este documento no sustituyen las de esa entrega.

## Nombre del despliegue actual

La función de cuentas está desplegada como **`quick-service`** en el proyecto `uvydtpclprvuxhxdvwoq`.
La aplicación usa `VITE_PLATFORM_USERS_FUNCTION=quick-service` en `web/.env`.
Su código fuente sigue en `supabase/functions/platform-users/index.ts`; `supabase/config.toml` también declara el alias `quick-service` con ese entrypoint.
No hace falta crear otra función llamada `platform-users` si ya se utiliza este despliegue. Para actualizarlo con CLI:

```bash
npx supabase functions deploy quick-service --project-ref uvydtpclprvuxhxdvwoq --no-verify-jwt
```

Se verificó que el endpoint responde a OPTIONS (204) y rechaza GET (405), conforme al código entregado. Esto no sustituye una prueba autenticada de creación, edición o eliminación. Los pasos siguientes describen una instalación inicial con el nombre predeterminado `platform-users`; si eliges ese nombre, ajusta la variable de entorno y reinicia el frontend.

## Estado de esta entrega

La interfaz y el backend están implementados. El frontend compila; se validaron 21 comprobaciones de PostgreSQL local y 10 pruebas aisladas de la función de cuentas.

**Pendiente en tu proyecto:** aplicar el SQL y desplegar la Edge Function. No se dispone de acceso de despliegue al proyecto; no se ha probado este CRUD autenticado contra tu Supabase remoto. No se han creado ni eliminado cuentas o negocios en tu proyecto durante este cambio.

## 1. Actualizar la base de datos

1. En Supabase, abre **SQL Editor → New query**.
2. Copia el contenido completo de **`supabase/ADMIN_CRUD.sql`** y pulsa **Run**.
3. Debe terminar sin errores.

Este archivo es una copia de `supabase/migrations/20260922000002_platform_admin.sql`. Aplica solo uno de los dos: contienen exactamente lo mismo. Requiere el esquema inicial de Nuvia que ya instalaste.

**No vuelvas a ejecutar `SUPABASE.sql`, `seed.sql`, `FIX_AUTH.sql` ni los archivos de tests para este cambio.** La actualización de administración no crea usuarios demo ni modifica directamente `auth.users` o `auth.identities`.

## 2. Desplegar la gestión de cuentas

### Desde el dashboard, sin terminal

1. Abre **Edge Functions** en el mismo proyecto.
2. Elige la opción de crear/desplegar una función **mediante el editor**.
3. Nombra la función exactamente **`platform-users`**.
4. En su `index.ts`, pega el contenido de **`supabase/functions/platform-users/index.ts`**.
5. Despliega la función.
6. En la configuración de la función, desactiva **Verify JWT / Enforce JWT verification** si está activado. La función hace su propia validación: `auth.getUser()` comprueba el token y `public.users.platform_role` debe ser `SUPER_ADMIN`. No admite operaciones anónimas.

Supabase proporciona a las Edge Functions las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. La última se usa únicamente en el servidor; **no la pongas en `web/.env`, en variables `VITE_*`, ni en el navegador**.

### Alternativa con CLI

Desde la raíz del proyecto descargado, con tu sesión de Supabase CLI:

```bash
npx supabase login
npx supabase functions deploy platform-users \
  --project-ref uvydtpclprvuxhxdvwoq \
  --no-verify-jwt
```

La configuración equivalente está incluida en `supabase/config.toml`. No necesitas compartir claves administrativas en el chat.

## 3. Usar el panel

Cierra sesión y vuelve a entrar con tu cuenta `SUPER_ADMIN`. Se abrirá `/#/admin`.

| Sección | Crear | Editar | Eliminar |
|---|---|---|---|
| Negocios | Nombre, slug, tipo, contacto, estado y plan. Inicializa configuración y borrador web vacíos. | Datos de contacto, dirección, descripción, tipo, slug, estado y suscripción. | Borra el negocio y sus datos operativos asociados; conserva las cuentas Auth y auditoría de plataforma. |
| Usuarios | Cuenta confirmada por Auth Admin API, nombre, correo, contraseña de 12–128 caracteres, rol y membresías. | Nombre, correo de acceso, rol de plataforma, negocios, roles por negocio, estados y trabajador vinculado. | Elimina cuenta Auth, perfil y membresías; conserva registros operativos, desvinculando al autor. |
| Planes | Solo STARTER o BUSINESS si falta ese código, nombre, descripción, precio, límites y módulos. | Todos los campos anteriores y activación/desactivación. | Solo si no tiene suscripciones asociadas. Si tiene historial, desactívalo. |

Todas las listas tienen búsqueda, paginación y actualización. Las acciones de guardado esperan respuesta del servidor antes de mostrar éxito. Los errores mantienen abierto el formulario. No hay filas ficticias ni guardados exclusivamente en memoria en estas pantallas.

### Flujo recomendado

1. Usa Starter o Business. Solo se puede recrear uno de esos dos códigos si falta.
2. Crea el negocio y asígnale el plan.
3. En **Usuarios**, crea la cuenta de su responsable, con rol de plataforma **Usuario de negocio**.
4. Pulsa **Asignar negocio**, selecciona el negocio y el rol **Administrador / BUSINESS_ADMIN**, con estado **ACTIVE**.
5. Esa persona inicia sesión con su correo y contraseña. Configura servicios, equipo y horarios antes de publicar reservas.

### Protecciones

- No puedes eliminar tu propia cuenta ni quitarte el rol `SUPER_ADMIN`.
- La base impide eliminar o degradar al último Super Admin a través de las rutas de aplicación/Auth.
- Los usuarios normales no pueden ascenderse modificando su propio perfil.
- Cada borrado requiere escribir el nombre o correo exacto del registro.
- Las modificaciones de negocio y suscripción son una transacción; el perfil y sus membresías también.
- Auth y Postgres no comparten transacción: si falla el perfil, la función compensa el alta o el cambio de correo. Si la compensación falla, muestra el UID y solicita revisar esa cuenta.
- Cambiar correo no cambia la contraseña. Las cuentas nuevas se crean confirmadas; el administrador debe verificar la identidad del titular y compartir sus credenciales por un canal seguro.
- El borrado de negocio elimina registros relacionados por FK, no archivos de Storage ni recursos de proveedores externos. Esos recursos requieren una política independiente de limpieza. Supabase puede impedir borrar una cuenta que todavía posee objetos de Storage; el error se muestra sin simular éxito.

## 4. Comprobar en tu proyecto

Haz estas comprobaciones con registros temporales creados **desde el panel**, no con SQL en Auth:

1. Usa Starter o Business y crea un negocio temporal de prueba; recarga y confirma que persiste.
2. Edita nombre, slug, plan y estado; verifica también las tablas `businesses`, `subscriptions` y `plans`.
3. Crea un usuario con una contraseña propia, asígnalo al negocio y prueba su login en una ventana privada.
4. Edita su nombre/correo y comprueba el cambio en **Authentication → Users** y `public.users`.
5. Desde la cuenta Super Admin, elimina el usuario; comprueba que desaparecen la cuenta Auth y su perfil.
6. Intenta borrar el plan mientras tenga suscripciones: debe mostrar un error y conservarlo.
7. Elimina el negocio temporal tras confirmar su nombre. No borres los planes iniciales para ejecutar esta prueba.
8. Revisa **Auditoría**.

## Si aparece un error

- **“Falta aplicar la actualización SQL…”**: completa el paso 1.
- **“No se pudo contactar la función platform-users…”**: verifica el nombre y despliegue del paso 2, la conexión y la configuración JWT.
- **“Acceso exclusivo para Super Admin”**: revisa `public.users.platform_role`, no `user_metadata` ni el rol interno de Auth. Cierra sesión y vuelve a entrar.
- **Código, correo o slug duplicado**: elige uno distinto.
- **Plan con suscripciones asociadas**: desactívalo para conservar el historial.
- **Error de las cuentas demo antiguas**: este cambio no repara sus filas de Auth. No uses esos usuarios como prueba de cuentas nuevas; crea las nuevas mediante Auth/Edge Function.

## Archivos y pruebas técnicas

- UI: `web/src/features/admin/AdminPages.tsx`.
- Acceso a API: `web/src/lib/platform-admin.ts`.
- SQL: `supabase/migrations/20260922000002_platform_admin.sql`.
- Auth Admin API: `supabase/functions/platform-users/index.ts`.
- 21 comprobaciones locales SQL: `supabase/tests/platform-admin.local.sql` (solo base local con stubs, nunca producción).
- 10 pruebas unitarias de autorización y compensación: `supabase/functions/platform-users/index_test.ts` (red sustituida, sin cuentas reales).

```bash
npm run build --prefix web
npx deno check supabase/functions/platform-users/index.ts
npx deno test --allow-env --allow-net=unit-test.invalid \
  supabase/functions/platform-users/index_test.ts
```
