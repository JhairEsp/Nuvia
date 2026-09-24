import { useEffect, useState } from "react";
import { Check, X, Building2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { useSession } from "../../store/session";
import { FEATURE_LABELS, limitText, planError, storageText, useCapabilities } from "../../store/capabilities";
import { supabase } from "../../lib/supabase";
import { money } from "../../lib/format";

export function PlanCatalog() {
  const { catalog, loadCatalog, current } = useCapabilities();
  const bid = useSession(s => s.businessId); const role = useSession(s => s.membership?.roleCode);
  const navigate = useNavigate(); const [error, setError] = useState(""); const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { void loadCatalog().catch(e => setError(planError(e))); }, [loadCatalog]);
  return <div className="space-y-4">
    {error && <p role="alert" className="text-danger">{error}</p>}
    <div className="grid md:grid-cols-2 gap-5">{catalog.map(p => {
      const business = p.code === "BUSINESS";
      const rows: [string, boolean][] = [
        [p.limits.max_employees === null ? "Trabajadores ilimitados" : `Hasta ${p.limits.max_employees} trabajadores`, true],
        [p.limits.max_monthly_appointments === null ? "Citas ilimitadas" : `${p.limits.max_monthly_appointments} citas mensuales`, true],
        [storageText(Number(p.limits.max_storage_mb) * 1048576), true],
        [p.limits.max_branches === null ? "Sucursales ilimitadas" : `${p.limits.max_branches} sucursal${p.limits.max_branches === 1 ? "" : "es"}`, true],
        ["Página web", !!p.modules.website], ["Fidelización", !!p.modules.loyalty], ["Copiloto IA", !!p.modules.ai], ["WhatsApp", !!p.modules.whatsapp], ["Multisucursal", !!p.modules.multibranch],
      ];
      return <Card key={p.id} className={business ? "border-accent/50" : ""}><CardHeader><CardTitle className="flex items-center gap-2">{business ? <Building2 className="h-5 w-5 text-accent" /> : <Sparkles className="h-5 w-5 text-accent" />}{p.name}</CardTitle>{current?.capabilities.planId === p.id && <Badge tone="accent">Mi plan</Badge>}</CardHeader><CardContent className="space-y-5">
        <p className="text-[2.5rem] font-semibold num">{money(Number(p.price_monthly))}<span className="text-body text-muted font-normal"> / mes</span></p><p className="text-body text-muted min-h-12">{p.description}</p>
        <ul className="space-y-3">{rows.map(([label, yes]) => <li key={label} className="flex items-center gap-3 text-body">{yes ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-faint" />}{label}</li>)}</ul>
        <Button className="w-full" variant={business ? "primary" : "secondary"} loading={busy === p.id} disabled={busy !== null || current?.capabilities.planId === p.id || (!!bid && role !== "BUSINESS_ADMIN")} onClick={async () => {
          if (!bid) { navigate("/login"); toast.info("Inicia sesión con tu negocio para solicitar este plan."); return; }
          setBusy(p.id); try { const r = await supabase.rpc("request_plan_change", { p_business_id: bid, p_plan_id: p.id }); if (r.error) throw r.error; toast.success("Solicitud enviada al administrador de la plataforma", { description: "Tu plan actual no cambia hasta que sea aprobado. No se realizó ningún cobro." }); } catch (e) { toast.error(planError(e)); } finally { setBusy(null); }
        }}>{business ? "Elegir Business" : "Comenzar con Starter"}</Button>
      </CardContent></Card>;
    })}</div>
    {catalog.length > 0 && <div className="overflow-x-auto rounded-2xl border border-hairline"><table className="w-full text-body text-left"><caption className="p-4 text-headline font-semibold text-left">Comparativa de planes</caption><thead><tr className="border-b border-hairline"><th className="p-4">Capacidad</th>{catalog.map(p=><th className="p-4" key={p.id}>{p.name}</th>)}</tr></thead><tbody>{[
      { label: "Trabajadores", value: (p: typeof catalog[number]) => limitText(p.limits.max_employees) },
      { label: "Citas por mes", value: (p: typeof catalog[number]) => limitText(p.limits.max_monthly_appointments, "Ilimitadas") },
      { label: "Almacenamiento", value: (p: typeof catalog[number]) => storageText(Number(p.limits.max_storage_mb)*1048576) },
      { label: "Sucursales", value: (p: typeof catalog[number]) => limitText(p.limits.max_branches, "Ilimitadas") },
      ...Object.entries({ website: "Web del negocio", loyalty: "Programa de fidelización", ai: "Copiloto con IA", whatsapp: "Centro WhatsApp", multibranch: "Gestión multisucursal" }).map(([key,label])=>({label,value:(p: typeof catalog[number])=>p.modules[key]?"Incluido":"No incluido"})),
    ].map(row=><tr className="border-t border-hairline" key={row.label}><th className="p-4 font-medium">{row.label}</th>{catalog.map(p=><td className="p-4" key={p.id}>{row.value(p)}</td>)}</tr>)}</tbody></table></div>}
    <p className="text-body text-muted">Ambos planes comparten clientes, servicios, agenda, dashboard, inventario, POS, equipo, historial, reportes y configuración. Starter es para una ubicación; Business permite crecer con múltiples sucursales.</p>
    <p className="text-caption text-muted">Los cambios se solicitan a la plataforma; no se modifica la suscripción ni se procesa un pago desde estos botones. WhatsApp y otros proveedores externos requieren su configuración y pueden tener costos propios.</p>
  </div>;
}
export default function PlanPage() {
  const bid = useSession(s => s.businessId); const state = useCapabilities();
  useEffect(() => { if (bid) void state.refresh(bid); }, [bid]);
  const data = state.current; const c = data?.capabilities; const u = data?.usage;
  return <div className="space-y-6"><div><p className="text-caption text-muted">Configuración / Plan y facturación</p><h1 className="text-title font-semibold">Mi plan</h1></div>
    {state.error && <p role="alert" className="text-danger">{state.error}</p>}
    {c && u && <Card><CardHeader><CardTitle>{c.name} · {money(c.priceMonthly)} / mes</CardTitle><Badge>{c.subscriptionStatus}</Badge></CardHeader><CardContent className="space-y-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{[
        ["Trabajadores", c.maxWorkers === null ? `Ilimitados · ${u.workers} registrados` : `${u.workers} / ${limitText(c.maxWorkers)}`],
        ["Citas este mes", c.maxMonthlyAppointments === null ? `Ilimitadas · ${u.appointments} utilizadas` : `${u.appointments} / ${limitText(c.maxMonthlyAppointments)}`],
        ["Almacenamiento", `${storageText(u.storageBytes)} / ${storageText(c.maxStorageMb * 1048576)}`],
        ["Sucursales", c.maxBranches === null ? `${u.branches} · Sin límite` : `${u.branches} / ${c.maxBranches}`],
      ].map(([label, value]) => <div key={label} className="rounded-2xl bg-subtle p-4"><p className="text-caption text-muted">{label}</p><p className="text-headline font-semibold num mt-2">{value}</p></div>)}</div>
      <p className="text-caption text-muted">Consumo de todo el negocio, no solo la sucursal seleccionada. Mes según {data.timezone}. Las canceladas no atendidas no consumen; las completadas conservan su cupo. Trabajadores y sucursales inactivos también cuentan.</p>
      <div className="flex flex-wrap gap-2">{Object.entries(FEATURE_LABELS).map(([key, label]) => <Badge key={key} tone={c[key as keyof typeof FEATURE_LABELS] ? "success" : "neutral"}>{c[key as keyof typeof FEATURE_LABELS] ? "✓" : "✕"} {label}</Badge>)}</div>
      <Button size="sm" variant="quiet" onClick={() => bid && void state.refresh(bid)} disabled={state.loading}>Actualizar consumo</Button>
    </CardContent></Card>}
    <h2 className="text-headline font-semibold">Planes disponibles</h2><PlanCatalog />
  </div>;
}
