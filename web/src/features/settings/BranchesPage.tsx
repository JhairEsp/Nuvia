import { useEffect, useState } from "react";
import { Building2, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Modal } from "../../components/ui/overlay";
import { Field, Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { DataTable } from "../../components/ui/table";
import { useCapabilities, planError, type Branch } from "../../store/capabilities";
import { useSession, usePermission } from "../../store/session";
import { useDB } from "../../store/db";
import { supabase } from "../../lib/supabase";
import { money } from "../../lib/format";
import { loadBookingHours, bookingHoursError } from "./booking-hours";

type Hour = { weekday: number; open_time: string; close_time: string; is_closed: boolean };
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export function BranchScope() {
  const branches = useCapabilities(s => s.branches); const c = useCapabilities(s => s.current?.capabilities);
  const locationId = useDB(s => s.locationId); const change = useDB(s => s.setLocation);
  if (!c || (!c.multiBranch && branches.length <= 1)) return null;
  return <div className="flex flex-wrap items-center gap-3 mb-6 rounded-2xl bg-subtle p-3"><Building2 className="h-4 w-4 text-accent" /><label htmlFor="branch-scope" className="text-caption font-semibold">Sucursal</label><select id="branch-scope" className="bg-surface rounded-xl px-3 py-2 text-body border border-hairline" value={locationId ?? ""} onChange={e => void change(e.target.value || null)}><option value="">Todas · información consolidada</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}{!b.active && " (inactiva)"}</option>)}</select><span className="text-caption text-muted">Selecciona una sucursal para registrar operaciones.</span></div>;
}
function BranchEditor({ branch, bid, close }: { branch: Branch | null; bid: string; close: () => void }) {
  const [form, setForm] = useState({ name: branch?.name ?? "", address: branch?.address ?? "", phone: branch?.phone ?? "", city: branch?.city ?? "", active: branch?.active ?? true });
  const [hours, setHours] = useState<Hour[]>(DAYS.map((_, weekday) => ({ weekday, open_time: "", close_time: "", is_closed: true })));
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [ready, setReady] = useState(!branch);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!branch) return;
    let active = true; setReady(false); setError("");
    void loadBookingHours(bid, branch.id).then(result => {
      if (active) { setHours(result.hours); setReady(true); }
    }).catch(err => { if (active) setError(planError(err)); });
    return () => { active = false; };
  }, [bid, branch?.id, retry]);
  return <Modal open onClose={() => !busy && close()} className="max-h-[90vh] overflow-y-auto max-w-2xl"><form className="space-y-4" onSubmit={async e => { e.preventDefault(); const invalid = bookingHoursError(hours); if (invalid) { setError(invalid); return; } setBusy(true); setError(""); try { const r = await supabase.rpc("save_branch", { p_business_id: bid, p_id: branch?.id ?? null, p_data: { ...form, hours } }); if (r.error) throw r.error; await useCapabilities.getState().refresh(bid); await useDB.getState().load(bid); toast.success("Sucursal guardada"); close(); } catch (err) { setError(planError(err)); } finally { setBusy(false); } }}>
    <h2 className="text-title font-semibold">{branch ? "Editar sucursal" : "Crear sucursal"}</h2><fieldset disabled={busy || !ready} className="space-y-4"><div className="grid sm:grid-cols-2 gap-3">{([['name','Nombre'],['address','Dirección'],['city','Ciudad'],['phone','Teléfono']] as const).map(([key,label]) => <Field key={key} label={label}><Input aria-label={label} required={key==='name'} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></Field>)}</div>
    <label className="flex items-center gap-2 text-body"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />Sucursal activa</label><h3 className="font-semibold">Horarios de esta sucursal</h3>
    {hours.map((h,i) => <div key={h.weekday} className="flex flex-wrap gap-2 items-center"><label className="text-caption w-28 flex items-center gap-2"><input type="checkbox" checked={!h.is_closed} onChange={e => setHours(hours.map((x,j) => j===i ? { ...x, is_closed: !e.target.checked } : x))} />{DAYS[h.weekday]}</label>{!h.is_closed ? <><Input aria-label={`Apertura ${DAYS[h.weekday]}`} className="w-32" type="time" required value={h.open_time.slice(0,5)} onChange={e => setHours(hours.map((x,j) => j===i ? { ...x, open_time: e.target.value } : x))} /><Input aria-label={`Cierre ${DAYS[h.weekday]}`} className="w-32" type="time" required value={h.close_time.slice(0,5)} onChange={e => setHours(hours.map((x,j) => j===i ? { ...x, close_time: e.target.value } : x))} /></> : <span className="text-caption text-muted">Cerrado</span>}</div>)}
    </fieldset>{error && <div className="space-y-2"><p role="alert" className="text-danger text-caption">{error}</p>{!ready && <Button type="button" variant="quiet" onClick={() => setRetry(v => v + 1)}>Reintentar horarios</Button>}</div>}<p className="text-caption text-muted">Desactivar conserva el historial y deja de ofrecer reservas públicas. No libera una ubicación de la cuota.</p><Button type="submit" loading={busy} disabled={!ready}>Guardar sucursal</Button>
  </form></Modal>;
}
export default function BranchesPage() {
  const canManage = usePermission("settings.manage");
  const bid = useSession(s => s.businessId); const state = useCapabilities(); const [editing, setEditing] = useState<Branch | "new" | null>(null);
  useEffect(() => { if (bid) void state.refresh(bid); }, [bid]);
  const c = state.current?.capabilities;
  return <div className="space-y-6"><div className="flex justify-between items-center gap-3"><div><h1 className="text-title font-semibold">Sucursales</h1><p className="text-body text-muted">Ubicaciones, horarios y gestión centralizada.</p></div><Button size="sm" disabled={!c || !canManage} onClick={() => { if (!c) return; if ((!c.multiBranch && state.branches.length > 0) || (c.maxBranches !== null && state.branches.length >= c.maxBranches)) { toast.error("La gestión de múltiples sucursales está disponible en el plan Business."); return; } setEditing("new"); }}><Plus className="h-4 w-4" />Nueva sucursal</Button></div>
    {state.error && <p role="alert" className="text-danger">{state.error}</p>}
    <div className="grid md:grid-cols-2 gap-4">{state.branches.map(b => <Card key={b.id}><CardHeader><CardTitle>{b.name}</CardTitle><Badge tone={b.active ? "success" : "neutral"}>{b.active ? "Activa" : "Inactiva"}</Badge></CardHeader><CardContent className="space-y-3"><p className="text-caption text-muted">{b.address || "Sin dirección"} · {b.city}</p>{b.is_default && <Badge>Principal</Badge>}<div className="flex gap-2"><Button size="sm" variant="quiet" disabled={!canManage} onClick={() => setEditing(b)}><Pencil className="h-4 w-4" />Editar</Button><Button size="sm" variant="secondary" onClick={() => void useDB.getState().setLocation(b.id)}>Seleccionar sucursal</Button></div></CardContent></Card>)}</div>
    <p className="text-caption text-muted">Los clientes y su historial se comparten dentro del negocio. Trabajadores, servicios, citas, existencias y ventas pertenecen a una sucursal. Ningún dato se comparte con otros negocios.</p>
    <BranchReport />
    {editing && bid && <BranchEditor bid={bid} branch={editing === "new" ? null : editing} close={() => setEditing(null)} />}
  </div>;
}
export function BranchReport() {
  const allowed = usePermission("reports.view");
  const bid = useSession(s => s.businessId); const locationId = useDB(s => s.locationId);
  const [rows, setRows] = useState<Array<{ id: string; name: string; workers: number; appointments: number; revenue: number; stock_units: number }>>([]); const [error, setError] = useState("");
  const timezone = useDB(s => s.business.timezone);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [from, setFrom] = useState(today.slice(0,7)+"-01"); const [to,setTo] = useState(today);
  useEffect(() => { setFrom(today.slice(0,7)+"-01"); setTo(today); }, [bid,timezone]);
  useEffect(() => { if (!bid || !allowed) return; let active = true; setError(""); setRows([]); void (async () => { const r = await supabase.rpc("get_branch_report_dates", { p_business_id: bid, p_location_id: locationId, p_from_date: from, p_to_date: to }); if (!active) return; if (r.error) { setError(planError(r.error)); setRows([]); } else setRows(r.data.branches); })(); return () => { active=false; }; },[bid,locationId,from,to,allowed]);
  if (!allowed) return null;
  const total=rows.reduce((a,r)=>a+Number(r.revenue),0);
  return <Card><CardHeader><CardTitle>Reporte por sucursal · consolidado</CardTitle><Badge>{money(total)}</Badge></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-3"><Field label="Desde"><Input type="date" required value={from} onChange={e=>e.target.value && setFrom(e.target.value)} /></Field><Field label="Hasta"><Input type="date" required value={to} onChange={e=>e.target.value && setTo(e.target.value)} /></Field></div>{error ? <p role="alert" className="text-caption text-danger">{error}</p> : <DataTable head={["Sucursal","Trabajadores","Citas","Ventas","Stock actual"]} rows={rows.map(r=>[r.name,r.workers,r.appointments,money(Number(r.revenue)),r.stock_units])} />}<p className="text-caption text-muted">Fechas en {timezone}. Ventas pagadas y citas no canceladas del período. Trabajadores y existencias actuales. Las métricas se agregan en el servidor, sin topes de paginación.</p></CardContent></Card>;
}
