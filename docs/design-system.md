# 05 · Design System & Navegación — Nuvia

Inspiración: Linear · Stripe · Vercel · Notion · Framer · marcas de belleza luxury.
No se copian diseños; se toman principios: espacio, jerarquía, motion con intención, tipografía
exquisita, microinteracciones, claridad, consistencia. Reglas base: skills `ui-apple-*` equipados
(foundation → components → motion → polish) aplicados a producto SaaS.

## Personalidad visual

**"Quiet luxury" para software de belleza** — calidez minimalista: neutros cálidos (marfil, taupe),
un solo acento (bronce arcilla), tipografía impecable, abundante aire, profundidad sutil (glass,
hairlines, sombras amplias y suaves). El color entra por las fotos de los negocios, no por la UI.

## Tokens (en `web/src/styles/global.css` — Tailwind v4 `@theme`)

### Color — Light
| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#faf9f7` | Fondo app (marfil) |
| `--color-surface` | `#ffffff` | Cards, paneles |
| `--color-subtle` | `#f3f0ec` | Secciones alternas, inputs inset |
| `--color-ink` | `#191410` | Texto principal (espresso) |
| `--color-muted` | `#7d7268` | Texto secundario (taupe) |
| `--color-faint` | `#a39a90` | Placeholder, legal |
| `--color-accent` | `#9a6248` | Acciones primarias (bronce) — AA con blanco |
| `--color-accent-hover` | `#84523b` | Hover |
| `--color-hairline` | `rgba(25,20,16,.09)` | Separadores 1 px |
| semánticos | `#3d8a5f` éxito · `#b7791f` warn · `#b3402e` danger | Estados |

### Color — Dark (espresso)
`bg #14100e` · `surface #1c1713` · `subtle #251e19` · `ink #f3efeb` · `muted #a89e94` ·
`accent #c98d6f` (texto sobre accent: espresso `#1a100c`) · glass `rgba(28,23,19,.72)`.

### Tipografía
- UI: `Inter` (con stack `-apple-system, "SF Pro Text", …` primero — skill foundation).
- Display/branding landing: temas con serif (`"Playfair Display"`) o sans tight — por theme.
- Escala fluida `clamp()` — hero 64 → display 44 → title 32 → headline 22 → body 15 → caption 13.
- Tracking negativo en display (`-0.02em`), `tabular-nums` en métricas y precios.
- Cuerpo de app 15 px/1.5 para densidad cómoda; landing 17–20 px.

### Geometría & profundidad
- Radios: cards 16–18 px · controles 10–12 px · botones pill `999px` · imágenes 14 px.
- Espaciado 4 pt (4, 8, 12, 16, 24, 32, 48, 64…). Secciones de landing `clamp(72px, 9vw, 140px)`.
- `--shadow-card: 0 1px 2px rgba(25,20,16,.04), 0 8px 24px rgba(25,20,16,.06)` ·
  `--shadow-float: 0 24px 64px rgba(25,20,16,.14)`. Hairlines antes que bordes.
- Nav/dropdowns/modales: glass `saturate(160%) blur(20px)`.

### Motion (skill `ui-apple-motion`)
- Easings: `--ease-emphasized: cubic-bezier(.32,.72,0,1)` (firma) · `--ease-standard: cubic-bezier(.25,.1,.25,1)`.
- Durations: fast 150 · base 240 · slow 420. Page transitions suaves (fade + 8 px), skeletons shimmer,
  charts animan al montar, drag & drop con escala 1.02, toasts con spring.
- `prefers-reduced-motion` desactiva todo lo no esencial. **Calma > espectáculo** (§48).

## Componentes (`components/ui`)

`Button` (primary pill / secondary / ghost / danger + loading) · `Input`, `Select`, `Textarea`, `Switch`
(iOS-style) · `Card`, `StatCard` (KPI con delta) · `Badge`, `Avatar`, `Tooltip` · `Dialog`, `Drawer`,
`ConfirmDialog` (con `undo` cuando aplica) · `DropdownMenu`, `Tabs` · `Skeleton` (shimmer) ·
`EmptyState` (ilustración + copy + CTA) · `ErrorState`, `PermissionDenied` · `Toast` (sonner) ·
`CommandPalette` (⌘K, cmdk) · `DataTable` mínimo (jerarquía real: sin bordes pesados, filas aireadas).

**Estados obligatorios en toda pantalla (§49):** Loading (skeleton) · Empty · Error · Success ·
Disabled · Permission denied. Nunca pantallas en blanc.

## Shell de la app

```
┌ sidebar (glass, 240px, colapsable 64px) ─┬─ topbar (búsqueda ⌘K · sucursal · tema · avatar) ─┐
│  ◆ BLACK HOUSE BARBER (switcher)          │  [Hoy]  Panel con insights                    │
│  ── Trabajo                               │  ┌ StatCard ┬ StatCard ┬ StatCard ┬ StatCard │
│   · Panel (dashboard)                     │  │ Ingresos  │ Citas    │ Ticket   │ Ocupac. │
│   · Agenda  · Clientes  · Ventas          │  └──────────┴──────────┴──────────┴─────────┘
│  ── Crecimiento                           │  [ Gráfico ingresos ] [ Agenda del día ]
│   · Fidelización · Promociones · WhatsApp │  [ Insight IA · clientes en riesgo → ]
│   · Copiloto IA                           │
│  ── Negocio                               │
│   · Servicios · Equipo · Inventario       │
│   · Mi página · Reportes · Ajustes        │
└───────────────────────────────────────────┴───────────────────────────────────────────────┘
```

- **Mobile real (§36):** bottom tab bar (Panel, Agenda, Clientes, Ventas, Más), drawers a pantalla
  completa, tablas → listas con jerarquía, targets ≥ 44 px, botones de acción flotantes.
  El trabajador vive en el móvil: no es un desktop reducido.
- **Modo Recepción (§35):** layout de alto contraste operativo: cita actual gigante + botones
  [INICIAR] [COMPLETAR] [REPROGRAMAR] [CANCELAR]; pensado para tablet en el mostrador.
- **Command Palette (§34):** `⌘K / Ctrl+K` → Nueva cita · Nuevo cliente · Registrar venta ·
  Buscar cliente/servicio · Ver ventas · Configuración · ir a sección. Preparado para lenguaje natural.

## Navegación (§45)

```
/login · /app/dashboard · /app/calendar · /app/clients(/:id) · /app/services · /app/team
/app/sales · /app/inventory · /app/loyalty · /app/ai · /app/website · /app/settings · /app/reception
/admin · /admin/businesses · /admin/users · /admin/plans · /admin/subscriptions · /admin/modules
/admin/activity · /admin/audit · /admin/settings
/b/:slug  (pública + /b/:slug/reservar)
```

## Copy & microcopy

Voz segura, cálida, mínima. Verbos en acción ("Reservar cita", "Publicar cambios").
Feedback inmediato ("Reserva creada correctamente"), errores sin culpa y con salida.
Precios `S/35.00` (es-PE) · fechas "vie 7:00 PM" · nada de jerga técnica.
