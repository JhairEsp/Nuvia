# 04 · API & IA (Groq) — Nuvia

## Principio

El frontend **nunca** habla con Groq ni con proveedores externos. Todo pasa por Supabase
(supabase-js con JWT → RLS, o Edge Functions para lógica sensible). La `GROQ_API_KEY` vive en
`supabase secrets`, jamás en el bundle.

## Capas de acceso a datos

| Capa | Cuándo | Ejemplo |
|---|---|---|
| **Tablas + RLS** (supabase-js) | CRUD simple tenant-scoped | `from('customers').select()`, crear servicio |
| **RPCs (`security definer`)** | Operaciones multi-tabla, validadas, públicas o con permisos | `create_booking`, `publish_website`, `match_waitlist` |
| **Edge Functions** | Secrets, 3ros (Groq, WhatsApp), rate limiting, jobs | `ai-copilot`, `ai-insights`, `booking-notify` |
| **Views / RPCs de lectura** | Agregados y analytics (dashboard, tools IA) | `get_business_kpis`, `ai_tool_*` |

El frontend utiliza Supabase real. No hay un backend de mocks en producción. Las pruebas aisladas sustituyen la red, sin modificar el proyecto remoto. La especificación histórica de rutas/tablas de este documento debe contrastarse con las migraciones; ver [contratos actuales y activación](entrega-planes-y-sucursales.md).

## RPCs públicas (anon — sitio web + reservas)

| RPC | Descripción |
|---|---|
| `get_public_site(p_slug)` | Snapshot publicado: branding, secciones ordenadas, servicios visibles, equipo, promos, testimonios, contacto |
| `get_public_availability(p_slug, p_date, p_service_id, p_employee_id)` | Slots libres (horarios − citas − time_off) |
| `create_booking(p_slug, p_service_ids, p_employee_id, p_start, p_customer)` | Valida hueco, upsert de cliente por teléfono, crea cita PENDING + items. Rate-limit por teléfono/IP en Edge |

Protección: SECURITY DEFINER con `search_path` fijado, validación de estado del negocio
(`status = 'ACTIVE'` y release publicado), sin exponer IDs internos ajenos.

## RPCs de negocio (authenticated)

`publish_website` · `cancel_appointment` (política de cancelación + matching waitlist) ·
`complete_appointment` (dispara comisiones, puntos, rebooking) · `create_sale` (items + pagos + stock + comisiones) ·
`add_loyalty_points` · `redeem_points` · `process_referral` · `match_waitlist` ·
`get_recoverable_slots(p_days)` · `refresh_customer_stats` · `log_audit`

## Analytics (dashboard e IA)

| RPC | Entrega |
|---|---|
| `get_business_kpis(p_from, p_to)` | Ingresos, citas, ticket promedio, ocupación, clientes nuevos vs recurrentes |
| `get_demand_heatmap(p_weeks)` | Ocupación por día/hora (§29) |
| `get_payment_mix(p_from, p_to)` | Ventas por método (Yape, Plin, efectivo, tarjeta) |
| `get_at_risk_clients(p_tolerance)` | Clientes fuera de su frecuencia habitual (§21) |
| `get_recoverable_slots(p_days)` | Huecos por cancelación con candidatos de waitlist/frecuentes (§18) |

## 🤖 AI Business Copilot (Groq)

**Regla de oro (§30): la IA NUNCA inventa métricas.** Si una tool no devuelve datos, responde
"No tengo datos suficientes".

### Arquitectura

```
Usuario pregunta ("¿Cómo estuvo mi semana?")
  → Edge Function ai-copilot (valida JWT → business_id del membership; rate limit)
    → Groq chat (model: llama-3.3-70b-versatile, temperature 0.2)
      → tool calling sobre tools declaradas ──► RPCs SQL reales (ai_tool_*)
    ← respuesta redactada con cifras exactas + tool_calls auditados en ai_messages
```

### Tools declaradas hacia Groq (cada una = RPC `ai_tool_*`)

| Tool | Resuelve |
|---|---|
| `get_revenue(period)` | Ingresos, variación, ventas por método |
| `get_top_services(period)` | Ranking de servicios por ingresos y cantidad |
| `get_staff_performance(period)` | Ticket promedio, ocupación, comisiones por trabajador |
| `get_empty_slots(period)` | Horarios vacíos y días débiles ("los martes") |
| `get_at_risk_clients()` | Clientes fuera de frecuencia + días de retraso |
| `get_new_vs_returning(period)` | Clientes nuevos vs recurrentes |
| `get_loyalty_summary()` | Puntos, tiers, referidos |

Todas reciben `business_id` **derivado del JWT en el servidor** (nunca del body): anti IDOR.

### AI Insights (§31) — job `ai-insights` (cron diario)

1. Corre heurísticas SQL (at-risk, huecos, stock bajo, anomalías de ingresos, upsell por afinidad).
2. Groq redacta título/cuerpo/necesidad con tono de asesor comercial.
3. Persiste en `ai_insights` con `data jsonb` → botón "Ver clientes" abre la lista exacta.

Tipos: `OPPORTUNITY · ALERT · ANOMALY · AT_RISK · WEAK_SLOTS · REBOOKING · UPSELL · LOW_STOCK`.

### Prompts (sistema)

"Actúas como el copiloto comercial de {negocio}. Respondes en español, breve y accionable.
SOLO usas cifras devueltas por tools. Si no hay datos, dices que no hay datos.
Muestras montos en S/ con precisión exacta. Sugieres UNA acción concreta cuando aportes recomendaciones."

## WhatsApp (§33) — arquitectura lista hoy, proveedor después

`automation_rules` (trigger + plantilla + delay) → job evalúa triggers → renderiza plantilla →
`whatsapp_messages` (`QUEUED`) → worker envía por Meta Cloud API / Evolution API / Twilio
(interfaz única `WhatsAppProvider`) → marca `SENT|FAILED`. Flujos: confirmación, recordatorio 24 h,
gracias post-visita, rebooking a X días, recuperación de huecos, lista de espera, cumpleaños, promos
(con opt-in). El **Centro WhatsApp** del dashboard gestiona plantillas y estados.

## Validación y errores

- Zod en Edge Functions; constraints en SQL (doble cierre).
- Errores tipados `{ code, message, details }` → toasts amables; nunca stack traces al cliente.
- Todo mutation responde con feedback + `undo` cuando sea posible (§51: deshacer cancelaciones/marketing).
