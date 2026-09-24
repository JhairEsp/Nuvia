# Editor web Nuvia: alcance antes de la actualización

Problemas inspeccionados: WebsitePage mostraba toasts en lugar de subir imágenes/guardar varios campos; el store escribía por pulsación, ignoraba filas inexistentes y anunciaba publicación antes de confirmar. La previsualización abría el release público, no el borrador. El render público no compartía la implementación del editor.

Cambios previstos, sin escrituras remotas:
- WebsitePage: selector inicial de tres plantillas, campos editables por sección, subida real a Storage, guardado explícito, previsualización privada y enlace de publicación copiable.
- Renderer público compartido con la previsualización en iframe; estilos propios, responsive y animaciones con reduced-motion.
- business_website: template_key, public_info (contacto/nombre públicos sin cambiar datos operativos), draft_revision para detectar ediciones simultáneas.
- RPCs get_website_editor, save_website_draft, publish_website_draft; snapshot privado autorizado y publish_website actualizado. Usa website.manage y capacidad website del plan.
- Se mantienen las tablas website_sections, business_branding, website_media y website_releases. No se eliminan negocios, suscripciones, usuarios ni releases.
- Storage mantiene los buckets existentes, prefijo UUID del negocio y cuotas de la migración 03. Las imágenes públicas se suben desde el editor. Quitar una imagen del borrador no borra un archivo usado por un release publicado.
- Nueva migración 04/copia EDITOR_WEB.sql, posterior a la migración de planes. La migración de planes 03 no se reescribe.

No se cambia el dominio: las URLs usan el origen/base del despliegue real con /#/b/slug. Cambiar el frontend local no actualiza automáticamente un sitio desplegado ni instala RPCs remotas.
