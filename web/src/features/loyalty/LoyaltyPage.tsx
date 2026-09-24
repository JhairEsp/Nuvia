import { Gift, Percent, Plus, Sparkles, Ticket, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { DataTable } from "../../components/ui/table";
import { Field, Input, Textarea } from "../../components/ui/input";
import { Modal } from "../../components/ui/overlay";
import { Progress, Tabs } from "../../components/ui/tabs";
import { runMutation } from "../../lib/mutations";
import { money } from "../../lib/format";
import { useDB } from "../../store/db";
import type { Promotion } from "../../types/domain";

const TIER_NEXT: Record<string, number> = { STARTER: 250, SILVER: 500, GOLD: 800, VIP: 1200 };
const TIER_LABEL: Record<string, string> = { STARTER: "Starter", SILVER: "Silver", GOLD: "Gold", VIP: "VIP" };

export default function LoyaltyPage() {
  const db = useDB();
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const mutate = async (action: () => Promise<void>, success: () => void) => { if (busy) return; setBusy(true); try { await runMutation(action, success); } finally { setBusy(false); } };
  const [promo, setPromo] = useState<Promotion | null>(null);

  const top = [...db.customers].sort((a, b) => b.points - a.points).slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-semibold tracking-[-0.014em]">Fidelización & Promos</h1>
        <p className="text-body text-muted">Puntos, niveles, referidos y promociones que llenan tu agenda</p>
      </div>

      <Tabs
        tabs={[
          {
            label: "Fidelización", icon: <Sparkles className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <Card>
                  <CardHeader><CardTitle>Niveles</CardTitle></CardHeader>
                  <CardContent className="grid sm:grid-cols-4 gap-3">
                    {[["STARTER", "0 pts"], ["SILVER", "250 pts"], ["GOLD", "500 pts"], ["VIP", "800 pts"]].map(([t, p]) => (
                      <div key={t} className={`p-4 rounded-[var(--radius-tile)] text-center ${t === "VIP" ? "bg-accent-soft" : "bg-subtle"}`}>
                        <p className="text-headline font-semibold">{(TIER_LABEL as Record<string, string>)[t ?? ""] ?? t ?? ""}</p>
                        <p className="text-caption text-muted num">{p}</p>
                        <p className="text-micro text-faint mt-1">{db.customers.filter((c) => c.tier === t).length} clientes</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Top miembros</CardTitle><Badge tone="accent">{db.loyaltyTxs.length}</Badge></CardHeader>
                  <CardContent className="space-y-4">
                    {top.map((c) => (
                      <div key={c.id}>
                        <div className="flex justify-between text-caption mb-1.5">
                          <span className="font-medium flex items-center gap-2"><UserRound className="h-3.5 w-3.5 text-accent" />{c.fullName} · {TIER_LABEL[c.tier]}</span>
                          <span className="num text-muted">{c.points} / {TIER_NEXT[c.tier] ?? 1200} pts</span>
                        </div>
                        <Progress value={c.points} max={TIER_NEXT[c.tier] ?? 1200} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Historial de puntos</CardTitle></CardHeader>
                  <CardContent>
                    <DataTable
                      head={["Cliente", "Tipo", "Motivo", "Puntos"]}
                      rows={db.loyaltyTxs.slice(page*20, (page+1)*20).map((t) => {
                        const c = db.customers.find((x) => x.id === t.customerId);
                        return [
                          <span key="c">{c?.fullName ?? "—"}</span>,
                          <Badge key="t" tone={t.points >= 0 ? "success" : "warning"}>{t.points >= 0 ? "Ganados" : "Canjeados"}</Badge>,
                          <span key="r" className="text-caption text-muted">{t.reason}</span>,
                          <span key="p" className="num font-semibold">{t.points > 0 ? "+" : ""}{t.points}</span>,
                        ];
                      })}
                    />
                    <div className="flex items-center gap-3 mt-4"><Button size="sm" variant="quiet" disabled={page===0} onClick={()=>setPage(page-1)}>Anterior</Button><span className="text-caption">{db.loyaltyTxs.length} movimientos · página {page+1}</span><Button size="sm" variant="quiet" disabled={(page+1)*20>=db.loyaltyTxs.length} onClick={()=>setPage(page+1)}>Siguiente</Button></div>
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            label: "Referidos", icon: <Gift className="h-3.5 w-3.5" />,
            content: (
              <Card>
                <CardHeader><CardTitle>Programa de referidos</CardTitle><Badge>«Cliente A invita a B → A gana 100 pts»</Badge></CardHeader>
                <CardContent>
                  <DataTable
                    head={["Código", "Refiere", "Invitado", "Estado", "Recompensa"]}
                    rows={db.referrals.map((r) => [
                      <span key="c" className="font-mono text-caption font-semibold">{r.code}</span>,
                      <span key="rf">{r.referrerName}</span>,
                      <span key="rd" className="text-caption text-muted">{r.referredName ?? "—"}</span>,
                      <Badge key="s" tone={r.status === "REWARDED" ? "success" : r.status === "COMPLETED" ? "accent" : "neutral"}>
                        {r.status === "REWARDED" ? "Recompensado" : r.status === "COMPLETED" ? "Completado" : "Pendiente"}
                      </Badge>,
                      <span key="p" className="num">+{r.rewardPoints} pts</span>,
                    ])}
                  />
                  <Button className="mt-4" variant="secondary" onClick={() => toast.success("Cada cliente ya tiene su código único en su perfil 💎")}>
                    <Ticket className="h-4 w-4" /> Ver códigos en Clientes
                  </Button>
                </CardContent>
              </Card>
            ),
          },
          {
            label: "Promociones", icon: <Percent className="h-3.5 w-3.5" />,
            content: (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setPromo({ id: crypto.randomUUID(), name: "", description: "", discountPercent: 10, startsAt: new Date().toISOString().slice(0, 10), endsAt: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), isActive: true, showOnWebsite: true })}>
                    <Plus className="h-4 w-4" /> Nueva promoción
                  </Button>
                </div>
                {db.promos.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="flex flex-wrap items-center gap-4 py-5">
                      <div className="h-14 w-14 rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
                        <Percent className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-40">
                        <p className="text-headline font-semibold">{p.name}</p>
                        <p className="text-caption text-muted">{p.description}</p>
                        <p className="text-micro text-faint num mt-1">{p.startsAt} → {p.endsAt}</p>
                      </div>
                      {p.price && <p className="text-title font-semibold num" style={{ color: "var(--color-accent)" }}>{money(p.price)}</p>}
                      <Badge tone="warning">-{p.discountPercent}%</Badge>
                      <Badge tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Activa" : "Pausada"}</Badge>
                      <div className="flex gap-2">
                        <Button size="sm" variant="quiet" onClick={() => setPromo(p)}>Editar</Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void mutate(() => db.togglePromo(p.id), () => toast.success(p.isActive ? "Promo pausada" : "Promo activada"))}>
                          {p.isActive ? "Pausar" : "Activar"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ),
          },
        ]}
      />

      {promo && (
        <Modal open onClose={() => !busy && setPromo(null)}>
          <div className="space-y-4">
            <h2 className="text-title font-semibold tracking-[-0.014em]">Promoción</h2>
            <Field label="Nombre"><Input value={promo.name} onChange={(e) => setPromo({ ...promo, name: e.target.value })} placeholder="Martes Beauty" /></Field>
            <Field label="Descripción"><Textarea value={promo.description} onChange={(e) => setPromo({ ...promo, description: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Precio (S/)"><Input type="number" value={promo.price ?? 0} onChange={(e) => setPromo({ ...promo, price: +e.target.value })} /></Field>
              <Field label="Desc. (%)"><Input type="number" value={promo.discountPercent} onChange={(e) => setPromo({ ...promo, discountPercent: +e.target.value })} /></Field>
              <Field label="Servicio">
                <select value={promo.serviceId ?? ""} onChange={(e) => setPromo({ ...promo, serviceId: e.target.value })} className="w-full h-11 px-3 rounded-[var(--radius-control)] bg-subtle text-body">
                  <option value="">—</option>
                  {db.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Desde"><Input type="date" value={promo.startsAt} onChange={(e) => setPromo({ ...promo, startsAt: e.target.value })} /></Field>
              <Field label="Hasta"><Input type="date" value={promo.endsAt} onChange={(e) => setPromo({ ...promo, endsAt: e.target.value })} /></Field>
            </div>
            <Button className="w-full" loading={busy} disabled={!promo.name.trim()}
              onClick={() => void mutate(() => db.savePromo(promo), () => { toast.success("Promoción guardada"); setPromo(null); })}>
              Guardar promoción
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
