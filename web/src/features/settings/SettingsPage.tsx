import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, Input, Textarea } from "../../components/ui/input";
import { useDB } from "../../store/db";

import PaymentQrSettings from "./PaymentQrSettings";

import BookingSettings from "./BookingSettings";

export default function SettingsPage() {
  const db = useDB();
  const [biz, setBiz] = useState(db.business);


  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-title font-semibold tracking-[-0.014em]">Ajustes</h1>
        <p className="text-body text-muted">Datos del negocio, horarios y reglas de reserva</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3"><Link className="bg-subtle rounded-2xl p-5 font-semibold" to="/app/settings/plan">Plan y facturación → Mi plan</Link><Link className="bg-subtle rounded-2xl p-5 font-semibold" to="/app/settings/branches">Sucursales → Gestionar ubicaciones y horarios</Link></div>

      <PaymentQrSettings />

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4 text-accent" /> Información del negocio</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nombre"><Input value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} /></Field>
            <Field label="Tipo">
              <select value={biz.type} onChange={(e) => setBiz({ ...biz, type: e.target.value })} className="w-full h-11 px-3 rounded-[var(--radius-control)] bg-subtle text-body">
                {["BARBERSHOP", "SALON", "SPA", "AESTHETICS", "NAILS", "LASHES", "BROWS", "MASSAGE", "OTHER"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Teléfono"><Input value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} /></Field>
            <Field label="WhatsApp"><Input value={biz.whatsapp} onChange={(e) => setBiz({ ...biz, whatsapp: e.target.value })} /></Field>
          </div>
          <Field label="Descripción"><Textarea value={biz.description} onChange={(e) => setBiz({ ...biz, description: e.target.value })} /></Field>
          <Field label="Dirección"><Input value={biz.address} onChange={(e) => setBiz({ ...biz, address: e.target.value })} /></Field>
          <Button onClick={() => toast.success("Información guardada ✓")}>Guardar cambios</Button>
        </CardContent>
      </Card>

      <BookingSettings />
    </div>
  );
}
