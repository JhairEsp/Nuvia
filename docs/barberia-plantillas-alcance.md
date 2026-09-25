# Plantillas exclusivas para Barbería · alcance

- Cambiar solo la variante visual de los negocios cuyo tipo sea BARBERSHOP (acepta también la etiqueta Barbería).
- Mantener exactamente tres IDs compatibles con SQL: EDITORIAL, STUDIO, SERENE. Para barbería se presentan como Clásica, Urbana y Caballeros; para el resto siguen Éditorial, Studio y Serene.
- Diferenciar composición, paleta, tipografía, ilustración de barbería, decoración y animaciones; responsive y reduced-motion. No agregar servicios, personal, reseñas ni precios ficticios.
- Un único renderer compartido entre selector/preview y sitio público. Imagen generada de una silla de barbería usada como arte decorativo, no como fotografía real del local; las fotos propias siguen teniendo prioridad.
- Conservar imágenes, contactos, catálogos, visibilidad, orden y textos personalizados. Solo adaptar textos predeterminados reconocibles al escoger una variante; no reescribir contenido libre ni la descripción propia del negocio.
- Sin migración SQL ni cambios a planes/permisos/IA. El rubro se toma del negocio guardado por el backend, no de un valor local para saltar permisos.
- Probar que todos los rubros restantes conservan su catálogo original, además de guardar/publicar las tres variantes con las claves existentes.
- No desplegar remotamente. El preview local incorpora los cambios; actualizar producción requiere redeploy del frontend. El nuevo renderer adapta también los snapshots publicados que indiquen BARBERSHOP; los cambios de contenido del editor solo llegan al público al publicar.
