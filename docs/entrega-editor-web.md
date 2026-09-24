# Activar «Mi página» en tu despliegue de Nuvia

**24 de septiembre de 2026 · Código implementado y verificado localmente. No se ha aplicado SQL ni desplegado el frontend en tu proyecto remoto.**

## Lo corregido

- Selector inicial de exactamente tres plantillas: **Éditorial, Studio y Serene**, con recomendación según rubro, diseños diferenciados y animaciones accesibles.
- Subida de portada, logo y fotos desde la aplicación mediante Supabase Storage; sin cargas manuales al panel.
- Edición de diez secciones, marca, textos, imágenes, contactos, mapa, redes y testimonios; catálogos reales de servicios/equipo/promociones.
- Borrador guardado mediante RPC y recuperado al recargar. No modifica la publicación vigente.
- Preview privado del borrador, incluso sin guardar, con el mismo renderer público y tres tamaños.
- Publicación atómica confirmada por Supabase. URL del origen/base del despliegue que estás usando, con el slug real; copiar y abrir solo tras confirmación.
- Protección por permisos/capacidad/tenant, revisión anti-sobrescritura y errores sin falsos mensajes de éxito.

## Instalación en un proyecto existente

### 1. Respaldo e inspección

Respaldar la base antes de migrar. Desde SQL Editor, esta consulta **solo inspecciona** si existen los contratos necesarios:

```sql
select
  to_regprocedure('public.require_plan_capability(uuid,text,text)') as planes_03,
  to_regprocedure('public.get_website_editor(uuid)') as editor_04,
  to_regprocedure('public.publish_website_draft(uuid,jsonb,bigint)') as publicar_04;
```

- Si `planes_03` es nulo, instalar primero la migración de planes siguiendo `README.md` y `docs/entrega-planes-y-sucursales.md`. No repetirla si ya está aplicada.
- Si la 03 existe y las dos funciones 04 son nulas, aplicar **una sola vez** `supabase/EDITOR_WEB.sql` en SQL Editor del proyecto correspondiente.
- Si la 04 ya está registrada/aplicada, no volver a ejecutar el paquete. Un estado parcial o incompatible requiere inspección, no reinstalar a ciegas.

`EDITOR_WEB.sql` es copia exacta de `migrations/20260924000004_website_editor.sql`: usar **uno u otro**, nunca ambos. El script es transaccional, no idempotente, y solicita recarga del esquema PostgREST al terminar.

**No ejecutar `SUPABASE.sql` en un proyecto existente.** Ese paquete es exclusivamente para instalaciones nuevas e incluye 01–04. Tampoco ejecutar tests ni `FIX_AUTH.sql` contra producción.

### 2. Volver a desplegar el frontend

Los archivos editados aquí no cambian automáticamente tu GitHub ni tu hosting. Incorporar el código actualizado al proyecto del despliegue y reconstruir:

```bash
npm ci --prefix web
npm run build --prefix web
```

Publicar `web/dist` según el proveedor, o configurar raíz `web`, build `npm run build` y salida `dist`. Mantener `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del mismo proyecto donde se aplicó el SQL. Nunca poner `service_role` o secretos privados en `VITE_*`.

El editor no requiere nuevas Edge Functions. Esta entrega no cambia la configuración de dominio ni incorpora un despliegue remoto automático.

### 3. Comprobación en tu web desplegada

Con una cuenta real autorizada:

1. Abrir **Mi página**, elegir plantilla y cambiar un título.
2. Subir una fotografía propia; comprobar miniatura y preview. Si falla, revisar el mensaje de Storage, permiso del usuario y cuota. `brand-assets` y `website-media` deben conservar la configuración pública y políticas de la instalación; no abrir otros buckets indiscriminadamente.
3. Guardar borrador y recargar: texto e imagen deben mantenerse.
4. Previsualizar y cambiar entre escritorio/tablet/celular; todavía no debe cambiar la página pública.
5. Publicar; abrir el enlace confirmado en una ventana sin sesión. Debe usar tu dominio/ruta actual, no localhost ni un dominio inventado.
6. Modificar y guardar sin publicar: la ventana pública debe conservar el release anterior.
7. Comprobar una reserva real con datos autorizados mediante el flujo existente. El editor no certifica por sí solo Auth, reservas, pagos ni entrega de WhatsApp en producción.

Un error `PGRST202` en las nuevas RPCs suele indicar migración faltante, caché pendiente o frontend apuntando a otro proyecto. No repetir migraciones ya aplicadas para intentar solucionarlo.

## Impacto y conservación

Migración 04: agrega tres columnas a `business_website`; crea el helper privado y las tres RPCs; sustituye `publish_website` por un wrapper que valida el borrador antes de publicar. Sin eliminación masiva de datos, cambios a UUID, usuarios, suscripciones ni datos operativos. Conserva los releases y assets anteriores. Los sitios anteriores continúan disponibles; el editor solicita elegir una plantilla cuando no hay una guardada.

Los overrides de contacto/nombre público no cambian el slug ni la identidad operativa del negocio. Servicios, equipo y promociones provienen del backend. Al publicar se exige portada activa con título; los testimonios visibles deben estar completos. Guardar/publicar con una revisión antigua se rechaza para no sobrescribir otra sesión.

**Imágenes:** archivos en buckets públicos pueden ser accesibles antes de publicar. Quitar del borrador no borra el archivo ni libera cuota automáticamente, porque podría estar utilizado por un release anterior.

## Pruebas ejecutadas

| Validación local | Resultado |
|---|---|
| TypeScript y build de producción | PASS; advertencia de bundle >500 kB, no bloqueante |
| Editor SQL, permisos, IDOR, validación, borrador/releases y horarios | **29 PASS** |
| Dos publicaciones simultáneas sobre la misma revisión | **1 PASS**: único release, segundo intento rechazado |
| UI del editor en Chromium | **13 PASS**, incluyendo Storage request, errores sin falso éxito, reload, tres layouts y móvil |
| Regresión UI planes | **10 PASS** |
| Regresión logout | **5 PASS** |
| Regresión marca Nuvia | **6 PASS** |
| Suite SQL previa de planes | PASS, sin eliminar assertions; fixture de publicación con portada válida |
| Concurrencia previa: personal, citas, almacenamiento, sucursal y fidelización | **5 PASS** |
| Instalación nueva de `SUPABASE.sql` con 01–04 | PASS: dos planes, cero cuentas y cero negocios precargados |
| Comparación de paquetes incrementales con sus migraciones | Copias exactas |

Evidencia en `.pgtest/website-*.log`, capturas `.pgtest/website-templates.png` y `.pgtest/website-editor-mobile.png`. Tests: `supabase/tests/website-editor.local.sql`, `supabase/tests/website-concurrency.local.py` y `web/tests/website-ui.local.mjs`.

**Alcance de las pruebas:** PostgreSQL 17 local con stubs mínimos de Auth/Storage; navegador con respuestas Supabase/Storage interceptadas exclusivamente en tests. El código productivo usa las APIs reales, sin mocks. Estas pruebas no prueban una subida al bucket remoto, un login de GoTrue real ni una publicación en tu hosting. Se requiere la comprobación de despliegue indicada arriba.

## Archivos principales

- `supabase/EDITOR_WEB.sql` y migración 04.
- `web/src/features/website/`: editor, API, plantillas, renderer y preview.
- `web/src/features/landing/LandingPage.tsx`: renderer público compartido.
- `web/src/store/db.ts`, `web/src/types/domain.ts`: adaptación de snapshots, incluida galería heredada.
- `docs/website-builder.md`: funciones actuales y límites; no confundir con capacidades futuras.
