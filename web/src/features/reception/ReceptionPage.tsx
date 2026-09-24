import { runMutation } from "../../lib/mutations";
import { motion } from "framer-motion";
import { CalendarX, CheckCircle2, Clock, PlayCircle, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge, StatusBadge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { dayLabel, money, timeLabel } from "../../lib/format";
import { todayAppointments, useDB } from "../../store/db";

/** Modo Recepción (§35) — interfaz ultra-rápida para el mostrador (tablet/móvil). */
export default function ReceptionPage() {
  const db = useDB();
  const list = todayAppointments(db.appointments).filter((a) => a.status !== "CANCELLED");
  const current = list.find((a) => a.status === "IN_SERVICE") ?? list.find((a) => a.status === "CONFIRMED" || a.status === "PENDING");
  const next = list.filter((a) => a.id !== current?.id && a.status !== "COMPLETED").slice(0, 4);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <Badge tone="accent">MODO RECEPCIÓN</Badge>
        <h1 className="text-title font-semibold tracking-[-0.014em] mt-2">En la barra ahora</h1>
      </div>

      {!current ? (
        <EmptyState icon={CalendarX} title="No hay citas activas" description="Cuando llegue el próximo cliente, aparecerá aquí con un toque."
          phase="Todo al día" />
      ) : (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="rounded-[24px] bg-surface border border-hairline shadow-[var(--shadow-float)] p-8 text-center space-y-4"
        >
          <StatusBadge status={current.status} />
          <p className="text-[2.5rem] leading-none font-semibold tracking-[-0.02em]">{current.customerName}</p>
          <p className="text-headline text-muted">{current.serviceName}</p>
          <div className="flex justify-center gap-4 text-body text-muted num">
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{timeLabel(current.start)}</span>
            <span>·</span>
            <span>{current.employeeName}</span>
            <span>·</span>
            <span className="font-semibold text-ink">{money(current.price)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4">
            {current.status === "PENDING" && (
              <Button size="lg" variant="secondary" className="col-span-2 h-16 text-headline"
                onClick={() => void runMutation(() => db.setStatus(current.id, "CONFIRMED"), () => { toast.success("Confirmada ✓"); })}>
                <CheckCircle2 className="h-5 w-5" /> CONFIRMAR
              </Button>
            )}
            {(current.status === "CONFIRMED" || current.status === "PENDING") && (
              <Button size="lg" className="h-16 text-headline col-span-2"
                onClick={() => void runMutation(() => db.setStatus(current.id, "IN_SERVICE"), () => { toast.success("¡A trabajar! 💈"); })}>
                <PlayCircle className="h-5 w-5" /> INICIAR
              </Button>
            )}
            {current.status === "IN_SERVICE" && (
              <Button size="lg" className="h-16 text-headline col-span-2"
                onClick={() => void runMutation(() => db.setStatus(current.id, "COMPLETED"), () => { toast.success("Servicio completado ✓", { description: "¿Cuándo debería regresar?", action: { label: "En 3 sem", onClick: () => toast.success("Recordatorio agendado") } }); })}>
                COMPLETAR
              </Button>
            )}
            <Button size="lg" variant="quiet" className="h-14"
              onClick={() => void runMutation(() => db.setStatus(current.id, "CANCELLED"), () => { toast.success("Cancelada", { description: "Revenue Recovery la buscará en lista de espera" }); })}>
              <XCircle className="h-5 w-5" /> CANCELAR
            </Button>
            <Button size="lg" variant="quiet" className="h-14"
              onClick={() => toast.info("Toca un horario libre en la Agenda para reprogramar")}>
              <RefreshCw className="h-5 w-5" /> REPROGRAMAR
            </Button>
          </div>
        </motion.div>
      )}

      <div>
        <p className="text-caption font-semibold uppercase tracking-wide text-faint mb-3">A continuación</p>
        <div className="space-y-2">
          {next.map((a) => (
            <div key={a.id} className="flex items-center gap-4 p-4 rounded-[var(--radius-card)] bg-surface border border-hairline">
              <div className="text-center min-w-14">
                <p className="text-body font-semibold num">{timeLabel(a.start)}</p>
              </div>
              <div className="w-px h-9 bg-hairline" />
              <div className="flex-1 min-w-0">
                <p className="text-body font-medium truncate">{a.customerName}</p>
                <p className="text-caption text-muted truncate">{a.serviceName} · {a.employeeName}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
          {next.length === 0 && current && (
            <p className="text-body text-muted text-center py-4">No hay más citas hoy — {dayLabel(current.start)} fue la última</p>
          )}
        </div>
      </div>
    </div>
  );
}
