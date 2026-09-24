import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-subtle text-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-danger/12 text-danger",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-micro font-semibold tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

const statusMap = {
  PENDING: { label: "Pendiente", tone: "warning" as Tone },
  CONFIRMED: { label: "Confirmada", tone: "accent" as Tone },
  IN_SERVICE: { label: "En atención", tone: "success" as Tone },
  COMPLETED: { label: "Completada", tone: "neutral" as Tone },
  CANCELLED: { label: "Cancelada", tone: "danger" as Tone },
  NO_SHOW: { label: "No asistió", tone: "danger" as Tone },
};

export function StatusBadge({ status }: { status: keyof typeof statusMap }) {
  const s = statusMap[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
