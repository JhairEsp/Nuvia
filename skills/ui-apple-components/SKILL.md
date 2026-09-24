---
name: ui-apple-components
description: Biblioteca de componentes web estilo Apple listos para copiar — navbar glass, botones pill, hero cinematográfico, cards, features, forms, toggles, modales y footer. Úsalo SIEMPRE que construyas UIs web y se pida algo "hermoso", "premium", "tipo Apple", "limpio" o "moderno". Requiere ui-apple-foundation (sus tokens).
---

# 🧩 Apple UI Components — Piezas Premium

Construye componentes con los tokens de `ui-apple-foundation` (o `tokens.css`).
Cada pieza: silenciosa, perfectamente alineada, con estados completos
(`:hover` `:focus-visible` `:active` `:disabled`).

## 1. Global Nav (siempre glass)

```css
.nav {
  position: fixed; inset: 0 0 auto 0; height: var(--nav-h); z-index: var(--z-nav);
  background: var(--glass);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: var(--hairline-w) solid var(--hairline);
}
.nav-inner {
  max-width: var(--container-wide); margin-inline: auto; height: 100%;
  padding-inline: var(--gutter);
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);
}
.nav a {
  font-size: var(--text-micro); font-weight: 400; color: var(--text);
  text-decoration: none; opacity: .88; transition: opacity var(--duration-fast) var(--ease-standard);
  display: inline-flex; align-items: center; height: var(--tap);
}
.nav a:hover { opacity: .56; }
```
- Items: 5–8 links micro (12 px) distribuidos equitativamente. Logo a la izquierda, acción (carrito/bag icon o CTA) a la derecha.
- Móvil: logo + botón hamburguesa que abre un sheet full-screen glass. Nada de sidebars.

## 2. Botones

```css
.btn {                      /* primario: pill relleno */
  display: inline-flex; align-items: center; justify-content: center; gap: .5em;
  min-height: var(--tap); padding: .7em 1.4em;
  font: 500 var(--text-caption)/1 var(--font-text);
  border-radius: var(--radius-pill); border: none; cursor: pointer;
  background: var(--accent); color: var(--on-accent); text-decoration: none;
  transition: background var(--duration-fast) var(--ease-standard),
              transform var(--duration-fast) var(--ease-emphasized);
}
.btn:hover  { background: var(--accent-hover); }
.btn:active { transform: scale(.97); }
.btn[disabled] { opacity: .4; pointer-events: none; }

.btn-secondary {             /* contorno sutil */
  background: transparent; color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}
.btn-secondary:hover { background: var(--accent-soft); }

.btn-quiet {                 /* relleno gris (acción terciaria) */
  background: var(--bg-inset); color: var(--text);
}

.link-chevron {              /* «Más información ›» — firma Apple */
  display: inline-flex; align-items: center; gap: .3em;
  color: var(--link); text-decoration: none;
  font-size: var(--text-body-sm); 
}
.link-chevron::after { content: "›"; transition: transform var(--duration-fast) var(--ease-standard); }
.link-chevron:hover { text-decoration: underline; }
.link-chevron:hover::after { transform: translateX(3px); }
```
- Jerarquía: 1 primario + 1 secundario por sección. Nunca 3 rellenos juntos.

## 3. Hero cinematográfico

```html
<header class="hero">
  <p class="hero-eyebrow">Nuevo</p>
  <h1 class="hero-title">Todo el poder.<br>En la mano.</h1>
  <p class="hero-sub">Una frase. Precio o dato. Nada más.</p>
  <div class="hero-cta"><a class="btn" href="#">Comprar</a>
    <a class="link-chevron" href="#">Más información</a></div>
  <figure class="hero-media"><img src="…" alt="…" /></figure>
</header>
```
- Tipografía centrada, titulares de 2–4 palabras por línea. Subcopy gris a ≤ 24 px.
- Media full-bleed debajo con fade inferior hacia el fondo de la sección siguiente.
- Eyebrow («Nuevo», «Anuncio») en caption semibold, a veces con degradado de acento.

## 4. Cards & tiles

