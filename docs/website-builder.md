# 06 · Website Builder & Landing pública — Nuvia

Una de las funciones principales (§5–15): cada negocio tiene su página pública
(`https://TU-DOMINIO/#/b/slug-del-negocio`) editable sin programar. Se utiliza el dominio del despliegue; no se presupone un dominio comercial registrado.

## Modelo de contenido

| Pieza | Tabla | Notas |
|---|---|---|
| Identidad + contacto | `businesses` + `business_settings` | nombre, descripción, logo, favicon, tel, WhatsApp, email, dirección, Google Maps, horarios |
| Branding | `business_branding` | preset + overrides (colores, tipografía, fondo) |
| Secciones | `website_sections` | `type`, `position`, `active`, `content jsonb` (borrador) |
| Media / galería | `website_media` | drag & drop, posición, principal, alt, descripción |
| Servicios visibles | `services.show_on_website` | el editor elige cuáles |
| Equipo visible | `employees.show_on_website` | "Nuestro equipo" |
| Promociones | `promotions.show_on_website` | "Martes Beauty" |
| Testimonios | `reviews.is_published` | con foto opcional |
| Snapshots publicados | `website_releases` | lo único que ve el público (DECISIÓN 4) |

## Motor de secciones (un solo engine, §44)

Orden editable por drag & drop (idéntico al brief):

```
HERO → SERVICES → ABOUT → GALLERY → TEAM → PROMOTIONS → TESTIMONIALS → LOCATION → CTA → FOOTER
```

Cada sección: activar/desactivar · reordenar · editar contenido. `<SectionsRenderer/>` mapea
`type → componente`; el **theme** (tokens) cambia la piel, no el código.

### Contenido por sección (content jsonb)
- **HERO** — imagen de portada (subir/reemplazar/eliminar), título ("Tu estilo comienza aquí."),
  subtítulo ("Reserva tu próxima experiencia."), CTA ("Reservar cita") + `cta_enabled`.
- **SERVICES** — auto desde catálogo (`show_on_website`): nombre, descripción, duración, precio,
  imagen, categoría, botón [Reservar].
- **ABOUT** — texto de la casa + imagen.
- **GALLERY** — grid drag & drop `[Foto 1][Foto 2][Foto 3]…`, principal, cantidad visible, descripción.
- **TEAM** — profesionales públicos: foto, nombre, rol ("Andrea · Stylist").
- **PROMOS** — promo con imagen, precio tachado, descuento, vigencia, [Reservar].
- **TESTIMONIALS** — testimonios publicados con foto del cliente.
- **LOCATION** — mapa (Google Maps link/embed), dirección, [Cómo llegar], WhatsApp, teléfono, horario.
- **CTA** — cierre con botón de reserva.
- **FOOTER** — redes (Instagram, TikTok, Facebook — links configurables hoy, embed en futuro),
  legales, crédidos.

## Branding seguro (§6)

Presets profesionales (mismo engine, distintos tokens):

| Preset | Personalidad |
|---|---|
| **LUXURY** | serif elegante, negro/champán, mucho aire (spas, estética premium) |
| **MODERN** | sans tight, alto contraste, energía (barberías, nails) |
| **MINIMAL** | casi monocromo, tipografía protagonista |
| **DARK** | negro espresso, acentos metálicos (barberías oscuras, studios) |
| **SOFT** | tonos rosados/arena suaves, redondeado generoso |
| **ELEGANT** | tonos vino/bronce, serif+small caps |

El admin elige preset y ajusta fino (color principal, secundario, botones, fondo, tipografía
**dentro de opciones predefinidas**). Zod valida contraste mínimo (AA) y prohíbe combinaciones
que destruyan la UI (§6).

## Editor "Mi página" (`/app/website`)

Tres modos: **[EDITAR] [PREVISUALIZAR] [PUBLICAR]**

- Izquierda: lista de secciones con drag & drop (↕ activar/desactivar/duplicar contenido).
- Centro: preview en vivo con switch **Desktop / Tablet / Mobile** (iframe del mismo renderer).
- Derecha: panel de props de la sección seleccionada (campos guiados, upload con crop).
- Barra superior: estado `Borrador · Guardar borrador · Publicar cambios` con diff resumido
  ("3 secciones modificadas").
- Los cambios en draft **nunca** tocan la página pública hasta `publish_website()` (§43):
  crea `website_releases.snapshot` atómico + toast "Página publicada" + "Deshacer" (re-publicar
  release anterior).

## Reserva desde la landing (§15) — mínima fricción, SIN cuenta

```
SERVICIO → PROFESIONAL → FECHA → HORA → NOMBRE → WHATSAPP → CONFIRMAR
```

- Wizard en drawer/modal (mobile-first), barra de progreso, retroceso libre.
- Upselling en paso 1 ("Completa tu servicio": Barba +S/15, Mascarilla +S/10) (§32).
- Slots reales vía `get_public_availability`; bloquear doble booking en `create_booking`.
- Confirmación con resumen + "Agregar al calendario" + recordatorio automático 24 h antes (WhatsApp).
- Waitlist: si no hay hueco → "Avísame si se libera un horario" (§17) en un tap.

## Rendimiento del sitio público

Snapshot JSON único → primer render rápido; imágenes del Storage con thumbnails AVIF/WebP +
lazy loading; `aspect-ratio` para cero CLS; SEO: title/meta/OG desde el snapshot; prerender futuro
si el SEO lo exige (DECISIÓN 12).
