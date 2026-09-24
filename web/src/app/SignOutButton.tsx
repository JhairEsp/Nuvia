import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { useSession } from "../store/session";

/** Mismo cierre real de Supabase para la cabecera y los menús. */
export default function SignOutButton({ fullWidth = false }: { fullWidth?: boolean }) {
  const signOut = useSession(s => s.signOut);
  const signingOut = useSession(s => s.signingOut);
  const navigate = useNavigate();
  return (
    <Button
      type="button"
      variant={fullWidth ? "ghost" : "quiet"}
      size="sm"
      className={fullWidth ? "w-full justify-start" : "shrink-0"}
      loading={signingOut}
      aria-busy={signingOut}
      onClick={async () => {
        try {
          await signOut();
          navigate("/login", { replace: true });
          toast.success("Sesión cerrada");
        } catch {
          toast.error("No se pudo cerrar sesión. Revisa tu conexión e inténtalo nuevamente.");
        }
      }}
    >
      {!signingOut && <LogOut className="h-4 w-4" aria-hidden="true" />}
      {signingOut ? "Cerrando…" : "Cerrar sesión"}
    </Button>
  );
}