```css
.card {
  background: var(--bg-elevated); border-radius: var(--radius-card);
  box-shadow: var(--shadow-card); overflow: hidden;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: var(--space-7) var(--space-5);
  transition: transform var(--duration-base) var(--ease-emphasized),
              box-shadow var(--duration-base) var(--ease-standard);
}
.card:hover { transform: translateY(-4px); box-shadow: var(--shadow-float); }
.card img { width: 100%; aspect-ratio: 16/10; object-fit: cover; border-radius: var(--radius-tile); }
```
Variantes:
- **Product tile** (grid 2×2 tipo apple.com/today): media a sangre, texto superpuesto con sombra de texto tenue.
- **Glass card** sobre imagen: `.glass` + hairline + radio grande.
- **Feature row** (sticky split): imagen sticky a un lado, textos scrolleando al otro (desktop); apilado en móvil.
- **Stat card**: número gigante (Display) + etiqueta gris. Nada más.

## 5. Features grid

```css
.features { max-width: var(--container-wide); margin-inline: auto;
  padding-inline: var(--gutter); display: grid; gap: var(--space-5);
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
```
- Icono lineal 28–32 px → título Subhead semibold → 2 líneas de body gris.
- 3 o 4 columnas. Nunca 5+. Nunca viñetas dentro de grid.

## 6. Forms

```css
.field input, .field textarea {
  width: 100%; box-sizing: border-box; min-height: var(--tap);
  padding: .85em 1em; font: 400 var(--text-body-sm)/1.4 var(--font-text);
  color: var(--text); background: var(--bg-inset);
  border: none; border-radius: var(--radius-control);
  transition: box-shadow var(--duration-fast) var(--ease-standard);
}
.field input::placeholder { color: var(--text-tertiary); }
.field input:focus-visible { outline: none; box-shadow: 0 0 0 4px var(--accent-soft), 0 0 0 1.5px var(--accent); }
```
- Labels pequeñas (caption, semibold) sobre el campo. Inputs con relleno inset, sin borde.
- Switch iOS:
```css
.switch { appearance: none; width: 51px; height: 31px; border-radius: 980px;
  background: var(--bg-inset); position: relative; cursor: pointer;
  transition: background var(--duration-base) var(--ease-emphasized); }
.switch::after { content: ""; position: absolute; top: 2px; left: 2px;
  width: 27px; height: 27px; border-radius: 50%; background: #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,.2);
  transition: transform var(--duration-base) var(--ease-emphasized); }
.switch:checked { background: #34c759; }
.switch:checked::after { transform: translateX(20px); }
```
- Segmented control: píldora inset con pastilla blanca flotante que se desliza.

## 7. Modal / Sheet

```css
.modal {
  position: fixed; inset: 0; z-index: var(--z-modal);
  display: grid; place-items: center; padding: var(--gutter);
  background: var(--overlay); backdrop-filter: blur(8px);
}
.modal-card {
  background: var(--bg-elevated); border-radius: var(--radius-card);
  box-shadow: var(--shadow-float); max-width: 480px; width: 100%;
  padding: var(--space-7) var(--space-6); text-align: center;
}
```
- Entrada: backdrop fade + card `scale(.96)→1` con `--ease-emphasized` (280 ms).
- Móvil: bottom sheet con esquinas superiores 20 px y grabber de 36×5 px.
- Close: botón «×» circular glass arriba a la derecha o tecla Esc.

## 8. Precio / CTA final

- Precio en Title + «Desde» en caption gris. Tabla comparativa solo si hay 2–3 planes, mucho aire.
- CTA final: sección `bg-secondary`, titular Display, 1 botón primario, 1 link-chevron.

## 9. Footer

- `bg-secondary`, hairline superior. 4–5 columnas de links en caption gris, título de columna semibold 12 px.
- Legal en micro (12 px) `text-tertiary`. En móvil, acordeones colapsables.
- Cierre fino: «Copyright © … — Todos los derechos reservados» + links legales separados por «|».

## Reglas de composición

1. Centrado vs izquierda: heroes y CTA **centrados**; features y forms **izquierda**.
2. Nunca más de 2 CTAs visibles compitiendo en viewport.
3. Imágenes siempre con `aspect-ratio` y `loading="lazy"` (salvo la del hero).
4. Toda interacción necesita respuesta táctil (ver `ui-apple-motion`).
