import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight, BarChart3, Boxes, CalendarPlus, Calendar as CalendarIcon, Contact, CreditCard,
  LayoutDashboard, MessageCircle, Moon, Search, Settings, Sparkles, Sun, Ticket, Tv, UserPlus, Globe,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../store/session";

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Search;
  run: () => void;
}

/** Command Palette (§34) — ⌘K / Ctrl+K. Preparado para lenguaje natural. */
export default function CommandPalette() {
  const { paletteOpen, setPaletteOpen, setTheme, theme } = useSession();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const commands = useMemo<Cmd[]>(() => {
    const go = (path: string) => () => {
      navigate(path);
      setPaletteOpen(false);
    };
    return [
      { id: "new-appt", label: "Nueva cita", hint: "Acción", icon: CalendarPlus, run: go("/app/calendar") },
      { id: "new-client", label: "Nuevo cliente", hint: "Acción", icon: UserPlus, run: go("/app/clients") },
      { id: "new-sale", label: "Registrar venta", hint: "Acción", icon: CreditCard, run: go("/app/sales") },
      { id: "search-client", label: "Buscar cliente…", hint: "Buscar", icon: Contact, run: go("/app/clients") },
      { id: "go-dashboard", label: "Ir al Panel", hint: "Ir a", icon: LayoutDashboard, run: go("/app/dashboard") },
      { id: "go-calendar", label: "Ir a Agenda", hint: "Ir a", icon: CalendarIcon, run: go("/app/calendar") },
      { id: "go-sales", label: "Ver ventas / POS", hint: "Ir a", icon: ArrowLeftRight, run: go("/app/sales") },
      { id: "go-inventory", label: "Abrir inventario", hint: "Ir a", icon: Boxes, run: go("/app/inventory") },
      { id: "go-loyalty", label: "Fidelización y promos", hint: "Ir a", icon: Ticket, run: go("/app/loyalty") },
      { id: "go-whatsapp", label: "Centro WhatsApp", hint: "Ir a", icon: MessageCircle, run: go("/app/whatsapp") },
      { id: "go-ai", label: "Abrir Copiloto IA", hint: "Ir a", icon: Sparkles, run: go("/app/ai") },
      { id: "go-reports", label: "Ver reportes", hint: "Ir a", icon: BarChart3, run: go("/app/reports") },
      { id: "go-website", label: "Editar mi página", hint: "Ir a", icon: Globe, run: go("/app/website") },
      { id: "go-reception", label: "Modo Recepción", hint: "Ir a", icon: Tv, run: go("/app/reception") },
      { id: "go-settings", label: "Abrir configuración", hint: "Ir a", icon: Settings, run: go("/app/settings") },
      {
        id: "theme",
        label: theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro",
        hint: "Apariencia",
        icon: theme === "dark" ? Sun : Moon,
        run: () => {
          setTheme(theme === "dark" ? "light" : "dark");
          setPaletteOpen(false);
        },
      },
    ];
  }, [navigate, setPaletteOpen, setTheme, theme]);

  const filtered = useMemo(
    () =>
      commands.filter((c) =>
        c.label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [commands, query],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, setPaletteOpen]);

  useEffect(() => {
    if (paletteOpen) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [paletteOpen]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(filtered.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === "Enter") {
      filtered[active]?.run();
    }
  };

  return (
    <AnimatePresence>
      {paletteOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center pt-[14vh] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setPaletteOpen(false)} aria-hidden />
          <motion.div
            className="relative w-full max-w-xl rounded-[20px] bg-surface border border-hairline shadow-[var(--shadow-float)] overflow-hidden"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Paleta de comandos"
          >
            <div className="flex items-center gap-3 px-5 border-b border-hairline">
              <Search className="h-4 w-4 text-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Escribe un comando o busca…"
                className="flex-1 h-14 bg-transparent text-body outline-none placeholder:text-faint"
              />
              <kbd className="text-micro text-faint border border-hairline rounded-md px-1.5 py-0.5">ESC</kbd>
            </div>
            <ul className="max-h-80 overflow-y-auto p-2">
              {filtered.length === 0 && (
                <li className="text-caption text-muted text-center py-8">
                  Sin resultados para “{query}”. Prueba: nueva cita, ventas, clientes…
                </li>
              )}
              {filtered.map((c, i) => (
                <li key={c.id}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={c.run}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-control)] text-left transition-colors ${
                      i === active ? "bg-accent-soft text-accent" : "text-ink"
                    }`}
                  >
                    <c.icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                    <span className="flex-1 text-body font-medium">{c.label}</span>
                    {c.hint && <span className="text-micro text-faint">{c.hint}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
