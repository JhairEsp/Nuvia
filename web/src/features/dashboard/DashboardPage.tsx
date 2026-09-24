import { BranchReport } from "../settings/BranchesPage";
import { motion } from "framer-motion";
import {
  AlertTriangle, CalendarCheck, CircleDollarSign, Clock, Sparkles, Target, TrendingUp, UserPlus, Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, StatusBadge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Modal } from "../../components/ui/overlay";
import { StatCard } from "../../components/ui/stat-card";
import { money, moneyShort, timeLabel } from "../../lib/format";
import { buildDemandSeries, buildRevenueSeries, computeKpis, todayAppointments, useDB } from "../../store/db";
import { useSession } from "../../store/session";

const ease: [number, number, number, number] = [0.32, 0.72, 0, 1];

export default function DashboardPage() {
  const { user } = useSession();
  const db = useDB();
  const [riskOpen, setRiskOpen] = useState(false);
  const k = computeKpis(db);
  const today = todayAppointments(db.appointments);
  const atRisk = db.atRisk;
  const revSeries = useMemo(() => buildRevenueSeries(db.sales), [db.sales]);
  const demSeries = useMemo(() => buildDemandSeries(db.appointments), [db.appointments]);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  const delta = (curr: number, prev: number) => (prev ? Math.round(((curr - prev) / prev) * 100) : 0);

  return (
    <div className="space-y-8">
      <BranchReport />
      {/* Header */}
      <div>
        <p className="text-caption text-muted">{greeting},</p>
        <h1 className="text-title font-semibold tracking-[-0.014em]">
          {user?.fullName.split(" ")[0] ?? "Ricardo"} 👋
        </h1>
        <p className="text-body text-muted mt-1">
          Esta semana generaste <strong className="text-ink num">{money(k.revenue)}</strong> en {db.business.name}.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Ingresos (semana)" value={moneyShort(k.revenue)} delta={delta(k.revenue, k.revenuePrev)} icon={CircleDollarSign} index={0} />
        <StatCard label="Citas" value={String(k.appointments)} delta={delta(k.appointments, k.appointmentsPrev)} icon={CalendarCheck} index={1} />
        <StatCard label="Ticket promedio" value={money(k.ticketAvg)} delta={delta(k.ticketAvg, k.ticketPrev)} icon={TrendingUp} index={2} />
        <StatCard label="Ocupación" value={`${k.occupancy}%`} delta={delta(k.occupancy, k.occupancyPrev)} icon={Target} index={3} />
      </div>

      {/* Insight IA principal */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease }}
      >
        <Card className="overflow-hidden">
          <div className="flex flex-col sm:flex-row">
            <div className="flex-1 p-6 sm:p-8 space-y-3">
              <div className="flex items-center gap-2">
                <Badge tone="accent"><Sparkles className="h-3 w-3" /> Insight IA</Badge>
                <Badge tone="warning"><AlertTriangle className="h-3 w-3" /> Oportunidad</Badge>
              </div>
              <h2 className="text-headline font-semibold tracking-[-0.008em]">
                {db.insights[0]?.title}
              </h2>
              <p className="text-body text-muted max-w-xl">{db.insights[0]?.body}</p>
              <Button onClick={() => setRiskOpen(true)}>
                <Users className="h-4 w-4" /> {db.insights[0]?.cta}
              </Button>
            </div>
            <div className="sm:w-72 bg-accent-soft flex items-center justify-center p-8">
              <div className="text-center">
                <p className="text-[3.5rem] leading-none font-semibold text-accent num">{atRisk.length}</p>
                <p className="text-caption text-accent/80 mt-2 font-medium">clientes fuera de<br />su frecuencia</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Ingresos · últimos 14 días</CardTitle>
            <Badge tone="success">+12% vs previo</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revSeries} margin={{ left: -18, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--color-faint)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-faint)" }} axisLine={false} tickLine={false} tickFormatter={(v) => moneyShort(Number(v))} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-hairline)", borderRadius: 12, boxShadow: "var(--shadow-card)" }}
                    formatter={(v) => [money(Number(v)), "Ingresos"]}
                    labelStyle={{ color: "var(--color-muted)" }}
                  />
                  <Area type="monotone" dataKey="ingresos" stroke="var(--color-accent)" strokeWidth={2.5} fill="url(#rev)" animationDuration={900} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Demanda por día</CardTitle>
            <Badge tone="accent">§ ocupación</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demSeries} margin={{ left: -26, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "var(--color-faint)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-faint)" }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-hairline)", borderRadius: 12 }}
                    formatter={(v) => [`${v}%`, "Ocupación"]}
                    labelStyle={{ color: "var(--color-muted)" }}
                    cursor={{ fill: "var(--color-accent-soft)" }}
                  />
                  <Bar dataKey="ocupacion" radius={[8, 8, 4, 4]} animationDuration={900}>
                    {demSeries.map((d) => (
                      <Cell key={d.dia} fill={d.ocupacion < 50 ? "var(--color-warning)" : "var(--color-accent)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-caption text-muted mt-3">
              Los <strong className="text-warning">martes (41%)</strong> son tu día más flojo → ideal para promos.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agenda del día + insights */}
      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Agenda de hoy</CardTitle>
            <Badge>{today.length} citas</Badge>
          </CardHeader>
          <CardContent className="space-y-1">
            {today.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.4 + i * 0.05, ease }}
                className="flex items-center gap-4 px-3 py-3 rounded-[var(--radius-tile)] hover:bg-subtle transition-colors group"
              >
                <div className="text-center min-w-16">
                  <p className="text-caption font-semibold num">{timeLabel(a.start)}</p>
                  <p className="text-micro text-faint">{a.source === "LANDING" ? "web" : a.source.toLowerCase()}</p>
                </div>
                <div className="h-9 w-px bg-hairline" />
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium truncate">{a.customerName}</p>
                  <p className="text-caption text-muted truncate">
                    {a.serviceName} · {a.employeeName}
                  </p>
                </div>
                <span className="text-caption font-semibold num hidden sm:block">{money(a.price)}</span>
                <StatusBadge status={a.status} />
              </motion.div>
            ))}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recomendaciones</CardTitle>
              <Sparkles className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent className="space-y-3">
              {db.insights.slice(1).map((ins) => (
                <div key={ins.id} className="p-4 rounded-[var(--radius-tile)] bg-subtle space-y-1.5">
                  <p className="text-body font-medium">{ins.title}</p>
                  <p className="text-caption text-muted">{ins.body}</p>
                  {ins.cta && (
                    <button className="text-caption font-semibold text-accent hover:underline mt-1">
                      {ins.cta} →
                    </button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clientes nuevos</CardTitle>
              <UserPlus className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <p className="text-[2.5rem] leading-none font-semibold num">{k.newCustomers}</p>
              <p className="text-caption text-muted mt-2">esta semana · 3 por referidos 🎁</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal clientes en riesgo */}
      <Modal open={riskOpen} onClose={() => setRiskOpen(false)}>
        <div className="space-y-5">
          <div>
            <Badge tone="warning"><Clock className="h-3 w-3" /> Clientes en riesgo</Badge>
            <h2 className="text-title font-semibold tracking-[-0.014em] mt-3">Fuera de su frecuencia</h2>
            <p className="text-body text-muted mt-1">
              Solían volver cada X días. Ya pasó de más → un mensaje hoy puede recuperarlos.
            </p>
          </div>
          <ul className="space-y-2">
            {atRisk.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3 rounded-[var(--radius-tile)] bg-subtle">
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium truncate">{c.name}</p>
                  <p className="text-caption text-muted num">
                    vuelve cada ~{c.avgRecurrenceDays} días · +{c.daysOverdue} días tarde
                  </p>
                </div>
                <span className="text-caption font-semibold num">{money(c.totalSpent)}</span>
              </li>
            ))}
          </ul>
          <Button
            className="w-full"
            onClick={() => setRiskOpen(false)}
          >
            Enviar recordatorios por WhatsApp
          </Button>
          <p className="text-center text-micro text-faint">La IA personaliza cada mensaje ✨</p>
        </div>
      </Modal>
    </div>
  );
}
