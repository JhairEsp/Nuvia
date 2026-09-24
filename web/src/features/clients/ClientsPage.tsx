import { publicBusinessUrl } from "../../lib/brand";
import { runMutation } from "../../lib/mutations";
import { AlertTriangle, Camera, MessageCircle, Search, Sparkles, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "../../components/ui/avatar";
import { Badge, StatusBadge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { DataTable } from "../../components/ui/table";
import { Field, Input } from "../../components/ui/input";
import { Drawer, Modal } from "../../components/ui/overlay";
import { Progress, Tabs } from "../../components/ui/tabs";
import { dayLabel, money } from "../../lib/format";
import { useDB } from "../../store/db";
import type { Customer } from "../../types/domain";

const TIER_NEXT: Record<Customer["tier"], number> = { STARTER: 250, SILVER: 500, GOLD: 800, VIP: 1200 };
const TIER_LABEL: Record<Customer["tier"], string> = { STARTER: "Starter", SILVER: "Silver", GOLD: "Gold", VIP: "VIP" };

function riskOf(c: Customer): number | null {
  if (!c.lastVisitAt || !c.avgRecurrenceDays) return null;
  const days = (Date.now() - new Date(c.lastVisitAt).getTime()) / 864e5;
  return days > c.avgRecurrenceDays * 1.3 ? Math.round(days - c.avgRecurrenceDays) : null;
}

/* ── Cliente 360 (drawer) ───────────────────────────────────────────────── */
function ClientDrawer({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const db = useDB();
  const [note, setNote] = useState("");
  const c = customer ? db.customers.find((x) => x.id === customer.id) ?? customer : null;
  if (!c) return <Drawer open={false} onClose={onClose}><div /></Drawer>;
  const risk = riskOf(c);
  const history = db.appointments.filter((a) => a.customerId === c.id).sort((a, b) => b.start.localeCompare(a.start));

  return (
    <Drawer open={!!customer} onClose={onClose}>
      <div className="p-6 space-y-6">
        <div className="flex items-start gap-4">
          <Avatar name={c.fullName} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-title font-semibold tracking-[-0.014em] truncate">{c.fullName}</h2>
            <p className="text-caption text-muted num">{c.phone} · {c.referralCode}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Badge tone="accent">{TIER_LABEL[c.tier]} · {c.points} pts</Badge>
              {risk !== null && <Badge tone="warning"><AlertTriangle className="h-3 w-3" /> +{risk} días tarde</Badge>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="h-9 w-9 rounded-full bg-subtle flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[["Visitas", String(c.visitCount)], ["Gastado", money(c.totalSpent)], ["Ticket", money(c.visitCount ? c.totalSpent / c.visitCount : 0)]].map(([l, v]) => (
            <div key={l} className="p-3 rounded-[var(--radius-tile)] bg-subtle text-center">
              <p className="text-headline font-semibold num">{v}</p>
              <p className="text-micro text-faint">{l}</p>
            </div>
          ))}
        </div>

        <Tabs
          tabs={[
            {
              label: "Historial",
              content: (
                <div className="space-y-1">
                  {history.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-tile)] hover:bg-subtle">
                      <div className="flex-1 min-w-0">
                        <p className="text-body truncate">{a.serviceName}</p>
                        <p className="text-caption text-muted num">{dayLabel(a.start)} · {a.employeeName}</p>
                      </div>
                      <span className="text-caption font-semibold num">{money(a.price)}</span>
                      <StatusBadge status={a.status} />
                    </div>
                  ))}
                  {history.length === 0 && <p className="text-body text-muted py-6 text-center">Sin visitas registradas</p>}
                </div>
              ),
            },
            {
              label: "Beauty History",
              content: (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {(c.photos ?? []).map((p) => (
                      <figure key={p.id} className="rounded-[var(--radius-tile)] overflow-hidden bg-subtle">
                        <div className="aspect-[4/5] bg-gradient-to-br from-accent-soft to-inset flex items-center justify-center">
                          <Camera className="h-6 w-6 text-accent" />
                        </div>
                        <figcaption className="p-2">
                          <Badge tone={p.kind === "AFTER" ? "success" : "neutral"}>{p.kind === "AFTER" ? "Después" : p.kind === "BEFORE" ? "Antes" : "Estilo"}</Badge>
                          <p className="text-micro text-muted mt-1">{p.note}</p>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                  {(c.photos ?? []).length === 0 && (
                    <p className="text-body text-muted text-center py-6">Guarda fotos del resultado para repetir su estilo favorito 📸</p>
                  )}
                  <Button variant="secondary" className="w-full"
                    onClick={() => {
                      db.addPhoto(c.id, { kind: "AFTER", note: "Resultado del último estilo", takenAt: new Date().toISOString(), service: history[0]?.serviceName });
                      toast.success("Foto guardada en Beauty History");
                    }}>
                    <Camera className="h-4 w-4" /> Guardar resultado (antes/después)
                  </Button>
                  {history[0] && (
                    <p className="text-caption text-muted text-center">💡 “¿Quieres repetir tu último estilo? {history[0].serviceName}”</p>
                  )}
                </div>
              ),
            },
            {
              label: "Notas",
              content: (
                <div className="space-y-3">
                  {(c.notes ?? []).map((n) => (
                    <div key={n.id} className="p-3 rounded-[var(--radius-tile)] bg-subtle">
                      <p className="text-body">{n.note}</p>
                      <p className="text-micro text-faint mt-1 num">{dayLabel(n.createdAt)} · {n.by}</p>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Prefiere degradado bajo…" />
                    <Button disabled={!note.trim()} onClick={() => { db.addNote(c.id, note.trim()); setNote(""); toast.success("Nota guardada"); }}>+</Button>
                  </div>
                </div>
              ),
            },
          ]}
        />

        <div className="flex gap-2">
          <Button className="flex-1" variant={risk !== null ? "primary" : "secondary"}
            onClick={() => {
              if (!db.business.slug) { toast.error("Configura el enlace de tu negocio antes de compartirlo"); return; }
              const message = `Hola ${c.fullName.split(" ")[0]}, ¿ya es momento de tu próxima visita? Reserva aquí: ${publicBusinessUrl(db.business.slug)} 📲`;
              void runMutation(() => db.sendMessage(c.fullName, c.phone, message), () => toast.success("Recordatorio registrado en cola", { description: `Para ${c.fullName}; pendiente de entrega por el proveedor` }));
            }}>
            <MessageCircle className="h-4 w-4" /> {risk !== null ? "Enviar recordatorio" : "Escribir por WhatsApp"}
          </Button>
          <Button className="flex-1" variant="quiet"
            onClick={() => {
              void runMutation(() => db.addLoyalty(c.id, -100, "Canje de recompensa"), () => toast.success("Recompensa canjeada (-100 pts)"));
            }}>
            Canjear pts
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

/* ── Página Clientes ─────────────────────────────────────────────────────── */
export default function ClientsPage() {
  const db = useDB();
  const [q, setQ] = useState("");
  const [riskOnly, setRiskOnly] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const rows = useMemo(() => {
    return db.customers
      .filter((c) => c.fullName.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q))
      .filter((c) => !riskOnly || riskOf(c) !== null)
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [db.customers, q, riskOnly]);

  const riskCount = db.customers.filter((c) => riskOf(c) !== null).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title font-semibold tracking-[-0.014em]">Clientes</h1>
          <p className="text-body text-muted">{db.customers.length} clientes · {riskCount} fuera de su frecuencia</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…" className="pl-9 w-56" />
          </div>
          <Button size="sm" variant={riskOnly ? "primary" : "quiet"} onClick={() => setRiskOnly(!riskOnly)}>
            <AlertTriangle className="h-4 w-4" /> En riesgo ({riskCount})
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}><UserPlus className="h-4 w-4" /> Nuevo</Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <DataTable
            head={["Cliente", "Frecuencia", "Última visita", "Visitas", "Gastado", "Nivel"]}
            empty="Sin clientes que coincidan"
            rows={rows.map((c) => {
              const risk = riskOf(c);
              return [
                <button key={c.id} onClick={() => setSelected(c)} className="flex items-center gap-3 text-left">
                  <Avatar name={c.fullName} size="sm" />
                  <span>
                    <span className="block font-medium">{c.fullName}</span>
                    <span className="block text-caption text-muted num">{c.phone}</span>
                  </span>
                </button>,
                <span key="f" className="text-caption text-muted num">
                  ~{c.avgRecurrenceDays ?? "—"} días
                  {risk !== null && <Badge tone="warning" className="ml-2">+{risk}</Badge>}
                </span>,
                <span key="l" className="text-caption num">{c.lastVisitAt ? dayLabel(c.lastVisitAt) : "—"}</span>,
                <span key="v" className="num">{c.visitCount}</span>,
                <span key="s" className="font-semibold num">{money(c.totalSpent)}</span>,
                <Badge key="t" tone={c.tier === "VIP" ? "accent" : c.tier === "GOLD" ? "warning" : "neutral"}>{TIER_LABEL[c.tier]} · {c.points}pts</Badge>,
              ];
            })}
          />
        </CardContent>
      </Card>

      {/* Modal progreso de fidelización del más fiel */}
      <Card className="bg-gradient-to-r from-surface to-accent-soft">
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> Fidelización en vivo</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => toast.info("Programa: Starter → Silver → Gold → VIP")}>Ver niveles</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {db.customers.slice(0, 3).map((c) => (
            <div key={c.id}>
              <div className="flex justify-between text-caption mb-1.5">
                <span className="font-medium">{c.fullName} · {TIER_LABEL[c.tier]}</span>
                <span className="num text-muted">{c.points} / {TIER_NEXT[c.tier]} pts</span>
              </div>
              <Progress value={c.points} max={TIER_NEXT[c.tier]} />
            </div>
          ))}
        </CardContent>
      </Card>

      <ClientDrawer customer={selected} onClose={() => setSelected(null)} />

      <Modal open={newOpen} onClose={() => setNewOpen(false)}>
        <div className="space-y-4">
          <h2 className="text-title font-semibold tracking-[-0.014em]">Nuevo cliente</h2>
          <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="María Fernández" /></Field>
          <Field label="WhatsApp"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="987 654 321" inputMode="tel" /></Field>
          <Button className="w-full" disabled={!name.trim() || phone.trim().length < 6}
            onClick={() => {
              db.addCustomer({ fullName: name.trim(), phone: phone.trim() });
              toast.success("Cliente creado correctamente ✓");
              setNewOpen(false); setName(""); setPhone("");
            }}>Crear cliente</Button>
        </div>
      </Modal>
    </div>
  );
}
