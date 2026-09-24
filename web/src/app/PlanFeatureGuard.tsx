import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useCapabilities } from "../store/capabilities";
import { Button } from "../components/ui/button";
const routeCapabilities = { "/app/loyalty": "loyalty", "/app/ai": "aiCopilot", "/app/whatsapp": "whatsapp", "/app/website": "website" } as const;
/** Solo UX. La autorización y capacidades se vuelven a validar en RPC/RLS. */
export default function PlanFeatureGuard({ children }: { children: ReactNode }) {
  const { pathname } = useLocation(); const state = useCapabilities();
  const key = routeCapabilities[pathname as keyof typeof routeCapabilities];
  if (!key) return <>{children}</>;
  if (!state.current) return <div className="space-y-3"><p role="status" className={state.error ? "text-danger" : "text-muted"}>{state.error || "Consultando capacidades del negocio…"}</p>{state.error && <Button variant="quiet" onClick={() => state.businessId && void state.refresh(state.businessId)}>Reintentar</Button>}</div>;
  if (!state.current.capabilities[key]) return <div className="space-y-4"><h1 className="text-title font-semibold">Capacidad desactivada</h1><p className="text-body text-muted">La plataforma desactivó esta capacidad en la configuración de tu plan. Consulta al administrador.</p><Link className="text-accent" to="/app/settings/plan">Ver mi plan</Link></div>;
  return <>{children}</>;
}
