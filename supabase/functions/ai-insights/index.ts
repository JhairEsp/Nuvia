// ============================================================================
// 🔔 Edge Function: ai-insights — Insights diarios (§31)
// 1) Heurísticas SQL sobre datos reales (at-risk, huecos débiles, stock bajo…)
// 2) Groq redacta título/cuerpo con tono de asesor comercial
// 3) Persiste en ai_insights con data.jsonb → botón "Ver clientes"
// Deploy: supabase functions deploy ai-insights
// Cron:   pg_cron diario o Supabase Scheduler (08:00 America/Lima)
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("INSIGHTS_CRON_SECRET");
  if (req.method !== "POST" || !cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("No autorizado", { status: 403 });
  }
  // Cliente service_role: job de sistema (no expuesto al frontend)
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const groqKey = Deno.env.get("GROQ_API_KEY");

  const { data: businesses } = await supa
    .from("businesses").select("id, name").in("status", ["ACTIVE", "TRIAL"]);
  if (!businesses?.length) return new Response("ok", { status: 200 });

  const created: string[] = [];
  for (const biz of businesses) {
    // 1) Heurísticas sobre métricas REALES (nunca inventadas)
    const { data: metrics, error: metricsError } = await supa.rpc("system_ai_metrics", { p_business_id: biz.id });
    if (metricsError || !metrics) continue;
    const { atRisk, kpis, lowStock } = metrics;

    const raw: Array<{ type: string; severity: string; metric: string; data: unknown }> = [];
    if (Array.isArray(atRisk) && atRisk.length >= 2) {
      raw.push({ type: "AT_RISK", severity: "warning", metric: "at_risk_clients",
        data: { customer_ids: atRisk.map((c: { customer_id: string }) => c.customer_id), rows: atRisk } });
    }
    if (lowStock?.length) {
      raw.push({ type: "LOW_STOCK", severity: "critical", metric: "low_stock",
        data: { products: lowStock } });
    }
    if (kpis && Number(kpis.appointments) > 0 && Number(kpis.cancelled) / Number(kpis.appointments) > 0.25) {
      raw.push({ type: "ANOMALY", severity: "warning", metric: "high_cancellation", data: kpis });
    }
    if (!raw.length) continue;

    // 2) Groq redacta — SIEMPRE sobre los datos anteriores, jamás los sustituye
    let insights = raw.map((r) => ({ ...r, title: String(r.metric), body: "" }));
    if (groqKey) {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GROQ_MODEL, temperature: 0.3,
          messages: [
            { role: "system", content:
              "Redactas insights comerciales para dueños de negocios de belleza en español. " +
              "Te doy datos JSON reales; escribes UN título (<60 car.) y un cuerpo (2-3 frases) + UNA acción concreta. " +
              "No inventes cifras: usa solo las del JSON. Devuelve JSON [{type,severity,title,body}]." },
            { role: "user", content: JSON.stringify(raw) },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        try {
          const parsed = JSON.parse((await res.json()).choices?.[0]?.message?.content ?? "{}");
          const list = Array.isArray(parsed) ? parsed : parsed.insights;
          if (Array.isArray(list)) {
            insights = raw.map((r, i) => ({ ...r, title: String(list[i]?.title ?? r.metric).slice(0,80), body: String(list[i]?.body ?? "").slice(0,600) }));
          }
        } catch { /* se conservan los insights crudos */ }
      }
    }

    // 3) Persistir
    for (const ins of insights) {
      const { error } = await supa.from("ai_insights").insert({
        business_id: biz.id,
        type: ins.type,
        severity: ins.severity,
        title: ins.title,
        body: ins.body,
        data: ins.data,
      });
      if (!error) created.push(`${biz.name}: ${ins.title}`);
    }
  }

  return new Response(JSON.stringify({ created }), { headers: { "Content-Type": "application/json" } });
});
