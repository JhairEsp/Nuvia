# Mi página · editor web Nuvia

Estado implementado localmente al 24/09/2026. Ver [activación y pruebas](entrega-editor-web.md). Este documento describe el código actual, no una lista de funciones futuras.

## Tres plantillas, antes de editar

| Plantilla | Diseño | Orientación |
|---|---|---|
| **Éditorial** | Composición editorial, serif, colores cálidos | Salones, estética, pestañas y nails |
| **Studio** | Fondo oscuro, tipografía contundente, acentos eléctricos | Barberías y estudios creativos |
| **Serene** | Colores naturales, formas orgánicas, movimiento suave | Spa, bienestar y terapias |

El rubro determina la recomendación y los textos iniciales; cualquiera de las tres se puede elegir. Los diseños tienen composiciones diferenciadas, son responsive y respetan `prefers-reduced-motion`. El reveal al desplazarse es mejora progresiva según soporte del navegador. Sin fotos propias se muestra arte CSS decorativo, no fotografías ni testimonios de clientes inventados.

Los negocios sin `template_key` eligen primero una plantilla. Cambiar después conserva contenido, imágenes, orden y visibilidad, pero aplica la fuente y los colores del nuevo diseño. La web publicada anterior sigue intacta hasta publicar de nuevo.

## Qué se puede editar

- **Marca:** logo, colores principal/botones, fuente y frase de marca.
- **Contacto:** nombre público, descripción, dirección, teléfono, WhatsApp y email. Son overrides públicos: no cambian nombre/slug/datos administrativos del negocio.
- **Diez secciones:** portada, servicios, sobre nosotros, galería, equipo, promociones, testimonios, ubicación, invitación a reservar y pie de página. Activar/ocultar y reordenar con flechas; campos específicos para cada sección.
- **Imágenes:** subir, reemplazar y quitar portada/logo/foto de nosotros; agregar/quitar fotografías de galería y editar descripciones.
- **Mapa y redes:** consulta de Google Maps; Instagram, TikTok y Facebook con enlaces HTTP(S).
- **Testimonios:** autor, texto y calificación; deben ser auténticos y contar con autorización.
- **Servicios/equipo/promociones:** datos reales del catálogo con sus filtros de actividad y visibilidad; se administran en sus módulos, no mediante precios o trabajadores ficticios en el editor. Horario de sucursal principal, con fallback al legado por día sin duplicados.

No se incluye recorte de fotografías, drag-and-drop, duplicación de secciones ni restauración de releases desde la UI.

## Flujo real

1. Elegir plantilla.
2. Editar y subir fotografías desde la aplicación.
3. **Guardar borrador:** confirma persistencia mediante RPC, sin cambiar la web pública.
4. **Previsualizar:** muestra los cambios actuales, incluso sin guardar, en escritorio/tablet/celular. No publica ni genera reservas. Escape cierra también desde el iframe y devuelve el foco al botón de apertura.
5. **Publicar cambios:** guarda y crea el release en una sola transacción. Solo después de la confirmación del servidor se muestra éxito y el enlace para copiar/abrir.

Preview y sitio público comparten `SiteRenderer.tsx` y `site.css`. El sitio público usa `get_public_site` y el drawer existente de reservas; el preview no reserva. La URL se construye con el origen y la ruta base del despliegue abierto, seguida de `#/b/<slug-real>`. No se inventa un dominio comercial.

## Persistencia y seguridad

- `business_website`: `template_key`, `public_info`, `draft_revision`, mapa, redes y frase.
- `business_branding`: logo, portada, fuente y colores.
- `website_sections`: contenido, orden y visibilidad del borrador.
- `website_releases.snapshot`: única versión mostrada al público; los releases anteriores se conservan.
- El helper privado compone el snapshot desde catálogos del servidor. El cliente envía solo campos editables.
- RPCs `get_website_editor`, `save_website_draft`, `publish_website_draft`: requieren permiso `website.manage` y capacidad `website`, con aislamiento por negocio y revisión optimista. Los rechazos no muestran éxito ni descartan los cambios locales.
- Dos sesiones con la misma revisión no pueden sobrescribirse: una debe recargar. La publicación es atómica y conserva el release anterior si falla.

## Fotografías y almacenamiento

Subida directa mediante el cliente Supabase Storage, con JWT del usuario y las políticas/cuotas existentes. JPG, PNG o WebP, máximo 10 MB por archivo, con comprobación de decodificación en el navegador. SVG no admitido.

- `brand-assets`: portada y logo.
- `website-media`: foto de nosotros y galería.
- Ruta: `<business_uuid>/website/<rol>/<uuid-archivo>.<extensión>`.

Estos buckets son públicos en la instalación prevista: subir solo contenido autorizado para acceso público. **Borrador privado no significa archivo privado**: una fotografía subida puede ser accesible por su URL aunque aún no se haya publicado la página. No usar documentos ni fotos confidenciales.

Quitar una imagen del borrador no elimina el objeto de Storage: evita romper releases anteriores, pero el archivo sigue contando para la cuota. No hay recolección automática de archivos huérfanos. La UI no promete eliminación física.

## Límites de esta entrega

Fuentes Google y mapas necesitan conectividad externa; las fuentes tienen fallback. La SPA hash no incorpora prerender/SEO social por negocio, conversión automática a AVIF ni un historial visual de versiones. El enlace de WhatsApp abre una conversación: no implementa envío automatizado, proveedor, worker ni recordatorios. La activación remota y la comprobación con Auth/Storage reales siguen siendo pasos de despliegue.
