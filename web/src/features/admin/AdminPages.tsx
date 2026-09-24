import { supabase } from "../../lib/supabase";
import { storageText } from "../../store/capabilities";
import { Building2, CreditCard, FileClock, Pencil, Plus, RefreshCw, Search, ShieldAlert, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { DataTable } from "../../components/ui/table";
import { Field, Input, Textarea } from "../../components/ui/input";
import { Modal } from "../../components/ui/overlay";
import { dayLabel, money } from "../../lib/format";
import { useDB } from "../../store/db";
import { useSession } from "../../store/session";
import { adminError, adminOptions, deleteAdmin, listAdmin, manageUser, PAGE_SIZE, saveAdmin, type AdminOptions, type BusinessRecord, type Entity, type MemberRecord, type PlanRecord, type UserRecord } from "../../lib/platform-admin";

const EMPTY_OPTIONS: AdminOptions = { businesses: [], plans: [], roles: [], employees: [] };
function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="w-full h-11 px-3 rounded-[var(--radius-control)] bg-subtle text-body border border-hairline focus:outline-accent disabled:opacity-50" />;
}
function ErrorBox({ message }: { message: string }) {
  return message ? <p role="alert" className="text-caption text-danger bg-danger/10 rounded-xl p-3">{message}</p> : null;
}
function useAdminList<T>(entity: Entity) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [options, setOptions] = useState(EMPTY_OPTIONS);
  const request = useRef(0);
  useEffect(() => { const t = setTimeout(() => { setTerm(search); setPage(0); }, 250); return () => clearTimeout(t); }, [search]);
  const reload = useCallback(async () => {
    const version = ++request.current;
    setLoading(true); setError("");
    try {
      const [result, choices] = await Promise.all([listAdmin<T>(entity, page, term), adminOptions()]);
      if (version !== request.current) return;
      setRows(result.rows); setTotal(result.total); setOptions(choices);
      if (page > 0 && page * PAGE_SIZE >= result.total) setPage(Math.max(0, Math.ceil(result.total / PAGE_SIZE) - 1));
    } catch (e) { if (version === request.current) { setRows([]); setError(adminError(e)); } }
    finally { if (version === request.current) setLoading(false); }
  }, [entity, page, term]);
  useEffect(() => { void reload(); return () => { request.current++; }; }, [reload]);
  return { rows, total, page, setPage, search, setSearch, loading, error, options, reload };
}
type ListState = ReturnType<typeof useAdminList<unknown>>;
function PageFrame({ title, description, createLabel, onCreate, state, children }: { title: string; description: string; createLabel: string; onCreate: () => void; state: ListState; children: ReactNode }) {
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between items-center gap-3"><div><h1 className="text-title font-semibold tracking-tight">{title}</h1><p className="text-body text-muted">{description}</p></div>
      <Button size="sm" onClick={onCreate} disabled={state.loading || !!state.error}><Plus className="h-4 w-4" />{createLabel}</Button></div>
    <div className="flex items-center gap-3"><Search className="h-4 w-4 text-muted" /><Input aria-label={`Buscar ${title.toLowerCase()}`} placeholder="Buscar por nombre, correo o código…" value={state.search} onChange={e => state.setSearch(e.target.value)} /><Button variant="quiet" size="icon" aria-label="Actualizar lista" onClick={() => void state.reload()} disabled={state.loading}><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} /></Button></div>
    <ErrorBox message={state.error} />
    {state.loading ? <Card><CardContent><p role="status" className="py-10 text-center text-muted">Cargando registros…</p></CardContent></Card> : !state.error && children}
    {!state.error && <div className="flex items-center justify-between gap-3 text-caption text-muted"><span>{state.total} registros · Página {state.page + 1} de {Math.max(1, Math.ceil(state.total / PAGE_SIZE))}</span><div className="flex gap-2"><Button size="sm" variant="quiet" disabled={state.loading || state.page === 0} onClick={() => state.setPage(state.page - 1)}>Anterior</Button><Button size="sm" variant="quiet" disabled={state.loading || (state.page + 1) * PAGE_SIZE >= state.total} onClick={() => state.setPage(state.page + 1)}>Siguiente</Button></div></div>}
  </div>;
}
function Editor({ title, onClose, onSave, children }: { title: string; onClose: () => void; onSave: () => Promise<void>; children: ReactNode }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const lock = useRef(false);
  return <Modal open onClose={() => !lock.current && onClose()} labelledBy="admin-editor-title" className="max-w-2xl max-h-[90vh] overflow-y-auto">
    <form className="space-y-5" onSubmit={async e => { e.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError(""); try { await onSave(); onClose(); } catch (err) { setError(adminError(err)); } finally { setBusy(false); lock.current = false; } }}>
      <h2 id="admin-editor-title" className="text-title font-semibold pr-8">{title}</h2>
      <fieldset disabled={busy} className="space-y-4">{children}</fieldset><ErrorBox message={error} />
      <div className="flex justify-end gap-2"><Button type="button" variant="quiet" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" loading={busy}>Guardar cambios</Button></div>
    </form>
  </Modal>;
}
function DeleteDialog({ name, description, onClose, onDelete }: { name: string; description: string; onClose: () => void; onDelete: () => Promise<void> }) {
  const [confirmation, setConfirmation] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const lock = useRef(false);
  return <Modal open onClose={() => !lock.current && onClose()} labelledBy="delete-title"><div className="space-y-4">
    <Trash2 className="h-7 w-7 text-danger" /><h2 id="delete-title" className="text-title font-semibold">Eliminar registro</h2>
    <p className="text-body text-muted">{description}</p><p className="text-caption">Esta acción es irreversible. Escribe <strong className="break-all">{name}</strong> para confirmar.</p>
    <Input aria-label="Confirmación de eliminación" value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)} autoComplete="off" />
    <ErrorBox message={error} /><div className="flex justify-end gap-2"><Button variant="quiet" disabled={busy} onClick={onClose}>Cancelar</Button><Button variant="danger" loading={busy} disabled={confirmation !== name} onClick={async () => { if (lock.current) return; lock.current = true; setBusy(true); setError(""); try { await onDelete(); onClose(); } catch (e) { setError(adminError(e)); } finally { setBusy(false); lock.current = false; } }}>Eliminar definitivamente</Button></div>
  </div></Modal>;
}
function Actions({ name, onEdit, onDelete, preventDelete }: { name: string; onEdit: () => void; onDelete: () => void; preventDelete?: boolean }) {
  return <div className="flex justify-end gap-1"><Button size="sm" variant="quiet" aria-label={`Editar ${name}`} onClick={onEdit}><Pencil className="h-3.5 w-3.5" />Editar</Button><Button size="icon" variant="ghost" className="text-danger" disabled={preventDelete} title={preventDelete ? "No puedes eliminar tu propia cuenta" : `Eliminar ${name}`} aria-label={`Eliminar ${name}`} onClick={onDelete}><Trash2 className="h-4 w-4" /></Button></div>;
}
function latestSubscription(b: BusinessRecord) { return [...(b.subscriptions ?? [])].sort((a, z) => z.created_at.localeCompare(a.created_at) || z.id.localeCompare(a.id))[0]; }
const businessTypes: Record<string, string> = { BARBERSHOP: "Barbería", SALON: "Salón", SPA: "Spa", AESTHETICS: "Estética", NAILS: "Uñas", LASHES: "Pestañas", BROWS: "Cejas", MASSAGE: "Masajes", OTHER: "Otro" };
function BusinessEditor({ record, options, onClose, saved }: { record: BusinessRecord | null; options: AdminOptions; onClose: () => void; saved: () => Promise<void> }) {
  const sub = record ? latestSubscription(record) : undefined;
  const [form, setForm] = useState({ name: record?.name ?? "", slug: record?.slug ?? "", type: record?.type ?? "BARBERSHOP", status: record?.status ?? "TRIAL", email: record?.email ?? "", phone: record?.phone ?? "", whatsapp: record?.whatsapp ?? "", address: record?.address ?? "", description: record?.description ?? "", plan_id: sub?.plan_id ?? (!record ? options.plans.find(p => p.code === "STARTER" && p.is_active)?.id ?? options.plans.find(p => p.is_active)?.id ?? "" : ""), subscription_status: sub?.status ?? "TRIALING" });
  const change = (key: keyof typeof form, value: string) => setForm(f => ({ ...f, [key]: value }));
  return <Editor title={record ? "Editar negocio" : "Crear negocio"} onClose={onClose} onSave={async () => { await saveAdmin("businesses", record?.id ?? null, form); toast.success(record ? "Negocio actualizado" : "Negocio creado"); await saved(); }}>
    <div className="grid sm:grid-cols-2 gap-4"><Field label="Nombre"><Input aria-label="Nombre" required maxLength={200} value={form.name} onChange={e => change("name", e.target.value)} /></Field><Field label="Slug público"><Input aria-label="Slug público" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} placeholder="mi-negocio" onChange={e => change("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} /></Field>
      <Field label="Tipo"><Select aria-label="Tipo" value={form.type} onChange={e => change("type", e.target.value)}>{Object.entries(businessTypes).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field><Field label="Estado"><Select aria-label="Estado" value={form.status} onChange={e => change("status", e.target.value)}>{["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"].map(v => <option key={v}>{v}</option>)}</Select></Field>
      <Field label="Correo de contacto"><Input aria-label="Correo de contacto" type="email" value={form.email} onChange={e => change("email", e.target.value)} /></Field><Field label="Teléfono"><Input aria-label="Teléfono" type="tel" value={form.phone} onChange={e => change("phone", e.target.value)} /></Field><Field label="WhatsApp"><Input aria-label="WhatsApp" type="tel" value={form.whatsapp} onChange={e => change("whatsapp", e.target.value)} /></Field><Field label="Dirección"><Input aria-label="Dirección" value={form.address} onChange={e => change("address", e.target.value)} /></Field>
      <Field label="Plan"><Select aria-label="Plan" value={form.plan_id} onChange={e => change("plan_id", e.target.value)}><option value="">Sin plan / cancelar suscripción</option>{options.plans.map(p => <option key={p.id} value={p.id} disabled={!p.is_active && p.id !== sub?.plan_id}>{p.name}{!p.is_active && " (inactivo)"}</option>)}</Select></Field><Field label="Estado de suscripción"><Select aria-label="Estado de suscripción" disabled={!form.plan_id} value={form.subscription_status} onChange={e => change("subscription_status", e.target.value)}>{["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED"].map(v => <option key={v}>{v}</option>)}</Select></Field>
    </div><Field label="Descripción"><Textarea aria-label="Descripción" value={form.description} onChange={e => change("description", e.target.value)} /></Field>
    <p className="text-caption text-muted">Crear el negocio no crea una cuenta. Asigna sus administradores desde Usuarios. Cambiar el slug cambia la dirección pública.</p>
  </Editor>;
}
export function AdminBusinesses() {
  const state = useAdminList<BusinessRecord>("businesses"); const [edit, setEdit] = useState<BusinessRecord | "new" | null>(null); const [remove, setRemove] = useState<BusinessRecord | null>(null);
  const saved = async () => { await state.reload(); void useDB.getState().loadPlatform(); };
  return <><PageFrame title="Negocios" description="Gestiona negocios, suscripciones y estados de acceso." createLabel="Crear negocio" onCreate={() => setEdit("new")} state={state}>
    <Card><CardContent><DataTable head={["Negocio", "Tipo", "Plan", "Estado", "Acciones"]} rows={state.rows.map(b => { const sub = latestSubscription(b); return [<div key="n"><p className="font-medium">{b.name}</p><p className="text-caption text-muted">/b/{b.slug}</p></div>, businessTypes[b.type] ?? b.type, state.options.plans.find(p => p.id === sub?.plan_id)?.name ?? "Sin plan", <Badge key="s" tone={b.status === "ACTIVE" ? "success" : b.status === "TRIAL" ? "accent" : "danger"}>{b.status}</Badge>, <Actions key="a" name={b.name} onEdit={() => setEdit(b)} onDelete={() => setRemove(b)} />]; })} /></CardContent></Card>
  </PageFrame>{edit && <BusinessEditor record={edit === "new" ? null : edit} options={state.options} onClose={() => setEdit(null)} saved={saved} />}{remove && <DeleteDialog name={remove.name} description="Se eliminarán el negocio y sus datos asociados: citas, ventas, clientes, catálogo, membresías y sitio web. Las cuentas de acceso de sus usuarios se conservarán." onClose={() => setRemove(null)} onDelete={async () => { await deleteAdmin("businesses", remove.id); toast.success("Negocio eliminado"); await saved(); }} />}</>;
}

function PlanEditor({ record, availableCodes, onClose, saved }: { record: PlanRecord | null; availableCodes: string[]; onClose: () => void; saved: () => Promise<void> }) {
  const [form, setForm] = useState({ code: record?.code ?? availableCodes[0] ?? "STARTER", name: record?.name ?? "", description: record?.description ?? "", price: String(record?.price_monthly ?? 0), active: record?.is_active ?? true,
    workers: record?.limits?.max_employees == null ? "" : String(record.limits.max_employees), appointments: record?.limits?.max_monthly_appointments == null ? "" : String(record.limits.max_monthly_appointments),
    branches: record?.limits?.max_branches == null ? "" : String(record.limits.max_branches), storage: String(record?.limits?.max_storage_mb ?? ""), modules: record?.modules ?? { website: true, loyalty: true, ai: true, whatsapp: true, multibranch: false } });
  return <Editor title={record ? "Editar plan" : "Crear plan comercial"} onClose={onClose} onSave={async () => {
    const cap = (v: string) => v.trim() === "" ? null : Number(v);
    await saveAdmin("plans", record?.id ?? null, { code: form.code, name: form.name, description: form.description, price_monthly: Number(form.price),
      limits: { max_employees: cap(form.workers), max_monthly_appointments: cap(form.appointments), max_branches: cap(form.branches), max_storage_mb: Number(form.storage) }, modules: form.modules, is_active: form.active });
    toast.success("Plan guardado"); await saved();
  }}>
    <div className="grid sm:grid-cols-2 gap-4"><Field label="Código comercial"><Select aria-label="Código comercial" disabled={!!record} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}>{(record ? [record.code] : availableCodes).map(code => <option key={code}>{code}</option>)}</Select></Field><Field label="Nombre"><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
    <Field label="Precio mensual (S/)"><Input type="number" min="0" step="0.01" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></Field><Field label="Almacenamiento (MB)"><Input type="number" min="1" step="1" required value={form.storage} onChange={e => setForm({ ...form, storage: e.target.value })} /></Field>
    {([['workers','Trabajadores'],['appointments','Citas mensuales'],['branches','Sucursales']] as const).map(([key,label]) => <Field key={key} label={`${label} (vacío = ilimitado)`}><Input type="number" min="1" step="1" placeholder="Ilimitado" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></Field>)}</div>
    <Field label="Descripción"><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
    <div className="grid sm:grid-cols-2 gap-3">{Object.entries({ website: 'Página web', loyalty: 'Fidelización', ai: 'Copiloto IA', whatsapp: 'WhatsApp', multibranch: 'Multisucursal' }).map(([key,label]) => <label key={key} className="flex items-center gap-2 text-body"><input type="checkbox" checked={!!form.modules[key]} onChange={e => setForm({ ...form, modules: { ...form.modules, [key]: e.target.checked } })} />{label}</label>)}</div>
    <label className="flex items-center gap-2 text-body"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />Disponible para nuevas asignaciones</label>
    <p className="text-caption text-muted">Los cambios afectan a todos los negocios con este plan. Desactivar evita nuevas asignaciones, pero conserva las suscripciones existentes. No se realiza ningún cobro.</p>
  </Editor>;
}
function PlanRequests({ changed }: { changed: () => Promise<void> }) {
  const [requests, setRequests] = useState<Array<{ id: string; business_id: string; plan_id: string; businesses: { name: string }; plans: { name: string } }>>([]); const [error,setError] = useState(""); const [busy,setBusy]=useState<string|null>(null);
  const load = async () => { const r=await supabase.from("plan_change_requests").select("id,business_id,plan_id,businesses(name),plans(name)").eq("status","PENDING").order("created_at"); if(r.error) setError(adminError(r.error)); else { setError(""); setRequests((r.data ?? []) as unknown as typeof requests); } };
  useEffect(()=>{void load();},[]);
  return <Card><CardHeader><CardTitle>Solicitudes de cambio de plan</CardTitle><Button size="sm" variant="quiet" onClick={()=>void load()}>Actualizar</Button></CardHeader><CardContent className="space-y-3">{error && <ErrorBox message={error} />}{!error && !requests.length && <p className="text-caption text-muted">Sin solicitudes pendientes.</p>}{requests.map(r=><div key={r.id} className="flex flex-wrap gap-3 items-center justify-between"><p>{r.businesses.name} → {r.plans.name}</p><div className="flex gap-2">{[true,false].map(approve=><Button key={String(approve)} size="sm" variant={approve ? 'primary':'quiet'} disabled={busy!==null} onClick={async()=>{setBusy(r.id);try { const result=await supabase.rpc("admin_resolve_plan_request",{p_id:r.id,p_approve:approve});if(result.error)throw result.error;await load();await changed();toast.success(approve?'Plan asignado, sin ejecutar cobros':'Solicitud rechazada');}catch(e){toast.error(adminError(e));}finally{setBusy(null);}}}>{approve?'Aprobar':'Rechazar'}</Button>)}</div></div>)}</CardContent></Card>;
}
export function AdminPlans() {
  const state = useAdminList<PlanRecord>("plans"); const [edit,setEdit]=useState<PlanRecord|"new"|null>(null); const [remove,setRemove]=useState<PlanRecord|null>(null);
  const [usage,setUsage]=useState<Array<{ id:string; name:string; status:string; workers:number; appointments:number; branches:number; storage_bytes:number }>|null>(null);
  const saved=async()=>{await state.reload();void useDB.getState().loadPlatform();};
  const missing=['STARTER','BUSINESS'].filter(c=>!state.rows.some(p=>p.code===c));
  return <><PageFrame title="Planes" description="Solo Starter y Business. Capacidades y límites centralizados." createLabel="Crear plan" onCreate={()=>{if(state.options.plans.length>=2){toast.info('Ya existen los dos planes comerciales. Puedes editarlos o desactivarlos.');return;}setEdit('new');}} state={state}>
    <div className="grid md:grid-cols-2 gap-5">{state.rows.map(p=><Card key={p.id}><CardHeader><CardTitle>{p.name}</CardTitle><Badge tone={p.is_active?'success':'neutral'}>{p.is_active?'Activo':'Inactivo'}</Badge></CardHeader><CardContent className="space-y-4"><p className="text-[2rem] font-semibold num">{money(Number(p.price_monthly))}<span className="text-caption text-muted"> / mes</span></p><p className="text-caption text-muted">{p.description}</p><ul className="space-y-2 text-body"><li>{p.limits.max_employees===null?'Trabajadores ilimitados':`Hasta ${p.limits.max_employees} trabajadores`}</li><li>{p.limits.max_monthly_appointments===null?'Citas ilimitadas':`${p.limits.max_monthly_appointments} citas mensuales`}</li><li>{storageText(Number(p.limits.max_storage_mb)*1048576)}</li>{Object.entries({website:'Página web',loyalty:'Fidelización',ai:'Copiloto IA',whatsapp:'WhatsApp',multibranch:'Multisucursal'}).map(([k,label])=><li key={k}>{p.modules[k]?'✓':'✕'} {label}</li>)}</ul><Actions name={p.name} onEdit={()=>setEdit(p)} onDelete={()=>setRemove(p)} /><Button variant="secondary" size="sm" onClick={async()=>{const r=await supabase.rpc('admin_plan_businesses',{p_plan_id:p.id});if(r.error)toast.error(adminError(r.error));else setUsage(r.data);}}>Ver negocios y consumo</Button></CardContent></Card>)}</div>
  </PageFrame><div className="mt-6"><PlanRequests changed={saved}/></div>
  {edit && <PlanEditor record={edit==='new'?null:edit} availableCodes={missing} saved={saved} onClose={()=>setEdit(null)}/>}
  {remove && <DeleteDialog name={remove.name} description="Solo puedes eliminar un plan sin suscripciones ni solicitudes asociadas. Para conservar historial, desactívalo." onClose={()=>setRemove(null)} onDelete={async()=>{await deleteAdmin('plans',remove.id);toast.success('Plan eliminado');await saved();}}/>}
  {usage && <Modal open onClose={()=>setUsage(null)} className="max-w-4xl max-h-[85vh] overflow-auto"><h2 className="text-title font-semibold mb-5">Negocios y consumo actual</h2><DataTable head={['Negocio','Suscripción','Trabajadores','Citas / mes','Sucursales','Almacenamiento']} rows={usage.map(u=>[u.name,u.status,u.workers,u.appointments,u.branches,storageText(Number(u.storage_bytes))])}/></Modal>}
  </>;
}

function UserEditor({ record, options, onClose, saved }: { record: UserRecord | null; options: AdminOptions; onClose: () => void; saved: () => Promise<void> }) {
  const me = useSession(s => s.user?.id);
  const [form, setForm] = useState({ full_name: record?.full_name ?? "", email: record?.email ?? "", password: "", platform_role: record?.platform_role ?? "USER", memberships: (record?.business_users ?? []).map(m => ({ ...m })) });
  const memberChange = (i: number, patch: Partial<MemberRecord>) => setForm(f => ({ ...f, memberships: f.memberships.map((m, j) => j === i ? { ...m, ...patch } : m) }));
  return <Editor title={record ? "Editar usuario" : "Crear usuario"} onClose={onClose} onSave={async () => {
    const result = await manageUser(record ? "update" : "create", record?.id ?? null, form);
    if (record?.id === me) useSession.setState(s => ({ user: s.user ? { ...s.user, email: form.email.trim().toLowerCase(), fullName: form.full_name.trim() } : null }));
    toast.success(record ? "Usuario actualizado" : "Usuario creado"); if (result.warning) toast.warning(result.warning); await saved();
  }}><div className="grid sm:grid-cols-2 gap-4"><Field label="Nombre completo"><Input aria-label="Nombre completo" required maxLength={200} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></Field><Field label="Correo de acceso"><Input aria-label="Correo de acceso" type="email" required autoComplete="off" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
    {!record && <Field label="Contraseña (mínimo 12 caracteres)"><Input aria-label="Contraseña" required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></Field>}
    <Field label="Rol de plataforma"><Select aria-label="Rol de plataforma" value={form.platform_role} disabled={record?.id === me} onChange={e => setForm({ ...form, platform_role: e.target.value as UserRecord["platform_role"] })}><option value="USER">Usuario de negocio</option><option value="SUPER_ADMIN">Super Admin — acceso total</option></Select></Field></div>
    {form.platform_role === "SUPER_ADMIN" && <p className="text-caption text-accent bg-accent-soft rounded-xl p-3">Este rol permite administrar todos los negocios, usuarios y planes. No requiere una membresía de negocio.</p>}
    <div className="space-y-3"><div className="flex justify-between items-center"><h3 className="text-body font-semibold">Acceso a negocios</h3><Button type="button" size="sm" variant="quiet" disabled={form.memberships.length >= options.businesses.length || !options.roles.length} onClick={() => { const b = options.businesses.find(b => !form.memberships.some(m => m.business_id === b.id)); if (b) setForm({ ...form, memberships: [...form.memberships, { business_id: b.id, role_code: "BUSINESS_ADMIN", status: "ACTIVE", employee_id: null }] }); }}><Plus className="h-3.5 w-3.5" />Asignar negocio</Button></div>
      {form.memberships.length === 0 && <p className="text-caption text-muted">Sin membresías. Un usuario de negocio necesita al menos una membresía activa para trabajar.</p>}
      {form.memberships.map((m, i) => <div key={i} className="border border-hairline rounded-2xl p-4 space-y-3"><div className="flex justify-between items-center"><p className="text-caption font-semibold">Membresía {i + 1}</p><Button type="button" variant="ghost" size="icon" aria-label={`Quitar membresía ${i + 1}`} onClick={() => setForm({ ...form, memberships: form.memberships.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4 text-danger" /></Button></div><div className="grid sm:grid-cols-2 gap-3">
        <Field label="Negocio"><Select aria-label={`Negocio ${i + 1}`} required value={m.business_id} onChange={e => memberChange(i, { business_id: e.target.value, employee_id: null })}>{options.businesses.map(b => <option key={b.id} value={b.id} disabled={form.memberships.some((x, j) => j !== i && x.business_id === b.id)}>{b.name}</option>)}</Select></Field>
        <Field label="Rol en el negocio"><Select aria-label={`Rol ${i + 1}`} value={m.role_code} required onChange={e => memberChange(i, { role_code: e.target.value })}>{options.roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</Select></Field>
        <Field label="Estado de acceso"><Select aria-label={`Estado ${i + 1}`} value={m.status} onChange={e => memberChange(i, { status: e.target.value })}>{["ACTIVE", "INACTIVE", "SUSPENDED"].map(v => <option key={v}>{v}</option>)}</Select></Field>
        <Field label="Trabajador vinculado (opcional)"><Select aria-label={`Trabajador ${i + 1}`} value={m.employee_id ?? ""} onChange={e => memberChange(i, { employee_id: e.target.value || null })}><option value="">Sin vincular</option>{options.employees.filter(e => e.business_id === m.business_id).map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}</Select></Field>
      </div></div>)}
    </div><p className="text-caption text-muted">{record ? "Los cambios de correo también se aplican a la cuenta de acceso. No se modifica la contraseña." : "Se crea una cuenta confirmada mediante Supabase Auth. Comparte la contraseña con su titular por un canal seguro."}</p>
  </Editor>;
}
export function AdminUsers() {
  const state = useAdminList<UserRecord>("users"); const me = useSession(s => s.user?.id); const [edit, setEdit] = useState<UserRecord | "new" | null>(null); const [remove, setRemove] = useState<UserRecord | null>(null);
  const saved = async () => { await state.reload(); void useDB.getState().loadPlatform(); };
  return <><PageFrame title="Usuarios" description="Cuentas reales, roles de plataforma y acceso a negocios." createLabel="Crear usuario" onCreate={() => setEdit("new")} state={state}>
    <Card><CardContent><DataTable head={["Usuario", "Rol de plataforma", "Acceso a negocios", "Acciones"]} rows={state.rows.map(u => [<div key="n"><p className="font-medium flex items-center gap-2">{u.platform_role === "SUPER_ADMIN" && <ShieldAlert className="h-4 w-4 text-accent" />}{u.full_name || "Sin nombre"}{u.id === me && <Badge>Tú</Badge>}</p><p className="text-caption text-muted">{u.email}</p></div>, <Badge key="r" tone={u.platform_role === "SUPER_ADMIN" ? "accent" : "neutral"}>{u.platform_role}</Badge>, <div key="b" className="space-y-1 text-caption">{u.business_users.length ? u.business_users.map(m => <p key={m.business_id}>{state.options.businesses.find(b => b.id === m.business_id)?.name ?? "Negocio"}<span className="text-muted"> · {m.role_code} · {m.status}</span></p>) : <span className="text-muted">Sin membresías</span>}</div>, <Actions key="a" name={u.email} preventDelete={u.id === me} onEdit={() => setEdit(u)} onDelete={() => setRemove(u)} />])} /></CardContent></Card>
  </PageFrame>{edit && <UserEditor record={edit === "new" ? null : edit} options={state.options} onClose={() => setEdit(null)} saved={saved} />}{remove && <DeleteDialog name={remove.email} description="Se eliminarán la cuenta de acceso, su perfil y sus membresías. Se conservará el historial operativo con las referencias de autor desvinculadas. No puedes eliminar tu propia cuenta ni al último Super Admin." onClose={() => setRemove(null)} onDelete={async () => { const result = await manageUser("delete", remove.id); toast.success("Usuario eliminado"); if (result.warning) toast.warning(result.warning); await saved(); }} />}</>;
}
/* ── Auditoría (§38 trazabilidad) ───────────────────────────────────────── */
export function AdminAudit() {
  const db = useDB();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-semibold tracking-[-0.014em]">Auditoría</h1>
        <p className="text-body text-muted">Toda acción importante queda registrada: quién, qué, cuándo, antes/después</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileClock className="h-4 w-4 text-accent" /> Actividad</CardTitle>
          <Badge>{db.audit.length} eventos</Badge>
        </CardHeader>
        <CardContent className="space-y-1">
          {db.audit.map((a) => (
            <div key={a.id} className="flex items-start gap-4 p-3.5 rounded-[var(--radius-tile)] hover:bg-subtle transition-colors">
              <Badge tone={a.action === "PUBLISH" ? "accent" : a.action === "DELETE" ? "danger" : "neutral"}>{a.action}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-body truncate">{a.detail}</p>
                <p className="text-caption text-muted num">
                  {a.user} · {a.entity} · {dayLabel(a.at)}
                  {a.before && ` · antes: ${a.before} → después: ${a.after}`}
                </p>
              </div>
            </div>
          ))}
          {db.audit.length === 0 && <p className="text-body text-muted text-center py-6">Sin eventos</p>}
        </CardContent>
      </Card>
    </div>
  );
}

export const AdminIcons = { Building2, Users };
