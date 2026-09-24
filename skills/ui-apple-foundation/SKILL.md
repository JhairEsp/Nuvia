---
name: ui-apple-foundation
description: Lenguaje de diseño Apple para la web — tipografía SF, color, grid, espaciado, profundidad y tokens CSS. Úsalo SIEMPRE que crees o rediseñes interfaces web (landing, producto, portfolio, dashboard) y se pida algo "hermoso", "premium", "tipo Apple", "limpio", "elegante" o "moderno". Es la base obligatoria antes de ui-apple-components, ui-apple-motion y ui-apple-polish.
---

# 🍎 Apple UI Foundation — Lenguaje de Diseño Web

Eres un diseñador de interfaz del más alto nivel, con la disciplina visual de Apple
(Human Interface Guidelines + apple.com). Tu objetivo: **belleza que parece inevitable** —
nada sobra, nada falta, todo respira.

## 1. Filosofía (no negociable)

| Principio | Significado práctico |
|---|---|
| **Claridad** | Tipografía legible, contraste impecable, un mensaje visual por sección |
| **Deferencia** | El contenido manda. La UI se calla: neutra, sin adornos, sin ruido |
| **Profundidad** | Capas reales: glass, sombras suaves, motion con física. Nunca decoración hueca |

Reglas de oro:
- **Menos es más**: elimina el 30 % de lo que hayas puesto. Luego otro 10 %.
- **Un héroe por pantalla**: cada sección tiene UN foco (titular, imagen o dato).
- **Simetría óptica**: todo centrado con intención; alineaciones milimétricas.
- **Nunca** gratuitos: bordes gruesos, sombras duras, gradientes de arcoíris, iconos con relleno chillón, más de 2 acentos por pantalla.

## 2. Tipografía (lo más importante)

```css
--font: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
        "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
```

**Escala fluida** (usa `clamp`, valores máximos tipo apple.com):

| Rol | Tamaño máx. | Weight | Tracking | Line-height |
|---|---|---|---|---|
| Hero | 96 px | 700 | -0.018em | 1.05 |
| Display | 72 px | 700 | -0.016em | 1.07 |
| Title | 52 px | 600 | -0.012em | 1.10 |
| Headline | 36 px | 600 | -0.008em | 1.15 |
| Subhead | 24 px | 600 | -0.004em | 1.20 |
| Body | 20 px (intro) / 17 px | 400 | 0 | 1.47 |
| Caption | 14 px | 400 | 0 | 1.43 |
| Micro / legal | 12 px | 400 | 0 | 1.33 |

- Titulares: **frases cortas, impacto máximo**. Ej.: «Todo el poder. En la mano.»
- Cuerpo secundario en gris (`--text-secondary`), nunca negro puro al 100 % salvo titulares.
- Párrafos centrados solo en heroes/CTA; en features, texto alineado a la izquierda.
- Interlineado generoso (≥ 1.4). Máximo ~34 caracteres por línea en móvil, ~68 en desktop.
- **NUNCA**: mayúsculas en titulares largos, más de 2 familias, texto justificado, subrayado decorativo.

## 3. Color

**Light** (por defecto):
```css
--bg:            #ffffff;
--bg-secondary:  #f5f5f7;   /* secciones alternas, hero de producto */
--bg-elevated:   #ffffff;   /* cards sobre bg-secondary */
--text:          #1d1d1f;
--text-secondary:#6e6e73;
--text-tertiary: #86868b;
--accent:        #0071e3;   /* botones/links — SOLO acento del sistema */
--accent-hover:  #0077ed;
--link:          #06c;
--hairline:      rgba(0,0,0,.08);
```

**Dark**:
```css
--bg:            #000000;
--bg-secondary:  #161617;
--bg-elevated:   #1d1d1f;
--text:          #f5f5f7;
--text-secondary:#a1a1a6;
--text-tertiary: #86868b;
--accent:        #2997ff;
--hairline:      rgba(255,255,255,.1);
```

- Paleta **neutral primero**; el color entra por el producto (fotos/renders), no por la UI.
- Un solo acento por pantalla (azul Apple). Si el producto tiene marca, sustituye `--accent` manteniendo saturación y contraste.
- Gradientes: solo tonales (gris→blanco, negro→gris) y fades de imagen a fondo. Prohibidos los multicolor.

## 4. Layout & Grid

```css
--container-text:  980px;   /* texto y heroes   */
--container-wide:  1180px;  /* grids de cards   */
--container-full:  100vw;   /* full-bleed media */
--gutter:          clamp(1rem, 4vw, 2.5rem);
--section-y:       clamp(4.5rem, 9vw, 10rem);   /* padding vertical sección */
```

- Estructura por secciones full-bleed alternando `bg` / `bg-secondary`.
- Centra todo en `--container-text`. Grilla de features: 2 cols en tablet, 3–4 en desktop.
- **Whitespace es lujo**: entre un bloque y el siguiente, respira (72–160 px).
- Media a sangre (edge-to-edge) para momentos cinematográficos; con radios suaves para tiles.
- Asimetría permitida SOLO en storytelling (imagen sticky + texto scrolleable).

## 5. Geometría & Espaciado

- Escala 8 pt: 4, 8, 12, 16, 24, 32, 48, 64, 96, 120, 160.
- Radios: **botones pill** `border-radius: 980px` · cards `18–22px` · controles `12px` · imágenes tiles `16–20px`.
- Hairlines de 1 px (`.hairline { border: 1px solid var(--hairline) }`) en vez de sombras para separar.
- Tamaño táctil mínimo: 44 × 44 px.

## 6. Profundidad & Glass (la firma visual)

```css
.glass {
  background: var(--glass);            /* rgba(255,255,255,.72) / rgba(22,22,23,.72) */
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
}
--shadow-card:  0 4px 20px rgba(0,0,0,.06);
--shadow-float: 0 20px 60px rgba(0,0,0,.12);
```

- Navbar SIEMPRE glass + hairline inferior.
- Sombras suaves y amplias (baja opacidad). **Nunca** sombras negras duras ni offsets.
- Elevation por capas: plano (0) → card (1) → nav glass (2) → modal (3).

## 7. Iconografía & media

- Iconos: lineales, 1.5–2 px stroke, esquinas redondeadas, 24 px base (SF Symbols / Lucide / Phosphor light).
- Imágenes: producto sobre fondo limpio, luz suave, sombra física mínima. `object-fit: cover` + `aspect-ratio` para cero saltos de layout.

## 8. Prohibiciones absolutas

❌ Más de 2 colores saturados en UI · ❌ Tipografías display decorativas · ❌ Bordes de 2 px+ · ❌ Sombras duras · ❌ Tablas densas sin aire · ❌ Iconos emoji como UI · ❌ Subrayados en headings · ❌ Texto centrado en párrafos largos · ❌ Animaciones > 600 ms sin razón narrativa

## Recursos

- `tokens.css` en esta carpeta: copy-paste del sistema completo de tokens (light + dark).

## Orden de aplicación

1. Este skill fija **tokens y lenguaje visual**.
2. `ui-apple-components` dibuja piezas con estos tokens.
3. `ui-apple-motion` las anima.
4. `ui-apple-polish` da el acabado final y QA.
