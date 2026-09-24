---
name: ui-apple-polish
description: Acabado premium obsesivo para UIs web estilo Apple — responsive, dark mode, accesibilidad, rendimiento y checklist QA final de 20 puntos. Úsalo SIEMPRE antes de entregar cualquier UI web que deba verse "hermosa", "premium", "tipo Apple", "pulida" o "perfecta". Es el paso final tras ui-apple-foundation, ui-apple-components y ui-apple-motion.
---

# 💎 Apple UI Polish — La Obsesión por el Detalle

El 90 % de la diferencia visual está en el último 10 %: alineaciones ópticas,
estados completos, dark mode honesto y cero saltos de layout.
**Nada se entrega sin pasar el checklist final.**

## 1. Responsive (mobile-first, fluido)

- Breakpoints: 480 / 734 / 1068 / 1440 px (convención apple.com). Usa `clamp()` para todo lo fluido.
- Tipografía y espaciado **nunca con saltos bruscos**: escala continua, secciones con `--section-y`.
- Nav: 5–8 links en desktop → hamburguesa full-screen glass en ≤ 734 px.
- Grillas: 1 col móvil → 2 tablet → 3–4 desktop. Media queries solo donde el layout cambia de verdad.
- Objetivos táctiles ≥ 44 px. Márgenes táctiles ≥ 8 px entre targets.
- Tablas: horizontales con scroll-snap o tarjetas apiladas en móvil. Nunca texto < 12 px.

## 2. Dark mode honesto

- Implementa **ambos** modos con tokens (ver `tokens.css`). `color-scheme: light dark` en `:root`.
- En dark, el fondo es `#000` puro para OLED (tipo apple.com), elevaciones `#161617`/`#1d1d1f`.
- Revisa SOMBRAS: en dark sube opacidad, baja blur extra. Revisa BORDES: hairline blanco 10 %.
- Imágenes/videos con transparencia o `mix-blend-mode` revisados en ambos modos.
- Si hay toggle manual: persiste en `localStorage`, respeta `prefers-color-scheme` en primera visita, transición de cambio 300 ms.

## 3. Accesibilidad (no opcional)

- Contraste: texto normal ≥ **4.5:1** (AAA 7:1 en body si se puede); texto grande ≥ 3:1.
- HTML semántico: `header/nav/main/section/footer`, un solo `h1`, orden lógico de headings.
- `:focus-visible` siempre visible (ring acento 3–4 px). Nada de `outline: none` sin sustituto.
- Imágenes: `alt` real (decorativas → `alt=""`). Iconos botón: `aria-label`.
- Reduced motion respetado (ver `ui-apple-motion` §10). Skip link a `#main`.
- Estados `:disabled` con `aria-disabled` cuando corresponda; errores de form con `aria-live`.
- Teclado: modales atrapan foco, Esc cierra, tab order natural.

## 4. Rendimiento visual (60 fps)

- Anima SOLO `transform`, `opacity`, `filter`. Usa `will-change` con moderación y quítalo tras la animación.
- `aspect-ratio` en TODA imagen/iframe → cero layout shift (CLS 0).
- `loading="lazy"` + `decoding="async"` en media bajo el fold; hero con `fetchpriority="high"`.
- Fuentes: `font-display: swap`; preconnect si cargas Inter u otra webfont.
- Un solo hilo de sombras/glass: `backdrop-filter` solo en nav y modales (es caro).

## 5. Micro-detalle (la firma de obsesión)

- `::selection` con tinte de acento suave. Scrollbar fina y neutra en desktop.
- `meta name="theme-color"` para ambos modos. Favicon SVG limpio. `scroll-behavior: smooth`.
- Botones y links: transición de **todos** sus estados, incluido el regreso del hover (no solo la entrada).
- Alineación óptica: iconos centrados ópticamente (no solo matemáticamente), primera línea de texto alineada con el borde del icono.
- Numeración y unidades tipográficas: `font-variant-numeric: tabular-nums` en precios/datos.
- Placeholders de imagen con color de marca suave (no gris muerto).
- Consistencia total: el MISMO radio, el MISMO padding y el MISMO peso de título en componentes del mismo tipo. Audítalo con los ojos entrecerrados (blur test: si el layout sigue leyéndose al desenfocar, la jerarquía es correcta).

## 6. Checklist QA final — ✅ los 20 puntos

1. ☐ Un solo acento de color; paleta coherente en light y dark
2. ☐ Tipografía: escala fluida, tracking negativo en display, ≤ 2 familias
3. ☐ Titulares con copy corto y potente; sin viñetas donde sobran
4. ☐ Nav glass + hairline + estado al hacer scroll
5. ☐ Jerarquía de botones: 1 primario + 1 secundario por sección
6. ☐ Estados completos: hover / focus-visible / active / disabled en todo interactivo
7. ☐ Reveal de scroll con stagger y sin repetirse al re-entrar
8. ☐ Hero entrance secuenciado; reduced motion respetado
9. ☐ Todas las imágenes con `aspect-ratio` + lazy bajo el fold
10. ☐ Contraste AA/AAA verificado en ambos modos
11. ☐ Navegación completa por teclado; modales con focus trap
12. ☐ Responsive probado en 375 / 734 / 1068 / 1440
13. ☐ Dark mode sin colores lavados ni sombras sucias
14. ☐ Cero layout shift al cargar fuentes e imágenes
15. ☐ Targets táctiles ≥ 44 px
16. ☐ `meta theme-color`, favicon, títulos y OG tags presentes
17. ☐ Copy revisado: sin errores, voz segura y minimalista
18. ☐ Blur test pasado (jerarquía legible desenfocado)
19. ☐ Consistencia de radios/espaciados auditada entre componentes
20. ☐ Has eliminado otra cosa más. Si dudas entre dos elementos, quita uno.

> Si un solo punto queda en ❌, **no está terminado**.
