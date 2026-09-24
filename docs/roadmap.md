# 07 · Roadmap de desarrollo — Nuvia

> Registro histórico de planificación, no instrucciones de instalación ni certificación de producción. Estado vigente: [entrega de planes y sucursales](entrega-planes-y-sucursales.md). Se retiró el seed demo; Auth usa el proveedor real y no cuentas SQL.

Orden fiel al §58 del brief. **Nada de pantallas antes de arquitectura** — ✅ = completado.

## Fase 0 — Arquitectura ✅
1. ✅ Análisis de requisitos (brief completo)
2. ✅ Arquitectura (`docs/arquitectura.md` — DECISIÓN/RAZÓN/IMPACTO)
3. ✅ Modelo de datos (`docs/modelo-de-datos.md`)
4. ✅ Roles y permisos (`docs/permisos.md`)
5. ✅ Multi-tenant (business_id + RLS + helpers)
6. ✅ Navegación (`docs/design-system.md`)
7. ✅ Design system (`docs/design-system.md` + skills `ui-apple-*`)
8. ✅ Dashboard (diseño: KPIs + insights + gráficos)
9. ✅ Website builder (`docs/website-builder.md`)
10. ✅ API (`docs/api-y-ia.md`)

## Fase 1 — Cimientos ejecutables ✅
- ✅ Esquema SQL completo + RLS + triggers + auditoría (`supabase/migrations/…init.sql`)
- ✅ RPCs públicas (`get_public_site`, `get_public_availability`, `create_booking`)
- ✅ Analytics + tools IA (`get_business_kpis`, `get_at_risk_clients`, `ai_tool_*`)
- Configuración RBAC (`supabase/seed.sql`); no datos demo ni cuentas precargadas.
- ✅ Scaffold Vite + design system + shell + ⌘K + dark/light
- ✅ Dashboard inteligente (insights + charts) · Login · Landing pública demo + wizard de reserva
- ✅ Edge Functions skeleton (ai-copilot, ai-insights)

## Fase 2 — Núcleo operativo (siguiente)
11. Auth real Supabase (login, magic link, sesiones) + selección de negocio
12. Autorización por permisos en UI (`usePermission`) + estados "Permission denied"
13. Gestión de negocios (alta, edición) y usuarios/invites con límites de plan
14. Servicios + categorías (CRUD premium, drag & drop de orden)
15. Clientes: Cliente 360, notas, Beauty History (antes/después)
16. Agenda avanzada: día/semana/lista, drag & drop, estados, reprogramar (§16)
17. Ventas / POS + pagos split (efectivo, Yape, Plin, tarjeta) + caja
18. Landing pública real desde releases + editor visual completo + preview + publish

## Fase 3 — Crecimiento
19. Almacenamiento (uploads optimizados: logos, galería, fotos, crops)
20. Automatizaciones + Centro WhatsApp (provider interface + plantillas + logs)
21. Waitlist + Revenue Recovery (matching al cancelar, invitaciones) (§17–18)
22. Fidelización (puntos, tiers, referidos, cumpleaños) (§23–24)
23. Comisiones e inventario (§26–27)

## Fase 4 — Inteligencia
24. Copiloto IA Groo completo (chat con tools, respuestas auditadas) (§30)
25. AI Insights diarios + clientes en riesgo + rebooking + upsell (§21–22, 31–32)
26. Analítica: demanda, predicción de ocupación, reportes exportables (§28–29)

## Fase 5 — Plataforma y calidad
27. Panel Super Admin completo (negocios, planes, suscripciones, módulos, MRR/churn) (§37)
28. Audit log UI + política de trazabilidad (§38)
29. Testing: unit + integration + E2E; suite de aislamiento **"Business A ≠ Business B"** (§54)
30. Auditoría de seguridad (IDOR, escalamiento, rate limiting, uploads) (§39)
31. Modo Recepción (§35) · Mobile pass final · performance · UX polish (§36, 50–51)

## Criterio de calidad transversal (§57)
Cada entrega se juzga con: *"¿Esto realmente ayuda al dueño de un negocio de belleza a
administrar mejor su negocio, ahorrar tiempo o generar más ingresos?"* — y con el checklist QA
de `skills/ui-apple-polish` (20 puntos) antes de cerrar cualquier pantalla.

---

## Estado de entrega — 2026-09-21

| Fase | Estado | Evidencia |
|---|---|---|
| 0 · Fundamentos | ✅ | skills/, docs/, README |
| 1 · SQL | ✅ 100% verde | `supabase/tests/tenant-isolation.sql` 10/10 |
| 2 · Shell & login | ✅ build green | `web/` `npm run build` ✓ |
| 3 · Pantallas operativas | ✅ | Agenda, Clientes 360°, Ventas POS, Inventario, Fidelización, WhatsApp, Copiloto, Reportes, Website Builder, Ajustes, Recepción |
| 4 · Panel súper admin | ✅ | Negocios, Usuarios, Planes, Auditoría |
| 5 · Landing pública | ✅ | `/b/:slug` + wizard 5 pasos conectado al store |
| Endurecimiento | ⏳ parcial | Falta code-split recharts, i18n PT/EN, tests e2e, CI |

**Datos reales**: el store usa Supabase. No hay modo demo operativo; los fixtures y sustituciones de red se limitan a pruebas aisladas.
