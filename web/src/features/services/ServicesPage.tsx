import { runMutation } from "../../lib/mutations";
import { Clock, Eye, EyeOff, Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, Input, Textarea } from "../../components/ui/input";
import { Modal } from "../../components/ui/overlay";
import { Switch } from "../../components/ui/switch";
import { money } from "../../lib/format";
import { useDB } from "../../store/db";
import type { Service } from "../../types/domain";

const empty = (): Service => ({ id: crypto.randomUUID(), name: "", description: "", durationMin: 30, price: 0, category: "Cortes", showOnWebsite: true, active: true });

export default function ServicesPage() {
  const db = useDB();
  const [editing, setEditing] = useState<Service | null>(null);

  const categories = [...new Set(db.services.map((s) => s.category ?? "General"))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title font-semibold tracking-[-0.014em]">Servicios</h1>
          <p className="text-body text-muted">{db.services.length} servicios · los marcados se publican en tu página</p>
        </div>
        <Button size="sm" onClick={() => setEditing(empty())}><Plus className="h-4 w-4" /> Nuevo servicio</Button>
      </div>

      {categories.map((cat) => (
        <Card key={cat}>
          <CardHeader><CardTitle>{cat}</CardTitle>
            <Badge>{db.services.filter((s) => (s.category ?? "General") === cat).length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {db.services.filter((s) => (s.category ?? "General") === cat).map((s) => (
              <div key={s.id} className="flex items-center gap-4 p-4 rounded-[var(--radius-tile)] bg-subtle hover:bg-inset transition-colors">
                <div className="h-10 w-10 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
                  <Scissors className="h-4 w-4" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium">{s.name}</p>
                  <p className="text-caption text-muted truncate">{s.description || "Sin descripción"}</p>
                </div>
                <span className="text-caption text-muted num flex items-center gap-1"><Clock className="h-3 w-3" />{s.durationMin} min</span>
                <span className="text-body font-semibold num w-16 text-right">{money(s.price)}</span>
                <button
                  title={s.showOnWebsite ? "Visible en tu página" : "Oculto en tu página"}
                  onClick={() => void runMutation(() => db.saveService({ ...s, showOnWebsite: !s.showOnWebsite }), () => toast.success(s.showOnWebsite ? "Oculto de tu página" : "Visible en tu página"))}
                  className="text-muted hover:text-accent transition-colors">
                  {s.showOnWebsite ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button onClick={() => setEditing(s)} className="text-muted hover:text-accent transition-colors"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => { db.removeService(s.id); toast.success("Servicio eliminado"); }} className="text-muted hover:text-danger transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {editing && (
        <Modal open onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <h2 className="text-title font-semibold tracking-[-0.014em]">{db.services.some((x) => x.id === editing.id) ? "Editar servicio" : "Nuevo servicio"}</h2>
            <Field label="Nombre"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Corte Premium" /></Field>
            <Field label="Descripción"><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Corte personalizado con lavado…" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Duración (min)"><Input type="number" value={editing.durationMin} onChange={(e) => setEditing({ ...editing, durationMin: +e.target.value })} /></Field>
              <Field label="Precio (S/)"><Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: +e.target.value })} /></Field>
              <Field label="Categoría"><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></Field>
            </div>
            <div className="flex items-center justify-between p-3 rounded-[var(--radius-tile)] bg-subtle">
              <span className="text-body">Mostrar en mi página</span>
              <Switch checked={editing.showOnWebsite} onChange={(v) => setEditing({ ...editing, showOnWebsite: v })} />
            </div>
            <Button className="w-full" disabled={!editing.name.trim()}
              onClick={() => void runMutation(() => db.saveService(editing), () => { toast.success("Servicio guardado"); setEditing(null); })}>
              Guardar servicio
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
