import { CheckCircle2, Clock, MessageCircle, Send, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, Input } from "../../components/ui/input";
import { Modal } from "../../components/ui/overlay";
import { Switch } from "../../components/ui/switch";
import { dayLabel } from "../../lib/format";
import { runMutation } from "../../lib/mutations";
import { usePermission } from "../../store/session";
import { useDB } from "../../store/db";

/** Centro WhatsApp (§33) — automatizaciones, plantillas y log de envíos. */
export default function WhatsAppPage() {
  const db = useDB();
  const canManage = usePermission("whatsapp.manage");
  const [busy, setBusy] = useState(false);
  const [template, setTemplate] = useState("");
  const mutate = async (action: () => Promise<void>, success: () => void) => { if (busy) return; setBusy(true); try { await runMutation(action, success); } finally { setBusy(false); } };
  const [editing, setEditing] = useState<string | null>(null);
  const [quick, setQuick] = useState<{ name: string; phone: string } | null>(null);
  const [body, setBody] = useState("");
  const rule = db.automations.find((r) => r.id === editing);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title font-semibold tracking-[-0.014em]">Centro WhatsApp</h1>
          <p className="text-body text-muted">{db.automations.filter((r) => r.isEnabled).length} automatizaciones activas · {db.messages.length} mensajes</p>
        </div>
        <Button size="sm" disabled={!canManage || busy} onClick={() => { setQuick({ name: db.customers[0]?.fullName ?? "", phone: db.customers[0]?.phone ?? "" }); setBody(""); }}>
          <Send className="h-4 w-4" /> Mensaje rápido
        </Button>
      </div>

      <p className="text-caption text-muted">Los mensajes se registran en cola. La entrega y los recordatorios requieren un proveedor de WhatsApp y un procesador de automatizaciones configurados.</p>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-accent" /> Automatizaciones</CardTitle>
          <Badge tone="success">Confirmación · Recordatorio · Gracias · Rebooking · Huecos</Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {db.automations.map((r) => (
            <div key={r.id} className="flex items-center gap-4 p-4 rounded-[var(--radius-tile)] bg-subtle">
              <MessageCircle className="h-5 w-5 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-body font-medium">{r.name}</p>
                <p className="text-caption text-muted truncate">“{r.template}”</p>
                <p className="text-micro text-faint mt-0.5">Trigger: {r.trigger}{r.delayMinutes ? ` · +${r.delayMinutes} min` : ""}</p>
              </div>
              <Button size="sm" variant="ghost" disabled={!canManage || busy} onClick={() => { setTemplate(r.template); setEditing(r.id); }}>Plantilla</Button>
              <Switch disabled={!canManage || busy} checked={r.isEnabled} onChange={() => void mutate(() => db.toggleAutomation(r.id), () => toast.success("Automatización actualizada"))} label={r.name} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Mensajes recientes</CardTitle>
          <Badge tone="accent">{db.messages.filter((m) => m.status === "SENT").length} enviados</Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {db.messages.map((m) => (
            <div key={m.id} className="flex items-start gap-3 p-3.5 rounded-[var(--radius-tile)] bg-subtle">
              <div className="flex-1 min-w-0">
                <p className="text-caption font-semibold">{m.customerName} <span className="text-faint num font-normal">· {m.toPhone}</span></p>
                <p className="text-body text-muted truncate">{m.body}</p>
                <p className="text-micro text-faint mt-0.5 num">{dayLabel(m.createdAt)}{m.ruleName ? ` · ${m.ruleName}` : ""}</p>
              </div>
              {m.status === "SENT" ? (
                <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> Enviado</Badge>
              ) : m.status === "QUEUED" ? (
                <Badge tone="warning"><Clock className="h-3 w-3" /> En cola</Badge>
              ) : (
                <Badge tone="danger">Falló</Badge>
              )}
            </div>
          ))}
          {db.messages.length === 0 && <p className="text-body text-muted text-center py-6">Sin mensajes aún</p>}
        </CardContent>
      </Card>

      {rule && (
        <Modal open onClose={() => !busy && setEditing(null)}>
          <div className="space-y-4">
            <h2 className="text-title font-semibold tracking-[-0.014em]">{rule.name}</h2>
            <p className="text-caption text-muted">Variables: {"{{cliente}} {{servicio}} {{fecha}} {{hora}} {{link}}"}</p>
            <Field label="Plantilla">
              <textarea
                className="w-full px-4 py-3 rounded-[var(--radius-control)] bg-subtle text-body min-h-28"
                value={template}
                disabled={busy}
                onChange={(e) => setTemplate(e.target.value)}
              />
            </Field>
            <Button className="w-full" loading={busy} disabled={!canManage || !template.trim()} onClick={() => void mutate(() => db.updateTemplate(rule.id, template), () => { setEditing(null); toast.success("Plantilla guardada"); })}>Guardar</Button>
          </div>
        </Modal>
      )}

      {quick && (
        <Modal open onClose={() => !busy && setQuick(null)}>
          <div className="space-y-4">
            <h2 className="text-title font-semibold tracking-[-0.014em]">Mensaje rápido</h2>
            <Field label="Cliente">
              <select value={quick.name} onChange={(e) => {
                const c = db.customers.find((x) => x.fullName === e.target.value);
                setQuick({ name: e.target.value, phone: c?.phone ?? "" });
              }} className="w-full h-11 px-3 rounded-[var(--radius-control)] bg-subtle text-body">
                {db.customers.map((c) => <option key={c.id}>{c.fullName}</option>)}
              </select>
            </Field>
            <Field label="Mensaje">
              <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hola, ¿agendamos tu próxima visita?" />
            </Field>
            <Button className="w-full" loading={busy} disabled={!canManage || !body.trim() || !quick.phone.trim()}
              onClick={() => void mutate(() => db.sendMessage(quick.name, quick.phone, body.trim()), () => {
                toast.success("Mensaje registrado en cola; pendiente de entrega por el proveedor");
                setQuick(null);
              })}>
              <Send className="h-4 w-4" /> Agregar a la cola
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
