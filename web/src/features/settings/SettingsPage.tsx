import { Link } from "react-router-dom";
import { Building2, Clock, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, Input, Textarea } from "../../components/ui/input";
import { Switch } from "../../components/ui/switch";
import { useDB } from "../../store/db";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function SettingsPage() {
  const db = useDB();
  const [biz, setBiz] = useState(db.business);
  const [slot, setSlot] = useState(30);
  const [lead, setLead] = useState(60);
  const [cancelWin, setCancelWin] = useState(12);
  const [rebook, setRebook] = useState(28);
  const [hours, setHours] = useState(db.site.hours);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-title font-semibold tracking-[-0.014em]">Ajustes</h1>
        <p className="text-body text-muted">Datos del negocio, horarios y reglas de reserva</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3"><Link className="bg-subtle rounded-2xl p-5 font-semibold" to="/app/settings/plan">Plan y facturación → Mi plan</Link><Link className="bg-subtle rounded-2xl p-5 font-semibold" to="/app/settings/branches">Sucursales → Gestionar ubicaciones y horarios</Link></div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4 text-accent" /> Información del negocio</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nombre"><Input value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} /></Field>
            <Field label="Tipo">
              <select value={biz.type} onChange={(e) => setBiz({ ...biz, type: e.target.value })} className="w-full h-11 px-3 rounded-[var(--radius-control)] bg-subtle text-body">
                {["BARBERSHOP", "SALON", "SPA", "AESTHETICS", "NAILS", "LASHES", "BROWS", "MASSAGE", "OTHER"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Teléfono"><Input value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} /></Field>
            <Field label="WhatsApp"><Input value={biz.whatsapp} onChange={(e) => setBiz({ ...biz, whatsapp: e.target.value })} /></Field>
          </div>
          <Field label="Descripción"><Textarea value={biz.description} onChange={(e) => setBiz({ ...biz, description: e.target.value })} /></Field>
          <Field label="Dirección"><Input value={biz.address} onChange={(e) => setBiz({ ...biz, address: e.target.value })} /></Field>
          <Button onClick={() => toast.success("Información guardada ✓")}>Guardar cambios</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-accent" /> Horarios de atención</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {hours.map((h, i) => (
            <div key={h.weekday} className="flex items-center gap-3 p-3 rounded-[var(--radius-tile)] bg-subtle">
              <span className="w-24 text-body font-medium">{DAYS[h.weekday]}</span>
              <Switch checked={!h.is_closed} label={DAYS[h.weekday]}
                onChange={(v) => setHours(hours.map((x, j) => (j === i ? { ...x, is_closed: !v } : x)))} />
              {h.is_closed ? (
                <span className="text-caption text-faint">Cerrado</span>
              ) : (
                <div className="flex items-center gap-2 text-caption num">
                  <Input type="time" value={h.open_time} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, open_time: e.target.value } : x)))} className="w-32 h-9" />
                  <span className="text-faint">–</span>
                  <Input type="time" value={h.close_time} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, close_time: e.target.value } : x)))} className="w-32 h-9" />
                </div>
              )}
            </div>
          ))}
          <Button onClick={() => toast.success("Horarios guardados ✓")}>Guardar horarios</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-4 w-4 text-accent" /> Reglas de reserva</CardTitle>
          <Badge tone="accent">Slot {slot} min</Badge>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <Field label="Duración del slot (min)"><Input type="number" value={slot} onChange={(e) => setSlot(+e.target.value)} /></Field>
          <Field label="Anticipación mínima (min)"><Input type="number" value={lead} onChange={(e) => setLead(+e.target.value)} /></Field>
          <Field label="Cancelación sin costo hasta (h antes)"><Input type="number" value={cancelWin} onChange={(e) => setCancelWin(+e.target.value)} /></Field>
          <Field label="Recordatorio de rebooking (días)"><Input type="number" value={rebook} onChange={(e) => setRebook(+e.target.value)} /></Field>
          <div className="sm:col-span-2"><Button onClick={() => toast.success("Reglas guardadas ✓")}>Guardar reglas</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
