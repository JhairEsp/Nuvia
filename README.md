# Nuvia

Marca actual: **Nuvia**. Consulta [la nota del cambio de nombre](docs/marca-nuvia.md) para los identificadores técnicos que se conservan por compatibilidad.

Gestión multi-negocio para barberías, salones y negocios de belleza. React 19 + TypeScript + Vite, con Supabase PostgreSQL, Auth, Storage y Edge Functions.

## Planes comerciales

| Capacidad | Starter · S/79/mes | Business · S/299/mes |
|---|---:|---:|
| Trabajadores | 5 | Ilimitados |
| Citas por mes | 300 | Ilimitadas |
| Almacenamiento | 500 MB | 10 GB (10 240 MB) |
| Sucursales | 1 | Ilimitadas |
| Web, fidelización, Copiloto IA y WhatsApp | Incluidos | Incluidos |
| Gestión multisucursal | No | Sí |

Los valores son la configuración inicial; el Super Admin administra precios, límites y capacidades. `plans.limits` y `plans.modules` son la fuente de verdad. Ilimitado se representa con JSON `null`, no con números artificiales. Los límites se hacen cumplir en PostgreSQL, además de la interfaz.

**Estado de la entrega:** implementado y probado localmente; no desplegado en el proyecto remoto. Ver [entrega, pruebas y activación](docs/entrega-planes-y-sucursales.md).

## Ejecutar el frontend

```bash
cp web/.env.example web/.env
# Completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY de tu proyecto.
npm ci --prefix web
npm run dev --prefix web -- --host 0.0.0.0
```

La app requiere un backend configurado y una sesión real. **No hay modo demo sin Supabase ni cuentas/negocios precargados.** Los datos ficticios de las pruebas están exclusivamente en archivos de tests aislados.

```bash
npm run typecheck --prefix web
npm run build --prefix web
```

Solo las claves públicas de Supabase van en `VITE_*`. **Nunca** colocar `service_role`, `GROQ_API_KEY` ni el secreto cron en el frontend. La IA usa `ai-copilot` con el JWT del usuario; el proveedor se llama desde Edge Functions. Si anteriormente se distribuyó una clave `VITE_GROQ_API_KEY`, hay que revocarla/rotarla y configurar la nueva únicamente en Edge Secrets.

## Base de datos: elegir el procedimiento correcto

### Proyecto Nuvia existente

1. Respaldar y ejecutar `supabase/INSPECCION_PLANES.sql` (solo lectura).
2. Confirmar que ya están instaladas las migraciones inicial y de administración. Si falta la segunda, aplicar **una vez** `supabase/ADMIN_CRUD.sql`.
3. Revisar el [alcance y las reglas](docs/planes-alcance-migracion.md).
4. Aplicar **una vez** `supabase/PLANES_Y_SUCURSALES.sql`. Es una copia exacta de la migración `20260924000003_two_plans.sql`: aplicar uno u otro, no ambos.
5. Desplegar las funciones y el frontend según la guía de entrega.

**No ejecutar `SUPABASE.sql`, los tests ni `FIX_AUTH.sql` sobre el proyecto existente.** No insertar cuentas en `auth.users`/`auth.identities`; se administran mediante Supabase Auth API.

### Instalación nueva

`supabase/SUPABASE.sql` incluye esquema, configuración RBAC, administración y migración de planes. **Solo para un proyecto sin Nuvia instalado; no es idempotente.** No contiene usuarios Auth, contraseñas ni registros operativos de demostración.

Crear la primera cuenta mediante Supabase Authentication. Con el propietario del proyecto y el UID verificado, establecer su rol inicial en `public.users` desde un contexto SQL administrativo de confianza. Después, los negocios y usuarios se gestionan desde el panel. No existe una cuenta ni una contraseña predeterminada.

Alternativa con CLI: aplicar las tres migraciones en orden y la configuración RBAC de `seed.sql`. Este seed solo configura roles/permisos; no sirve para poblar una demo. No mezclar el paquete SQL completo con migraciones ya registradas/aplicadas.

## Rutas

La SPA utiliza rutas hash:

- `/#/login`: acceso.
- `/#/plans`: catálogo y comparativa.
- `/#/app/settings/plan`: Mi plan y consumos.
- `/#/app/settings/branches`: sucursales, horarios y reportes.
- `/#/app/*`: operaciones del negocio.
- `/#/admin/*`: administración de plataforma.
- `/#/b/:slug`: web pública y reservas.

## Archivos principales

- `supabase/migrations/`: SQL versionado; la migración 03 es transaccional y no reejecutable.
- `supabase/functions/`: cuentas, Copiloto y job de insights.
- `supabase/tests/`: pruebas SQL y concurrencia **locales**, nunca fixtures de producción.
- `web/tests/`: pruebas de interfaz con red interceptada.
- `web/src/store/capabilities.ts`: contrato y estado de capacidades recibidas del servidor.
- `docs/entrega-planes-y-sucursales.md`: activación, evidencia y pendientes reales.

Los paquetes SQL se regeneran sin conexión a bases de datos con `python3 supabase/compose_sql.py`.

## Integraciones externas

La disponibilidad de un módulo en el plan no acredita una entrega externa: WhatsApp requiere proveedor y procesador de colas/automatizaciones; IA requiere despliegue y un secreto válido de Groq. Los cambios de plan generan solicitudes y asignaciones administrativas: no ejecutan cobros recurrentes ni simulan pagos.
