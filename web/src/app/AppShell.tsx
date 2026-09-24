import { BRAND_NAME } from "../lib/brand";
import BrandMark from "../components/BrandMark";
import SignOutButton from "./SignOutButton";
import PlanFeatureGuard from "./PlanFeatureGuard";
import { BranchScope } from "../features/settings/BranchesPage";
import { motion } from "framer-motion";
import {
  ArrowLeftRight, BarChart3, Boxes, CalendarDays, Contact, Globe, LayoutDashboard,
  Menu, MessageCircle, Moon, Search, Settings, Sparkles, Sun, Ticket, Tv, Users, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import CommandPalette from "./CommandPalette";
import { Avatar } from "../components/ui/avatar";
import { useSession } from "../store/session";
import { cn } from "../lib/utils";

const NAV = [
  {
    group: "Trabajo",
    items: [
      { to: "/app/dashboard", label: "Panel", icon: LayoutDashboard },
      { to: "/app/calendar", label: "Agenda", icon: CalendarDays },
      { to: "/app/clients", label: "Clientes", icon: Contact },
      { to: "/app/sales", label: "Ventas", icon: ArrowLeftRight },
    ],
  },
  {
    group: "Crecimiento",
    items: [
      { to: "/app/loyalty", label: "Fidelización", icon: Ticket },
      { to: "/app/whatsapp", label: "WhatsApp", icon: MessageCircle },
      { to: "/app/ai", label: "Copiloto IA", icon: Sparkles },
    ],
  },
  {
    group: "Negocio",
    items: [
      { to: "/app/services", label: "Servicios", icon: Sparkles },
      { to: "/app/team", label: "Equipo", icon: Users },
      { to: "/app/inventory", label: "Inventario", icon: Boxes },
      { to: "/app/reports", label: "Reportes", icon: BarChart3 },
      { to: "/app/website", label: "Mi página", icon: Globe },
      { to: "/app/reception", label: "Recepción", icon: Tv },
      { to: "/app/settings", label: "Ajustes", icon: Settings },
    ],
  },
];

const MOBILE_NAV = [
  { to: "/app/dashboard", label: "Panel", icon: LayoutDashboard },
  { to: "/app/calendar", label: "Agenda", icon: CalendarDays },
  { to: "/app/clients", label: "Clientes", icon: Contact },
  { to: "/app/sales", label: "Ventas", icon: ArrowLeftRight },
];

function ThemeToggle() {
  const { theme, setTheme } = useSession();
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label="Cambiar tema"
      className="h-10 w-10 rounded-full bg-subtle hover:bg-inset transition-colors flex items-center justify-center text-muted"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export default function AppShell() {
  const { user, business, membership, setPaletteOpen, setLastPath } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const biz = business ?? { name: "Black House Barber" };

  useEffect(() => {
    setLastPath(pathname);
  }, [pathname, setLastPath]);

  useEffect(() => {
    const apply = (t: string) =>
      document.documentElement.classList.toggle(
        "dark",
        t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches),
      );
    apply(useSession.getState().theme);
    return useSession.subscribe((s) => apply(s.theme));
  }, []);

  const SidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2 px-3 mb-3 text-accent"><BrandMark className="h-5 w-5" /><span className="text-body font-semibold tracking-tight">{BRAND_NAME}</span></div>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-subtle hover:bg-inset transition-colors cursor-default">
          <div className="h-9 w-9 rounded-xl bg-ink text-bg font-bold text-caption flex items-center justify-center">
            {biz.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
          </div>
          <div className="min-w-0">
            <p className="text-caption font-semibold truncate">{biz.name}</p>
            <p className="text-micro text-faint truncate">{membership?.roleCode ?? "BUSINESS_ADMIN"}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-6 overflow-y-auto pb-6">
        {NAV.map((section) => (
          <div key={section.group}>
            <p className="px-3 mb-1.5 text-micro font-semibold tracking-[0.12em] uppercase text-faint">
              {section.group}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 h-10 rounded-[var(--radius-control)] text-body transition-all duration-150",
                        isActive
                          ? "bg-accent-soft text-accent font-semibold"
                          : "text-muted hover:bg-subtle hover:text-ink",
                      )
                    }
                  >
                    <item.icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-hairline">
        <SignOutButton fullWidth />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-[248px] glass border-r border-hairline z-40">
        {SidebarContent}
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
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
              className="absolute top-4 right-4 h-9 w-9 rounded-full bg-subtle flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
            {SidebarContent}
          </motion.aside>
        </div>
      )}

      <header className="lg:pl-[248px]">
        <div className="glass border-b border-hairline sticky top-0 z-30">
          <div className="flex items-center gap-3 h-16 px-4 sm:px-8">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
              className="lg:hidden h-10 w-10 rounded-full bg-subtle flex items-center justify-center"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2.5 h-10 px-4 rounded-full bg-subtle hover:bg-inset transition-colors text-faint min-w-56"
            >
              <Search className="h-4 w-4" />
              <span className="text-caption">Buscar o ejecutar…</span>
              <kbd className="ml-auto text-micro border border-hairline rounded-md px-1.5 py-0.5">⌘K</kbd>
            </button>
            <div className="flex-1" />
            <ThemeToggle />
            <SignOutButton />
            <Avatar name={user?.fullName ?? "Invitado"} />
          </div>
        </div>

        <main className="px-4 sm:px-8 py-8 pb-28 lg:pb-12 max-w-[1280px] mx-auto">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            <BranchScope />
            <PlanFeatureGuard><Outlet /></PlanFeatureGuard>
          </motion.div>
        </main>
      </header>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-hairline">
        <div className="grid grid-cols-4 h-16 pb-[env(safe-area-inset-bottom)]">
          {MOBILE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 text-micro transition-colors",
                  isActive ? "text-accent font-semibold" : "text-muted",
                )
              }
            >
              <item.icon className="h-5 w-5" strokeWidth={1.7} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <CommandPalette />
    </div>
  );
}
