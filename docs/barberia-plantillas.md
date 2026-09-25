# Mi página · tres diseños exclusivos para Barbería

Implementado en frontend y preview local. No se desplegó al hosting remoto ni se aplicó SQL.

## Cuándo se muestran

Cuando el negocio guardado por el backend tiene tipo `BARBERSHOP` (Barbería), el selector de **Mi página** muestra exactamente:

| Opción | Identidad | Composición |
|---|---|---|
| **Clásica** | Carbón, cuero, cobre y serif | Texto lateral y una ilustración en arco; aspecto de barbería tradicional |
| **Urbana** | Negro, alto contraste y verde eléctrico | Portada a toda anchura, grandes titulares y un tratamiento monocromo |
| **Caballeros** | Marfil y verde profundo | Titular centrado, líneas finas y una imagen panorámica |

También se reconoce la etiqueta Barbería con o sin tilde. No se aplica el cambio a Salón, Spa, Estética, Uñas, Pestañas, Cejas, Masajes ni Otro: conservan Éditorial, Studio y Serene.

El rubro es el dato registrado del negocio, no el nombre comercial ni una selección temporal sin guardar. Para un diseño ya seleccionado, entrar en **Mi página → Cambiar plantilla**. Si el tipo del negocio se cambia desde administración, guardar primero y recargar el editor.

## Contenido y movimiento

- Textos iniciales orientados a cortes, barbas, equipo de barberos y reservas de barbería.
- Composiciones diferentes en selector, preview y sitio público, con renderer compartido.
- Movimiento suave de la ilustración, sello animado, cinta decorativa deslizante, entradas de portada y efectos al pasar por los botones/servicios.
- Se desactiva la animación cuando el navegador indica `prefers-reduced-motion`.
- Adaptación a escritorio y celular; comprobación de ausencia de desbordamiento a 390 px.

La ilustración de silla de barbería es **arte decorativo generado**, no una foto del local ni de trabajos realizados. Se identifica como tal. La imagen final WebP pesa aproximadamente 131 KB. Si existe una portada/foto propia, tiene prioridad. No se crean servicios, precios, reseñas ni trabajadores ficticios.

## Conservación y publicación

Los IDs técnicos siguen siendo `EDITORIAL`, `STUDIO`, `SERENE`, por lo que no se añade ninguna opción SQL ni se requiere migración. Los nombres exclusivos de barbería son una variante de presentación según rubro.

Cambiar plantilla conserva fotos propias, galería, contactos, catálogos, visibilidad, orden y contenido libre. Solo sustituye textos predeterminados reconocibles por los textos iniciales de la nueva variante; no sustituye la descripción propia del negocio. Se aplican la paleta y fuente de la opción elegida, como en el selector anterior.

Guardar sigue siendo borrador; **Publicar cambios** confirma un release. Para producción, volver a desplegar el frontend completo, incluidos sus assets. El renderer nuevo también adapta los snapshots publicados cuyo tipo sea BARBERSHOP; no se reescriben sus datos ni publicaciones mediante SQL.

## Verificación local

- **9 comprobaciones PASS**: selector exclusivo, otros rubros, tres variantes en preview/publicación, responsive, animaciones activas y reduced-motion, conservación de contenido/imágenes/orden, borrador y Spa sin variante de barbería.
- **13 comprobaciones de regresión del editor PASS**: selector original para Salón, guardado, fallos reales, uploads, publicación y móvil.
- TypeScript y build PASS. Persiste la advertencia anterior de bundle grande.
- Navegador con APIs Supabase/Storage interceptadas exclusivamente en tests. No acredita una publicación remota.

Tests: `web/tests/barber-templates-ui.local.mjs` y `web/tests/website-ui.local.mjs`. Logs `.pgtest/barber-ui-results.log`, `.pgtest/barber-website-regression.log`, `.pgtest/barber-build.log`. Capturas locales de las tres variantes y el selector en `.pgtest/barber-*.png`.
