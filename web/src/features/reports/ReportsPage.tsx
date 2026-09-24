import { BranchReport } from "../settings/BranchesPage";
import { motion } from "framer-motion";
import { BarChart3, Download, PieChart, TrendingUp, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart as RPie, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { DataTable } from "../../components/ui/table";
import { money, moneyShort } from "../../lib/format";
import { buildDemandSeries, buildRevenueSeries, computeKpis, useDB } from "../../store/db";

const PAY_LABEL: Record<string, string> = { CASH: "Efectivo", YAPE: "Yape", PLIN: "Plin", CARD: "Tarjeta", OTHER: "Otros" };

export default function ReportsPage() {
  const db = useDB();
  const k = computeKpis(db);
  const revSeries = buildRevenueSeries(db.sales);
  const demSeries = buildDemandSeries(db.appointments);

  const staff = db.employees.map((e) => {
    const items = db.sales.flatMap((v) => v.items.filter((i) => i.employeeId === e.id));
    const rev = items.reduce((a, i) => a + i.total, 0);
    const comm = db.commissions.filter((c) => c.employeeId === e.id);
    return {
      name: e.fullName,
      appts: db.appointments.filter((a) => a.employeeId === e.id && a.status === "COMPLETED").length,
      rev, ticket: items.length ? rev / items.length : 0,
      commission: comm.reduce((a, c) => a + c.amount, 0),
    };
  }).sort((a, b) => b.rev - a.rev);

  const mixData = (Object.entries(k.paymentMix) as Array<[string, number]>)
    .filter(([, v]) => v > 0)
    .map(([method, value]) => ({ name: PAY_LABEL[method] ?? method, value }));
  const mixColors = ["var(--color-accent)", "var(--color-success)", "var(--color-warning)", "var(--color-muted)", "var(--color-faint)"];

  return (
    <div className="space-y-6">
      <BranchReport />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title font-semibold tracking-[-0.014em]">Reportes & Analítica</h1>
          <p className="text-body text-muted">Ingresos, demanda, equipo y métodos de pago · exportables</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => window.print()}>
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-accent" /> Ingresos (14 días)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revSeries} margin={{ left: -12, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--color-faint)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-faint)" }} axisLine={false} tickLine={false} tickFormatter={(v) => moneyShort(Number(v))} />
                  <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-hairline)", borderRadius: 12 }} formatter={(v) => [money(Number(v)), "Ingresos"]} labelStyle={{ color: "var(--color-muted)" }} cursor={{ fill: "var(--color-accent-soft)" }} />
                  <Bar dataKey="ingresos" radius={[6, 6, 3, 3]} animationDuration={900}>
                    {revSeries.map((d, i) => <Cell key={d.day} fill={i > 6 ? "var(--color-accent)" : "var(--color-muted)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><PieChart className="h-4 w-4 text-accent" /> Métodos de pago (semana)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RPie>
                  <Pie data={mixData} dataKey="value" nameKey="name" innerRadius={64} outerRadius={96} paddingAngle={3} animationDuration={900}>
                    {mixData.map((_, i) => <Cell key={i} fill={mixColors[i % mixColors.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-hairline)", borderRadius: 12 }} formatter={(v) => money(Number(v))} labelStyle={{ color: "var(--color-muted)" }} />
                </RPie>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-accent" /> Demanda por día (§29)</CardTitle>
          <Badge tone="warning">Martes flojo → oportunidad</Badge>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demSeries} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "var(--color-faint)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-faint)" }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-hairline)", borderRadius: 12 }} formatter={(v) => [`${v}%`, "Ocupación"]} labelStyle={{ color: "var(--color-muted)" }} cursor={{ fill: "var(--color-accent-soft)" }} />
                <Bar dataKey="ocupacion" radius={[8, 8, 4, 4]} animationDuration={900}>
                  {demSeries.map((d) => <Cell key={d.dia} fill={d.ocupacion < 50 ? "var(--color-warning)" : "var(--color-accent)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4 text-accent" /> Desempeño del equipo</CardTitle></CardHeader>
        <CardContent>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <DataTable
              head={["Trabajador", "Citas completadas", "Ventas", "Ticket prom.", "Comisiones"]}
              rows={staff.map((s) => [
                <span key="n" className="font-medium">{s.name}</span>,
                <span key="a" className="num">{s.appts}</span>,
                <span key="v" className="num font-semibold">{money(s.rev)}</span>,
                <span key="t" className="num text-muted">{money(s.ticket)}</span>,
                <span key="c" className="num">{money(s.commission)}</span>,
              ])}
            />
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}
