import BrandMark from "../../components/BrandMark";
import { BRAND_NAME } from "../../lib/brand";
import { motion } from "framer-motion";
import { Loader2, User } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Field, Input } from "../../components/ui/input";
import { useSession } from "../../store/session";

const ease: [number, number, number, number] = [0.32, 0.72, 0, 1];

export default function LoginPage() {
  const signIn = useSession((s) => s.signIn);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const enter = async () => {
    setLoading(true);
    try {
      const err = await signIn(email.trim(), password);
      if (err) {
        toast.error("No se pudo iniciar sesión", { description: err });
        return;
      }
      const { user, lastPath } = useSession.getState();
      toast.success(`Bienvenido, ${user?.fullName.split(" ")[0] || "de nuevo"} 💎`);
      navigate(user?.platformRole === "SUPER_ADMIN" ? "/admin" : lastPath?.startsWith("/app/") ? lastPath : "/app/dashboard", { replace: true });
    } catch {
      toast.error("No se pudo iniciar sesión. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-bg">
      {/* Panel de marca */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-ink text-bg overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            background:
              "radial-gradient(80% 60% at 20% 20%, rgba(201,141,111,.45), transparent 60%), radial-gradient(60% 50% at 90% 90%, rgba(154,98,72,.4), transparent 55%)",
          }}
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-bg/10 flex items-center justify-center">
            <BrandMark className="h-6 w-6" />
          </div>
          <div>
            <p className="text-body font-semibold tracking-tight">{BRAND_NAME}</p>
            <p className="text-micro opacity-60">operar · crecer · brillar</p>
          </div>
        </div>

        <div className="relative space-y-3">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
            className="text-display font-semibold leading-[1.04] tracking-[-0.03em]"
          >
            Tu negocio,
            <br />
            <span className="italic text-accent">bien peinado.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease }}
            className="text-headline opacity-70 max-w-md"
          >
            Agenda, ventas, clientes y una página que vende — en un solo lugar.
          </motion.p>
        </div>

        <div className="relative flex gap-6 text-micro opacity-50">
          <span>Agenda</span><span>Clientes 360°</span><span>POS</span><span>WhatsApp</span><span>IA</span>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="lg:hidden flex items-center gap-3" aria-label="Nuvia">
            <div className="h-11 w-11 rounded-2xl bg-ink text-bg flex items-center justify-center"><BrandMark /></div>
            <span className="text-headline font-semibold tracking-tight">{BRAND_NAME}</span>
          </div>
          <div className="space-y-1.5">
            <p className="text-micro font-semibold uppercase tracking-[0.14em] text-faint">Bienvenido</p>
            <h2 className="text-title font-semibold tracking-[-0.014em]">Inicia sesión</h2>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void enter();
            }}
          >
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="username" required />
            </Field>
            <Field label="Contraseña">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
            </Field>
            <Button type="submit" className="w-full h-12" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><User className="h-4 w-4" /> Entrar</>}
            </Button>
          </form>

        </motion.div>
      </div>
    </div>
  );
}
