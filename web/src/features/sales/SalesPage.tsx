import { planError } from "../../store/capabilities";
import { Banknote, CreditCard, Minus, Package, Plus, Scissors, ShoppingBag, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, Input } from "../../components/ui/input";
import { money } from "../../lib/format";
import { useDB } from "../../store/db";
import type { PaymentMethod, SaleItem } from "../../types/domain";

const METHODS: Array<{ id: PaymentMethod; label: string; icon: typeof Banknote }> = [
  { id: "CASH", label: "Efectivo", icon: Banknote },
  { id: "YAPE", label: "Yape", icon: Smartphone },
  { id: "PLIN", label: "Plin", icon: Smartphone },
  { id: "CARD", label: "Tarjeta", icon: CreditCard },
];

/** POS (§25) — cobro con split de pagos, comisiones y puntos automáticos. */
export default function SalesPage() {
  const db = useDB();
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [customerId, setCustomerId] = useState(db.customers[0]?.id ?? "");
  const [employeeId, setEmployeeId] = useState(db.employees[0]?.id ?? "");
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("YAPE");
  const [ref, setRef] = useState("");
  useEffect(() => { setCart([]); setDiscount(0); setRef(""); }, [db.locationId]);
  useEffect(() => { setEmployeeId(db.employees[0]?.id ?? ""); }, [db.employees]);

  const subtotal = cart.reduce((a, i) => a + i.unitPrice * i.qty, 0);
  const total = Math.max(0, subtotal - discount);

  const add = (kind: "SERVICE" | "PRODUCT", id: string, description: string, unitPrice: number) => {
    setCart((c) => {
      const ex = c.find((i) => i.refId === id);
      if (ex) return c.map((i) => (i.refId === id ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * i.unitPrice - i.discount } : i));
      return [...c, { id: `i${c.length}`, kind, refId: id, description, qty: 1, unitPrice, discount: 0, total: unitPrice, employeeId: kind === "SERVICE" ? employeeId : undefined }];
    });
  };

  const recent = useMemo(() => db.sales.slice(0, 8), [db.sales]);
  const mix = cart.length ? null : null;

  const [saving, setSaving] = useState(false);
  const charge = async () => {
    if (cart.length === 0 || saving) return;
    setSaving(true);
    try {
    await db.createSale({
      customerId, employeeId, items: cart, discountTotal: discount,
      payments: [{ method, amount: total, reference: ref }],
      createdBy: "",
    });
    toast.success(`Venta registrada · ${money(total)} 🎉`, {
      description: method === "YAPE" || method === "PLIN" ? `Op. ${ref || "—"}` : METHODS.find((m) => m.id === method)?.label,
    });
    setCart([]); setDiscount(0); setRef("");
    } catch (e) { toast.error(planError(e)); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-semibold tracking-[-0.014em]">Ventas & POS</h1>
        <p className="text-body text-muted">Cobra servicios y productos · comisiones y puntos se aplican solos</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Catálogo */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Scissors className="h-4 w-4 text-accent" /> Servicios</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-2">
              {db.services.filter((s) => s.active).map((s) => (
                <button key={s.id} onClick={() => add("SERVICE", s.id, s.name, s.price)}
                  className="flex justify-between items-center p-3.5 rounded-[var(--radius-tile)] bg-subtle hover:bg-inset transition-colors text-left">
                  <span>
                    <span className="block text-body font-medium">{s.name}</span>
                    <span className="block text-micro text-faint num">{s.durationMin} min</span>
                  </span>
                  <span className="text-body font-semibold num">{money(s.price)}</span>
                </button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-4 w-4 text-accent" /> Productos</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-2">
              {db.products.filter((p) => p.active).map((p) => (
                <button key={p.id} onClick={() => p.stock > 0 && add("PRODUCT", p.id, p.name, p.price)} disabled={p.stock === 0}
                  className="flex justify-between items-center p-3.5 rounded-[var(--radius-tile)] bg-subtle hover:bg-inset transition-colors text-left disabled:opacity-40">
                  <span>
                    <span className="block text-body font-medium">{p.name}</span>
                    <span className="block text-micro text-faint num">stock {p.stock}</span>
                  </span>
                  <span className="text-body font-semibold num">{money(p.price)}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ventas recientes</CardTitle><Badge>{recent.length}</Badge></CardHeader>
            <CardContent className="space-y-1">
              {recent.length === 0 && <p className="text-body text-muted py-4 text-center">Todavía no hay ventas con POS — registra la primera arriba 👆</p>}
              {recent.map((v) => (
                <div key={v.id} className="flex items-center gap-3 px-2 py-2.5 rounded-[var(--radius-tile)] hover:bg-subtle">
                  <span className="text-caption text-muted num flex-1 truncate">
                    {v.items.map((i) => i.description).join(", ")}
                  </span>
                  <Badge tone="accent">{v.payments[0]?.method ?? "—"}</Badge>
                  <span className="text-body font-semibold num">{money(v.total)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Carrito */}
        <Card className="lg:col-span-2 h-fit lg:sticky lg:top-24">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-accent" /> Ticket actual</CardTitle>
            <Badge tone={cart.length ? "success" : "neutral"}>{cart.length} ítems</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Cliente">
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full h-11 px-3 rounded-[var(--radius-control)] bg-subtle text-body">
                  {db.customers.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                </select>
              </Field>
              <Field label="Atendió">
                <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full h-11 px-3 rounded-[var(--radius-control)] bg-subtle text-body">
                  {db.employees.map((e) => <option key={e.id} value={e.id}>{e.fullName.split(" ")[0]}</option>)}
                </select>
              </Field>
            </div>

            <div className="space-y-1.5 min-h-20">
              {cart.map((i) => (
                <div key={i.id} className="flex items-center gap-2 p-2.5 rounded-[var(--radius-tile)] bg-subtle">
                  <span className="flex-1 text-caption font-medium truncate">{i.description}</span>
                  <button onClick={() => setCart((c) => c.map((x) => x.refId === i.refId && x.qty > 1 ? { ...x, qty: x.qty - 1, total: (x.qty - 1) * x.unitPrice } : x))} className="text-muted hover:text-ink"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="text-caption num w-5 text-center">{i.qty}</span>
                  <button onClick={() => add(i.kind, i.refId!, i.description, i.unitPrice)} className="text-muted hover:text-ink"><Plus className="h-3.5 w-3.5" /></button>
                  <span className="text-caption font-semibold num w-14 text-right">{money(i.total)}</span>
                  <button onClick={() => setCart((c) => c.filter((x) => x.id !== i.id))} className="text-muted hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {cart.length === 0 && <p className="text-body text-muted text-center py-4">Toca servicios o productos para empezar</p>}
            </div>

            <div className="flex gap-2 items-end">
              <Field label="Descuento (S/)"><Input type="number" value={discount} onChange={(e) => setDiscount(+e.target.value)} className="w-28" /></Field>
              <div className="flex-1 text-right pb-1">
                <p className="text-micro text-faint">Total a cobrar</p>
                <p className="text-[2rem] leading-none font-semibold num">{money(total)}</p>
              </div>
            </div>

            <div>
              <p className="text-caption font-semibold mb-1.5">Método de pago</p>
              <div className="grid grid-cols-4 gap-1.5">
                {METHODS.map((m) => (
                  <button key={m.id} onClick={() => setMethod(m.id)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-[var(--radius-tile)] border text-micro font-medium transition-all ${method === m.id ? "border-accent bg-accent-soft text-accent" : "border-hairline text-muted hover:border-accent/40"}`}>
                    <m.icon className="h-4 w-4" />{m.label}
                  </button>
                ))}
              </div>
            </div>
            {(method === "YAPE" || method === "PLIN") && (
              <Field label="Nº de operación"><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="OP-000123" /></Field>
            )}

            <Button className="w-full h-13 text-headline" disabled={cart.length === 0} onClick={() => void charge()} loading={saving}>
              Cobrar {money(total)}
            </Button>
            <p className="text-center text-micro text-faint">
              Al cobrar: comisiones + puntos de fidelización automáticos ✓
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
