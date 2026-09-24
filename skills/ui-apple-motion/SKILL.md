---
name: ui-apple-motion
description: Animaciones y micro-interacciones tipo Apple para web — easings de firma, scroll reveals, hero stagger, hover y press con física, parallax sutil. Úsalo SIEMPRE que una UI web deba sentirse "viva", "premium", "fluida", "tipo Apple" o "hermosa". Complementa ui-apple-foundation y ui-apple-components.
---

# ✨ Apple UI Motion — Movimiento con Física

El movimiento de Apple no decora: **comunica profundidad y respuesta**.
Todo es rápido, elástico y silencioso. Si se nota "la animación", es que está mal.

## 1. Principios

1. **Velocidad**: 180–400 ms en UI cotidiana; hasta 900 ms solo en storytelling de hero.
2. **Física**: entra rápido, aterriza suave (ease emphasized). Nada lineal, nada rebotes de caricatura.
3. **Jerarquía**: lo que aparece primero es lo importante; el resto hace stagger.
4. **Unidireccionalidad espacial**: los elementos entran desde abajo (+Y), salen hacia arriba o desvanecen.
5. **Respeto**: `prefers-reduced-motion` apaga todo lo no esencial.

## 2. Easings & durations (de `tokens.css`)

| Token | Uso |
|---|---|
| `--ease-standard` `cubic-bezier(.25,.1,.25,1)` | hovers, cambios de color, opacidad |
| `--ease-emphasized` `cubic-bezier(.32,.72,0,1)` | **firma Apple**: entradas, cards, modales, toggles |
| `--ease-spring` (linear spring) | botones, toggles, elementos que "aterrizan" |
| `--ease-exit` `cubic-bezier(.4,0,1,1)` | salidas y desapariciones |
| `--duration-fast` 180 ms | hover, press |
| `--duration-base` 320 ms | reveals de UI, modales |
| `--duration-slow` 560 ms | imágenes, secciones |
| `--duration-hero` 900 ms | entrada cinematográfica del hero |

## 3. Receta: Scroll reveal (la base de todo)

```js
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) {
    e.target.classList.add('is-visible');
    io.unobserve(e.target);              // una sola vez
  }
}, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });

document.querySelectorAll('[data-reveal]').forEach((el, i) => {
  el.style.setProperty('--stagger', `${(i % 4) * 70}ms`);
  io.observe(el);
});
```

```css
[data-reveal] {
  opacity: 0; transform: translateY(28px); filter: blur(8px);
  transition:
    opacity  var(--duration-slow) var(--ease-emphasized) var(--stagger, 0ms),
    transform var(--duration-slow) var(--ease-emphasized) var(--stagger, 0ms),
    filter   var(--duration-slow) var(--ease-emphasized) var(--stagger, 0ms);
  will-change: opacity, transform;
}
[data-reveal].is-visible { opacity: 1; transform: none; filter: none; }
```
- Stagger 60–80 ms entre hermanos. Nunca más de 4 elementos escalonados.
- El blur de entrada es opcional pero muy "Apple keynote": úsalo en heroes e imágenes.

## 4. Receta: Hero entrance (keynote moment)

Secuencia al cargar (todo con `--ease-emphasized`):
1. **+0 ms** eyebrow: fade + `translateY(16px)`, 480 ms.
2. **+120 ms** título: cada línea `translateY(32px)→0` + fade, 700 ms, stagger 90 ms entre líneas.
3. **+280 ms** subcopy + CTA: fade suave, 480 ms.
4. **+360 ms** media: `scale(1.04)→1` + fade, 900 ms (el momento cinematográfico).

```css
.hero-title .line { display: block; overflow: hidden; }
.hero-title .line > span {
  display: block; transform: translateY(110%);
  transition: transform 700ms var(--ease-emphasized);
}
.is-loaded .hero-title .line > span { transform: none; }
```

## 5. Receta: Hover & press (micro-física)

| Elemento | Hover | Active/Press |
|---|---|---|
| Link texto | `opacity: .7` (180 ms) | — |
| Botón pill | fondo `--accent-hover` | `scale(.97)` 100 ms |
| Card | `translateY(-4px)` + `--shadow-float` | `scale(.98)` |
| Imagen tile | `scale(1.03)` dentro de `overflow:hidden` (600 ms) | — |
| Icono botón | `scale(1.06)` | `scale(.94)` |
| Nav item | `opacity: .56` | — |

- El press SIEMPRE responde en < 100 ms. Un tap sin respuesta táctil se siente "barato".
- Transiciones solo en `transform`, `opacity`, `filter`, `background-color` (60 fps garantizado).

## 6. Receta: Toggle & segmented (springs)

- Switch iOS: perilla `translateX` con `--ease-emphasized` 320 ms + color de pista.
- Al pasar de off→on: micro-bounce de la perilla (`scale(1)→1.06→1`) en 240 ms.
- Segmented control: pastilla que se desliza con `--ease-spring` 350 ms (layout-agnostic con FLIP si cambian anchos).

## 7. Receta: Modal / sheet

- Backdrop: `opacity 0→1` + `blur(0→8px)`, 280 ms.
- Card: `opacity 0→1` + `scale(.96)→1`, 280 ms `--ease-emphasized`.
- Bottom sheet: `translateY(100%)→0` con `--ease-emphasized` 380 ms + spring al detenerse.
- Cierre: reversa con `--ease-exit` 200 ms. Esc y click en backdrop lo cierran.

## 8. Receta: Parallax & sticky storytelling

- Imagen de producto en sección sticky: `translateY` sutil ±4 % ligado a scroll (rAF + lerp 0.1).
- Texto scrolleando junto a media sticky: cada bloque hace su reveal normal.
- Barra de nav al hacer scroll: al pasar 8 px, añade hairline + reduce opacidad del fondo (180 ms).
- **Prohibido**: parallax en texto, zoom exagerado (> 6 %), scroll-jacking.

## 9. View Transitions (si hay routing)

```css
@view-transition { navigation: auto; }
::view-transition-old(root) { animation: 220ms var(--ease-exit) both fade-out; }
::view-transition-new(root) { animation: 320ms var(--ease-emphasized) both fade-in; }
```

## 10. Reduced motion (obligatorio)

```css
@media (prefers-reduced-motion: reduce) {
  [data-reveal] { opacity: 1; transform: none; filter: none; transition: none; }
  /* deja solo fades de 120 ms o nada */
}
```
En JS: `matchMedia('(prefers-reduced-motion: reduce)').matches` → desactiva parallax y stagger.

## Anti-patterns 🚫

- Bounce elástico exagerado · duraciones > 1 s en UI · animar `width/height/top/left`
- Animar todo a la vez (sin stagger) · sonidos · animaciones en bucle que distraen
- Spinners donde puede haber shimmer/skeleton · transiciones sin estado `:active`
