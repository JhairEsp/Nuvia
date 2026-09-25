import { runMutation } from "../../lib/mutations";
import { useCapabilities, limitText } from "../../store/capabilities";
import { BadgePercent, Eye, EyeOff, Pencil, Plus, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, Input, Textarea } from "../../components/ui/input";
import { Modal } from "../../components/ui/overlay";
import { Switch } from "../../components/ui/switch";
import { money } from "../../lib/format";
import { useDB } from "../../store/db";
import type { Employee } from "../../types/domain";

import { uploadBusinessImage, mediaError } from "../../lib/business-media";
import { usePermission } from "../../store/session";

import { EMPLOYEE_ROLES, employeeRoleLabel } from "./roles";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const empty = (): Employee => ({
  id: crypto.randomUUID(),
  fullName: "", roleLabel: EMPLOYEE_ROLES[0], specialty: "", bio: "",
  commissionRate: 10, showOnWebsite: true, active: true, serviceIds: [],
});

export default function TeamPage() {
  const db = useDB();
  const [editing, setEditing] = useState<Employee | null>(null);
  const plan = useCapabilities(s => s.current);
  const [saving, setSaving] = useState(false);
  const [uploading,setUploading]=useState(false);const epoch=useRef(0);const canManage=usePermission('team.manage');
  useEffect(()=>{epoch.current++;setEditing(null);setUploading(false);setSaving(false);return()=>{epoch.current++;};},[db.businessId]);
  const uploadPhoto=async(file?:File)=>{if(!file||!editing||!db.businessId||uploading||saving)return;const token=epoch.current,id=editing.id;setUploading(true);try{
    const image=await uploadBusinessImage(db.businessId,file,'team',id);if(token!==epoch.current)return;
    setEditing(current=>current?.id===id?{...current,photoUrl:image.url}:current);toast.success('Foto subida. Guarda el trabajador para aplicar el cambio.');
  }catch(e){if(token===epoch.current)toast.error(mediaError(e));}finally{if(token===epoch.current)setUploading(false);}};
  const used = plan?.usage.workers ?? 0;
  const limit = plan?.capabilities.maxWorkers;
  const atLimit = limit != null && used >= limit;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title font-semibold tracking-[-0.014em]">Equipo</h1>
          <p className="text-body text-muted">{plan ? `${used} trabajadores registrados · ${limit === null ? "Ilimitados" : `límite ${limitText(limit ?? 0)}`}` : "Consultando el plan…"}</p>
        </div>
        <Button size="sm" disabled={!plan}
          onClick={() => { if (atLimit) { toast.error(`Has alcanzado el límite de ${limit} trabajadores de tu plan ${plan?.capabilities.name}. Actualiza a Business para agregar trabajadores ilimitados.`); return; } setEditing(empty()); }}>
          <Plus className="h-4 w-4" /> Nuevo trabajador
        </Button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {db.employees.map((e) => {
          const comm = db.commissions.filter((c) => c.employeeId === e.id);
          const total = comm.reduce((a, c) => a + c.amount, 0);
          const sales = comm.reduce((a, c) => a + c.base, 0);
          return (
            <Card key={e.id} className={e.active === false ? "opacity-55" : ""}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar name={e.fullName} src={e.photoUrl} size="lg" />
                  <div className="min-w-0">
                    <CardTitle className="truncate">{e.fullName.split(" ")[0]}</CardTitle>
                    <p className="text-caption text-accent font-medium">{employeeRoleLabel(e.roleLabel)}</p>
                  </div>
                </div>
                <Switch checked={e.showOnWebsite} label="Visible en la página"
                  onChange={(v) => void runMutation(() => db.saveEmployee({ ...e, showOnWebsite: v }), () => toast.success(v ? "Visible en tu página" : "Oculto de tu página"))} />
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-caption text-muted">{e.specialty || e.bio || "—"}</p>

                <div>
                  <p className="text-micro font-semibold uppercase tracking-wide text-faint mb-1.5">Servicios</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(e.serviceIds ?? []).map((sid) => {
                      const s = db.services.find((x) => x.id === sid);
                      return s ? <Badge key={sid}>{s.name}</Badge> : null;
                    })}
                    {(e.serviceIds ?? []).length === 0 && <span className="text-caption text-faint">Sin asignar</span>}
                  </div>
                </div>

                <div>
                  <p className="text-micro font-semibold uppercase tracking-wide text-faint mb-1.5">Horario semanal</p>
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS.map((d, i) => (
                      <div key={d} className={`text-center text-micro py-1.5 rounded-lg ${e.schedule?.[i] ? "bg-accent-soft text-accent font-semibold" : "bg-subtle text-faint"}`}>
                        {d}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 rounded-[var(--radius-tile)] bg-subtle text-center">
                  <div>
                    <p className="text-caption font-semibold num">{money(sales)}</p>
                    <p className="text-micro text-faint">ventas</p>
                  </div>
                  <div>
                    <p className="text-caption font-semibold num flex items-center justify-center gap-1"><BadgePercent className="h-3 w-3" />{e.commissionRate}%</p>
                    <p className="text-micro text-faint">comisión</p>
                  </div>
                  <div>
                    <p className="text-caption font-semibold num">{money(total)}</p>
                    <p className="text-micro text-faint">a pagar</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="quiet" className="flex-1" onClick={() => setEditing({...e,roleLabel:employeeRoleLabel(e.roleLabel)})}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => void runMutation(() => db.saveEmployee({ ...e, active: e.active === false }), () => toast.success(e.active === false ? "Trabajador activado" : "Trabajador desactivado"))}>
                    {e.active === false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editing && (
        <Modal open onClose={() => {if(!saving&&!uploading){epoch.current++;setEditing(null);}}} className="max-h-[90dvh] overflow-y-auto">
          <div className="space-y-4">
            <h2 className="text-title font-semibold tracking-[-0.014em]" >
              {db.employees.some((x) => x.id === editing.id) ? "Editar trabajador" : "Nuevo trabajador"}
            </h2>
            <div className="flex items-center gap-4"><Avatar name={editing.fullName||'Trabajador'} src={editing.photoUrl} size="lg"/><div className="min-w-0 space-y-2"><Field label="Foto del trabajador"><input aria-label="Subir foto del trabajador" type="file" accept="image/jpeg,image/png,image/webp" disabled={!canManage||uploading||saving} className="w-full text-caption" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void uploadPhoto(file);}}/></Field>{editing.photoUrl&&<Button size="sm" variant="quiet" disabled={uploading||saving} onClick={()=>setEditing({...editing,photoUrl:undefined})}>Quitar foto</Button>}</div></div>
            <p className="text-micro text-faint">{uploading?'Subiendo foto…':'JPG, PNG o WebP · máximo 5 MB. Usa una foto autorizada: el archivo es público. Guarda para aplicar; quitar no elimina el archivo de publicaciones anteriores.'}</p>
            <Field label="Nombre completo"><Input value={editing.fullName} onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} placeholder="Carlos Mendoza" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rol">
                <select aria-label="Rol del trabajador" value={editing.roleLabel} onChange={(e) => setEditing({ ...editing, roleLabel: e.target.value })} className="w-full h-11 px-3 rounded-[var(--radius-control)] bg-subtle text-body">
                  {!EMPLOYEE_ROLES.some(r=>r===editing.roleLabel)&&<option value={editing.roleLabel}>{editing.roleLabel}</option>}
                  {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Comisión (%)"><Input type="number" value={editing.commissionRate} onChange={(e) => setEditing({ ...editing, commissionRate: +e.target.value })} /></Field>
            </div>
            <Field label="Especialidad"><Input value={editing.specialty} onChange={(e) => setEditing({ ...editing, specialty: e.target.value })} placeholder="Degradados y cortes clásicos" /></Field>
            <Field label="Biografía"><Textarea value={editing.bio} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} placeholder="Breve presentación para tu página…" /></Field>
            <div>
              <p className="text-caption font-semibold mb-1.5">Servicios que ofrece</p>
              <div className="flex flex-wrap gap-2">
                {db.services.filter(s => !editing.locationId || s.locationId === editing.locationId).map((s) => {
                  const on = (editing.serviceIds ?? []).includes(s.id);
                  return (
                    <button key={s.id}
                      onClick={() => setEditing({ ...editing, serviceIds: on ? (editing.serviceIds ?? []).filter((x) => x !== s.id) : [...(editing.serviceIds ?? []), s.id] })}
                      className={`px-3 py-1.5 rounded-full border text-caption font-medium transition-colors ${on ? "border-accent bg-accent-soft text-accent" : "border-hairline text-muted"}`}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button className="w-full" disabled={!canManage||uploading||!editing.fullName.trim()} loading={saving}
              onClick={async () => { const token=epoch.current;setSaving(true); await runMutation(() => db.saveEmployee(editing), () => { if(token===epoch.current){toast.success("Trabajador guardado"); setEditing(null);} }); if(token===epoch.current)setSaving(false); }}>
              <UserRound className="h-4 w-4" /> Guardar
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
