# Cambio de nombre a Nuvia

La marca comercial de la aplicación es **Nuvia**. El cambio es de presentación, sin migrar cuentas ni modificar datos de negocios.

## Actualizado

- Login de escritorio y celular, monograma N y favicon.
- Marca en el menú del negocio, panel de administración y catálogo de planes.
- Créditos del sitio público y de la vista previa del editor.
- Título, descripción y metadatos de nombre de la aplicación en el navegador.
- Nombre del paquete npm: `nuvia-web`, incluido su lockfile.
- README, documentación y nombres de producto en comentarios/mensajes de los paquetes SQL.
- Los enlaces de reservas usan el dominio del despliegue y el slug real del negocio. Se retiraron los enlaces a un dominio y negocio de demostración; no se ha comprado ni configurado un dominio nuevo.

El nombre de la interfaz se centraliza en `web/src/lib/brand.ts`. Los metadatos estáticos están en `web/index.html` y el favicon en `web/public/favicon.svg`.

## Identificadores que NO se renombran

- `beautyos-auth`: clave técnica del almacenamiento de Supabase Auth. Mantenerla evita invalidar las sesiones existentes únicamente por el cambio de marca.
- `beautyos_private`: esquema privado PostgreSQL ya referenciado por migraciones, funciones y triggers. No es una marca visible ni un plan adicional.
- `project_id = "beautyos"` en la configuración CLI: identificador técnico local, no nombre comercial ni ID del proyecto remoto.
- Bases locales `beautyos_*_test`, fixtures históricos y correos antiguos: no son contenido comercial de la interfaz. Cambiarlos o reescribir auditorías no es necesario para actualizar la marca.
- URL/anon key de Supabase, nombres desplegados de las Edge Functions, IDs/UUID, rutas y datos de cada negocio.

No se han renombrado cuentas de clientes, repositorios remotos ni proyectos de Supabase. Si hay plantillas de correo o nombres externos personalizados en Supabase Auth o en un proveedor, esos ajustes se realizan en su panel; no se modificaron remotamente.

## Despliegue

Este cambio no requiere ejecutar SQL sobre una base existente. Los paquetes SQL se regeneraron para mantener sus encabezados/mensajes coherentes, no para solicitar reinstalaciones. La migración de planes que estaba pendiente es un requisito independiente: cambiar el nombre no crea las RPC faltantes.

Para un sitio publicado hay que desplegar el nuevo frontend. La vista previa local muestra Nuvia; no se ha publicado un repositorio en GitHub ni realizado un despliegue de producción con este cambio.

## Validación

- Build de producción y TypeScript.
- Prueba de marca en login escritorio/celular, pestaña, metadatos, favicon, catálogo y crédito del sitio público.
- Regresión de planes y cierre de sesión con Supabase interceptado, sin modificar cuentas remotas.
