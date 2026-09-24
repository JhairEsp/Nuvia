import { supabase } from "../../lib/supabase";
import { useCapabilities, planError } from "../../store/capabilities";
import { runMutation } from "../../lib/mutations";
import { motion } from "framer-motion";
import {
  CalendarDays, CalendarPlus, Clock, ListFilter, Plus, RefreshCw, Sparkles, Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge, StatusBadge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Drawer, Modal } from "../../components/ui/overlay";
import { EmptyState } from "../../components/ui/empty-state";
import { Field, Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import { dayLabel, money, timeLabel } from "../../lib/format";
import { todayAppointments, useDB } from "../../store/db";
import type { Appointment, AppointmentStatus } from "../../types/domain";

type View = "day" | "week" | "list";
const STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED", "IN_SERVICE", "COMPLETED", "CANCELLED", "NO_SHOW"];

/* ── Modal: nueva cita / reprogramar ─────────────────────────────────────── */
function AppointmentModal({
  open, onClose, editing, defaultStart,
}: {
  open: boolean; onClose: () => void; editing?: Appointment | null; defaultStart?: string;
}) {
  const db = useDB();
  const [customerName, setCustomerName] = useState(editing?.customerName ?? "");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState(editing ? (db.services.find((s) => s.name === editing.serviceName)?.id ?? db.services[0]?.id ?? "") : db.services[0]?.id ?? "");
  const [employeeId, setEmployeeId] = useState(editing?.employeeId ?? db.employees[0]?.id ?? "");
  const [date, setDate] = useState((defaultStart ?? editing?.start ?? new Date().toISOString()).slice(0, 10));
  const [time, setTime] = useState(new Date(defaultStart ?? editing?.start ?? Date.now()).toTimeString().slice(0, 5));
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const svc = db.services.find(s => s.id === serviceId);
      const emp = db.employees.find(e => e.id === employeeId);
      const start = new Date(`${date}T${time}:00`);
      if (editing) { await db.reschedule(editing.id, start.toISOString()); }
      else {
        if (!svc || !emp) throw new Error("Selecciona servicio y profesional de la sucursal");
        let customerId = db.customers.find(c => c.fullName.toLowerCase() === customerName.trim().toLowerCase())?.id;
        if (!customerId) {
          if (phone.trim().length < 6) throw new Error("Ingresa el teléfono del nuevo cliente");
          const r = await supabase.from("customers").upsert({ business_id: db.businessId, full_name: customerName.trim(), phone: phone.trim(), referral_code: crypto.randomUUID().replaceAll("-", "").slice(0,12).toUpperCase() }, { onConflict: "business_id,phone" }).select("id").single();
          if (r.error) throw r.error;
          customerId = r.data.id;
        }
        await db.createAppointment({ customerId: customerId!, customerName: customerName.trim(), serviceName: svc.name, employeeName: emp.fullName, employeeId: emp.id,
          start: start.toISOString(), end: new Date(start.getTime() + svc.durationMin * 60000).toISOString(), status: "PENDING", price: svc.price, source: "DASHBOARD", notes });
      }
      toast.success(editing ? "Cita reprogramada" : "Cita creada"); onClose();
    } catch (e) { toast.error(planError(e)); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="space-y-4">
        <h2 className="text-title font-semibold tracking-[-0.014em]">{editing ? "Reprogramar cita" : "Nueva cita"}</h2>
        <Field label="Cliente">
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre del cliente" />
        </Field>
        {!editing && (
          <Field label="WhatsApp">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="987 654 321" inputMode="tel" />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Servicio">
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="w-full h-11 px-3 rounded-[var(--radius-control)] bg-subtle text-body">
              {db.services.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} · {money(s.price)}</option>)}
            </select>
          </Field>
          <Field label="Profesional">
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full h-11 px-3 rounded-[var(--radius-control)] bg-subtle text-body">
              {db.employees.filter((e) => e.active !== false).map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
            </select>
          </Field>
          <Field label="Fecha">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Hora">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <Field label="Notas">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preferencias del cliente…" />
        </Field>
        <Button className="w-full" onClick={() => void save()} loading={saving} disabled={!customerName.trim()}>
          {editing ? "Guardar cambios" : "Crear cita"}
        </Button>
      </div>
    </Modal>
  );
}

/* ── Waitlist + Revenue Recovery ─────────────────────────────────────────── */
function WaitlistDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDB();
  const cancelled = db.appointments
    .filter((a) => (a.status === "CANCELLED" || a.status === "NO_SHOW") && new Date(a.start) > new Date(Date.now() - 864e5))
    .slice(0, 4);
  return (
    <Drawer open={open} onClose={onClose}>
      <div className="p-6 space-y-8">
        <div>
          <Badge tone="accent"><Sparkles className="h-3 w-3" /> Revenue Recovery</Badge>
          <h2 className="text-title font-semibold tracking-[-0.014em] mt-3">Huecos recuperables</h2>
          <p className="text-body text-muted mt-1">Citas canceladas donde podemos recuperar ingresos hoy mismo.</p>
        </div>
        {cancelled.length === 0 ? (
          <p className="text-body text-muted">Sin huecos por recuperar 🎉</p>
        ) : cancelled.map((a) => (
          <Card key={a.id} className="p-4">
            <p className="text-caption text-danger font-semibold uppercase tracking-wide">Cita cancelada</p>
            <p className="text-headline font-semibold num mt-1">{dayLabel(a.start)}</p>
            <p className="text-caption text-muted">{a.serviceName} · {a.employeeName}</p>
            <div className="flex items-center gap-2 mt-3">
              <Badge tone="success">{db.waitlist.filter((w) => w.status === "WAITING" && w.serviceName === a.serviceName).length} en lista de espera</Badge>
              <Button size="sm" variant="secondary"
                onClick={async () => {
                  try {
                  const match = db.waitlist.find((w) => w.status === "WAITING" && w.serviceName === a.serviceName);
                  if (match) {
                    await db.createAppointment({
                      customerId: match.customerId, customerName: match.customerName,
                      serviceName: match.serviceName, employeeName: a.employeeName, employeeId: a.employeeId,
                      start: a.start, end: a.end, status: "CONFIRMED", price: a.price, source: "WHATSAPP", locationId: a.locationId,
                    });
                    db.bookWaitlist(match.id);
                    db.sendMessage(match.customerName, "—", `¡Hola ${match.customerName}! Se liberó un horario: ${dayLabel(a.start)}. Confirmado ✓`);
                    toast.success(`Horario recuperado con ${match.customerName} 🎉`);
                  } else {
                    db.sendMessage(a.customerName, "—", `Hola ${a.customerName}, tenemos un hueco especial ${dayLabel(a.start)}. ¿Te animas?`);
                    toast.success("Invitaciones enviadas por WhatsApp 📲");
                  }
                  } catch (e) { toast.error(planError(e)); }
                }}>
                Enviar invitaciones
              </Button>
            </div>
          </Card>
        ))}

        <div>
          <h2 className="text-headline font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-accent" /> Lista de espera</h2>
          <div className="space-y-2 mt-3">
            {db.waitlist.filter((w) => w.status === "WAITING").map((w) => (
              <div key={w.id} className="flex items-center gap-3 p-3 rounded-[var(--radius-tile)] bg-subtle">
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium truncate">{w.customerName}</p>
                  <p className="text-caption text-muted">{w.serviceName}{w.timeRange ? ` · ${w.timeRange}` : ""}{w.preferredDate ? ` · ${w.preferredDate}` : ""}</p>
                </div>
                {w.priority > 0 && <Badge tone="warning">prioridad</Badge>}
                <Button size="sm" variant="quiet" onClick={() => { db.removeWaitlist(w.id); toast.success("Quitado de la lista"); }}>✕</Button>
              </div>
            ))}
            {db.waitlist.filter((w) => w.status === "WAITING").length === 0 && (
              <p className="text-body text-muted py-4">Nadie esperando. ¡Tu agenda está al día!</p>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

/* ── Página principal ─────────────────────────────────────────────────────── */
export default function CalendarPage() {
  const planUsage = useCapabilities(s => s.current);
  const db = useDB();
  const [view, setView] = useState<View>("day");
  const [modal, setModal] = useState<{ open: boolean; editing?: Appointment | null; start?: string }>({ open: false });
  const [waitOpen, setWaitOpen] = useState(false);

  const today = todayAppointments(db.appointments);
  const week = useMemo(() => {
    const days: Array<{ date: Date; items: Appointment[] }> = [];
    for (let i = -1; i < 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push({
        date: d,
        items: db.appointments
          .filter((a) => new Date(a.start).toDateString() === d.toDateString())
          .sort((a, b) => a.start.localeCompare(b.start)),
      });
    }
    return days;
  }, [db.appointments]);

  const upcoming = db.appointments
    .filter((a) => new Date(a.start) > new Date() && a.status !== "CANCELLED")
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 20);

  const onDrop = (e: React.DragEvent, dateISO: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/appt");
    if (!id) return;
    const appt = db.appointments.find((a) => a.id === id);
    if (!appt) return;
    const [h, m] = new Date(appt.start).toTimeString().slice(0, 5).split(":");
    void runMutation(() => db.reschedule(id, `${dateISO}T${h}:${m}:00`), () => toast.success("Cita reprogramada ✓", { description: `${appt.customerName} → ${dayLabel(`${dateISO}T${h}:${m}:00`)}`, action: { label: "Deshacer", onClick: () => void runMutation(() => db.reschedule(id, appt.start), () => toast.info("Restaurado")) } }));
  };

  return (
    <div className="space-y-6">
      {planUsage && <p className="text-caption text-muted">Citas utilizadas este mes: {planUsage.usage.appointments} / {planUsage.capabilities.maxMonthlyAppointments ?? "Ilimitadas"} · todo el negocio</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title font-semibold tracking-[-0.014em]">Agenda</h1>
          <p className="text-body text-muted">Arrastra las citas para reprogramar · {db.appointments.filter((a) => a.status === "PENDING").length} por confirmar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="quiet" size="sm" onClick={() => setWaitOpen(true)}>
            <RefreshCw className="h-4 w-4" /> Waitlist & Recovery
          </Button>
          <div className="flex bg-subtle rounded-full p-1">
            {([["day", CalendarDays], ["week", CalendarDays], ["list", ListFilter]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)}
                className={cn("flex items-center gap-1.5 px-3 h-8 rounded-full text-caption font-medium transition-colors",
                  view === v ? "bg-surface shadow-soft text-ink" : "text-muted")}>
                <Icon className="h-3.5 w-3.5" />{v === "day" ? "Día" : v === "week" ? "Semana" : "Lista"}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setModal({ open: true })}>
            <Plus className="h-4 w-4" /> Nueva cita
          </Button>
        </div>
      </div>

      {view === "day" && (
        <div className="space-y-2">
          {today.length === 0 && (
            <EmptyState icon={CalendarDays} title="Hoy no hay citas" description="Un día tranquilo. Puedes promocionar huecos por WhatsApp o crear una cita."
              action={<Button onClick={() => setModal({ open: true })}><CalendarPlus className="h-4 w-4" /> Nueva cita</Button>} />
          )}
          {today.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              draggable
              onDragStart={(e) => (e as unknown as React.DragEvent).dataTransfer?.setData("text/appt", a.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e as unknown as React.DragEvent, new Date().toISOString().slice(0, 10))}
              className={cn(
                "flex items-center gap-4 p-4 rounded-[var(--radius-card)] bg-surface border border-hairline shadow-[var(--shadow-card)] cursor-grab active:cursor-grabbing",
                a.status === "CANCELLED" || a.status === "NO_SHOW" ? "opacity-50" : "",
              )}
            >
              <div className="text-center min-w-16">
                <p className="text-body font-semibold num">{timeLabel(a.start)}</p>
                <p className="text-micro text-faint num">{a.price ? money(a.price) : ""}</p>
              </div>
              <div className="w-px h-10 bg-hairline" />
              <div className="flex-1 min-w-0">
                <p className="text-body font-medium truncate">{a.customerName}</p>
                <p className="text-caption text-muted truncate">{a.serviceName} · {a.employeeName} · {a.source.toLowerCase()}</p>
              </div>
              <StatusBadge status={a.status} />
              <div className="hidden sm:flex gap-1">
                {a.status === "PENDING" && <Button size="sm" variant="quiet" onClick={() => void runMutation(() => db.setStatus(a.id, "CONFIRMED"), () => { toast.success("Cita confirmada"); })}>Confirmar</Button>}
                {a.status === "CONFIRMED" && <Button size="sm" variant="quiet" onClick={() => void runMutation(() => db.setStatus(a.id, "IN_SERVICE"), () => { toast.success("Atención iniciada"); })}>Iniciar</Button>}
                {a.status === "IN_SERVICE" && <Button size="sm" onClick={() => void runMutation(() => db.setStatus(a.id, "COMPLETED"), () => { toast.success("Cita completada ✓ ¿Cuándo debería regresar?", { action: { label: "En 3 sem", onClick: () => toast.success("Recordatorio de rebooking agendado") } }); })}>Completar</Button>}
                <Button size="sm" variant="ghost" onClick={() => setModal({ open: true, editing: a })}>Reprogramar</Button>
                {a.status !== "CANCELLED" && a.status !== "COMPLETED" && (
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => void runMutation(() => db.setStatus(a.id, "CANCELLED"), () => {
                    toast.success("Cita cancelada", { description: "Buscando en lista de espera…", action: { label: "Recuperar", onClick: () => setWaitOpen(true) } });
                  })}>Cancelar</Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {view === "week" && (
        <div className="grid grid-cols-7 gap-2 overflow-x-auto">
          {week.map(({ date, items }) => (
            <div
              key={date.toISOString()}
              className="min-h-64 rounded-[var(--radius-card)] bg-surface border border-hairline p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, date.toISOString().slice(0, 10))}
            >
              <p className="text-micro font-semibold uppercase tracking-wide text-faint text-center py-1">
                {date.toLocaleDateString("es-PE", { weekday: "short" })} {date.getDate()}
              </p>
              <div className="space-y-1.5">
                {items.map((a) => (
                  <motion.div
                    key={a.id}
                    layout
                    draggable
                    onDragStart={(e) => (e as unknown as React.DragEvent).dataTransfer?.setData("text/appt", a.id)}
                    onClick={() => setModal({ open: true, editing: a })}
                    className={cn(
                      "p-2 rounded-[var(--radius-tile)] bg-subtle cursor-grab active:cursor-grabbing text-left hover:bg-inset transition-colors border-l-2",
                      a.status === "CANCELLED" || a.status === "NO_SHOW" ? "border-danger opacity-50" :
                      a.status === "COMPLETED" ? "border-success" : "border-accent",
                    )}
                  >
                    <p className="text-micro font-semibold num text-muted">{timeLabel(a.start)}</p>
                    <p className="text-caption font-medium truncate">{a.customerName.split(" ")[0]}</p>
                    <p className="text-micro text-faint truncate">{a.serviceName}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "list" && (
        <Card>
          <CardHeader><CardTitle>Próximas citas</CardTitle><Badge>{upcoming.length}</Badge></CardHeader>
          <CardContent className="space-y-1">
            {upcoming.map((a) => (
              <div key={a.id} className="flex items-center gap-4 px-3 py-3 rounded-[var(--radius-tile)] hover:bg-subtle transition-colors">
                <div className="min-w-36">
                  <p className="text-caption font-semibold num">{dayLabel(a.start)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium truncate">{a.customerName}</p>
                  <p className="text-caption text-muted truncate">{a.serviceName} · {a.employeeName}</p>
                </div>
                <span className="text-caption font-semibold num hidden sm:block">{money(a.price)}</span>
                <StatusBadge status={a.status} />
                <Button size="sm" variant="ghost" onClick={() => setModal({ open: true, editing: a })}>Editar</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AppointmentModal open={modal.open} editing={modal.editing} defaultStart={modal.start} onClose={() => setModal({ open: false })} />
      <WaitlistDrawer open={waitOpen} onClose={() => setWaitOpen(false)} />
    </div>
  );
}
