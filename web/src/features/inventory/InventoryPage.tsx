import { runMutation } from "../../lib/mutations";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Package, Pencil, Plus, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { DataTable } from "../../components/ui/table";
import { Field, Input } from "../../components/ui/input";
import { Modal } from "../../components/ui/overlay";
import { money } from "../../lib/format";
import { useDB } from "../../store/db";
import type { Product } from "../../types/domain";

const empty = (): Product => ({ id: crypto.randomUUID(), name: "", sku: "", category: "Styling", price: 0, cost: 0, stock: 0, stockMin: 3, active: true });

export default function InventoryPage() {
  const db = useDB();
  const [editing, setEditing] = useState<Product | null>(null);
  const [moving, setMoving] = useState<{ p: Product; type: "IN" | "OUT" | "ADJUSTMENT" } | null>(null);
  const [qty, setQty] = useState(1);
  const low = db.products.filter((p) => p.stock <= p.stockMin);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title font-semibold tracking-[-0.014em]">Inventario</h1>
          <p className="text-body text-muted">{db.products.length} productos · {low.length} con stock bajo</p>
        </div>
        <Button size="sm" onClick={() => setEditing(empty())}><Plus className="h-4 w-4" /> Nuevo producto</Button>
      </div>

      {low.length > 0 && (
        <Card className="border-warning/40 bg-warning/[0.06]">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <p className="text-body">
              <strong>Stock bajo:</strong> {low.map((p) => `${p.name} (${p.stock})`).join(" · ")} — pide reposición antes de quedarte sin nada.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-4 w-4 text-accent" /> Productos</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            head={["Producto", "SKU", "Precio", "Costo", "Stock", "Acciones"]}
            empty="Sin productos aún"
            rows={db.products.map((p) => [
              <span key="n" className="font-medium">
                {p.name}
                {p.stock <= p.stockMin && <Badge tone="warning" className="ml-2">stock bajo</Badge>}
              </span>,
              <span key="sku" className="text-caption text-muted num">{p.sku}</span>,
              <span key="pr" className="num">{money(p.price)}</span>,
              <span key="co" className="num text-muted">{money(p.cost)}</span>,
              <span key="st" className="num font-semibold">{p.stock} <span className="text-micro text-faint">/ min {p.stockMin}</span></span>,
              <span key="ac" className="flex gap-1 justify-end">
                <Button size="sm" variant="quiet" onClick={() => { setMoving({ p, type: "IN" }); setQty(1); }} title="Entrada"><ArrowDownLeft className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="quiet" onClick={() => { setMoving({ p, type: "OUT" }); setQty(1); }} title="Salida"><ArrowUpRight className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="quiet" onClick={() => { setMoving({ p, type: "ADJUSTMENT" }); setQty(p.stock); }} title="Ajustar"><SlidersHorizontal className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
              </span>,
            ])}
          />
        </CardContent>
      </Card>

      {editing && (
        <Modal open onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <h2 className="text-title font-semibold tracking-[-0.014em]">{db.products.some((x) => x.id === editing.id) ? "Editar producto" : "Nuevo producto"}</h2>
            <Field label="Nombre"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Pomada Mate" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SKU"><Input value={editing.sku} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} placeholder="BH-POM-001" /></Field>
              <Field label="Categoría"><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></Field>
              <Field label="Precio (S/)"><Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: +e.target.value })} /></Field>
              <Field label="Costo (S/)"><Input type="number" value={editing.cost} onChange={(e) => setEditing({ ...editing, cost: +e.target.value })} /></Field>
              <Field label="Stock"><Input type="number" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: +e.target.value })} /></Field>
              <Field label="Stock mínimo"><Input type="number" value={editing.stockMin} onChange={(e) => setEditing({ ...editing, stockMin: +e.target.value })} /></Field>
            </div>
            <Button className="w-full" disabled={!editing.name.trim()}
              onClick={() => void runMutation(() => db.saveProduct(editing), () => { toast.success("Producto guardado"); setEditing(null); })}>
              Guardar producto
            </Button>
          </div>
        </Modal>
      )}

      {moving && (
        <Modal open onClose={() => setMoving(null)}>
          <div className="space-y-4">
            <h2 className="text-title font-semibold tracking-[-0.014em]">
              {moving.type === "IN" ? "Entrada de stock" : moving.type === "OUT" ? "Salida de stock" : "Ajustar inventario"}
            </h2>
            <p className="text-body text-muted">{moving.p.name} · actual: {moving.p.stock}</p>
            <Field label="Cantidad"><Input type="number" value={qty} onChange={(e) => setQty(+e.target.value)} /></Field>
            <Button className="w-full"
              onClick={() => void runMutation(() => db.adjustStock(moving.p.id, moving.type, qty), () => { toast.success("Inventario actualizado"); setMoving(null); })}>
              Confirmar
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
