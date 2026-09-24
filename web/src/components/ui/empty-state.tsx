import type { LucideIcon } from "lucide-react";
import { ShieldAlert as ShieldAlertIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  phase,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  phase?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-4 py-20 px-6 max-w-md mx-auto",
        className,
      )}
    >
      <div className="h-16 w-16 rounded-3xl bg-accent-soft text-accent flex items-center justify-center">
        <Icon className="h-7 w-7" strokeWidth={1.6} />
      </div>
      {phase && (
        <span className="text-micro font-semibold tracking-[0.14em] uppercase text-faint">{phase}</span>
      )}
      <h2 className="text-title font-semibold tracking-[-0.014em] leading-tight">{title}</h2>
      <p className="text-body text-muted leading-relaxed">{description}</p>
      {action}
    </div>
  );
}

export function PermissionDenied() {
  return (
    <EmptyState
      icon={ShieldAlertIcon}
      title="Sin acceso a esta sección"
      description="Tu rol no incluye este permiso. Pídele acceso al administrador del negocio."
    />
  );
}
