import { BRAND_NAME } from "../lib/brand";
import SignOutButton from "./SignOutButton";
import { motion } from "framer-motion";
import {
  Building2, CreditCard, FileClock, LayoutDashboard, Menu, Moon, Shield, Sun, Users, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Avatar } from "../components/ui/avatar";
import { useSession } from "../store/session";
import { cn } from "../lib/utils";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/businesses", label: "Negocios", icon: Building2 },
  { to: "/admin/users", label: "Usuarios", icon: Users },
  { to: "/admin/plans", label: "Planes", icon: CreditCard },
  { to: "/admin/audit", label: "Auditoría", icon: FileClock },
];

/** Panel independiente del Super Admin (§37) — nunca mezclado con el tenant. */
export default function AdminShell() {
  const { user, theme, setTheme } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const apply = (t: string) =>
      document.documentElement.classList.toggle(
        "dark",
        t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches),
      );
    apply(theme);
    return useSession.subscribe((s) => apply(s.theme));
  }, [theme]);

  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);

  const links = (
    <nav className="space-y-0.5 p-3">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 h-10 rounded-[var(--radius-control)] text-body transition-all duration-150",
              isActive ? "bg-accent-soft text-accent font-semibold" : "text-muted hover:bg-subtle hover:text-ink",
            )
          }
        >
          <item.icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-bg">
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-[248px] glass border-r border-hairline z-40">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-ink text-bg">
            <Shield className="h-5 w-5" />
            <div>
              <p className="text-caption font-bold">{BRAND_NAME} · Plataforma</p>
              <p className="text-micro opacity-70">SUPER ADMIN</p>
            </div>
          </div>
        </div>
        {links}
        <div className="mt-auto p-3 border-t border-hairline">
          <SignOutButton fullWidth />
        </div>
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
          <motion.aside
            className="absolute inset-y-0 left-0 w-[280px] bg-surface"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          >
            <button onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" className="absolute top-4 right-4 h-9 w-9 rounded-full bg-subtle flex items-center justify-center">
              <X className="h-4 w-4" />
            </button>
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-ink text-bg">
                <Shield className="h-5 w-5" />
                <div>
                  <p className="text-caption font-bold">{BRAND_NAME} · Plataforma</p>
                  <p className="text-micro opacity-70">SUPER ADMIN</p>
                </div>
              </div>
            </div>
            {links}
            <div className="p-3 border-t border-hairline"><SignOutButton fullWidth /></div>
          </motion.aside>
        </div>
      )}

      <header className="lg:pl-[248px]">
        <div className="glass border-b border-hairline sticky top-0 z-30">
          <div className="flex items-center gap-3 h-16 px-4 sm:px-8">
            <button onClick={() => setMobileOpen(true)} aria-label="Abrir menú" className="lg:hidden h-10 w-10 rounded-full bg-subtle flex items-center justify-center">
              <Menu className="h-4 w-4" />
            </button>
            <p className="text-caption font-semibold tracking-[0.12em] uppercase text-faint hidden sm:block">Plataforma</p>
            <div className="flex-1" />
            <button
              onClick={() => setTheme(dark ? "light" : "dark")}
              aria-label="Cambiar tema"
              className="h-10 w-10 rounded-full bg-subtle hover:bg-inset transition-colors flex items-center justify-center text-muted"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <SignOutButton />
            <Avatar name={user?.fullName ?? "Súper Admin"} />
          </div>
        </div>
        <main className="px-4 sm:px-8 py-8 max-w-[1200px] mx-auto">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            <Outlet />
          </motion.div>
        </main>
      </header>
    </div>
  );
}
