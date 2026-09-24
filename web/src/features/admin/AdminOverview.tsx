import { BRAND_NAME } from "../../lib/brand";
import { motion } from "framer-motion";
import { Building2, CalendarCheck, CircleDollarSign, CreditCard, TrendingUp, UserCog, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { StatCard } from "../../components/ui/stat-card";
import { moneyShort, money } from "../../lib/format";
import { useMemo } from "react";
import { useDB } from "../../store/db";

/** Dashboard independiente del Super Admin (§2, §37). */
export default function AdminOverview() {
  const db = useDB();
  const k = db.platform.kpis;
  const growth = useMemo(() => {
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const now = new Date();
    const out: Array<{ mes: string; negocios: number; mrr: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const inMonth = db.platform.businesses.filter((b) => {
        const t = b.createdAt ? new Date(b.createdAt) : null;
        return !!t && t.getMonth() === d.getMonth() && t.getFullYear() === d.getFullYear();
      });
      out.push({ mes: months[d.getMonth()] ?? "", negocios: inMonth.length, mrr: inMonth.reduce((a, b) => a + b.mrr, 0) });
    }
    return out;
  }, [db.platform.businesses]);
  return (
    <div className="space-y-8">
      <div>
        <p className="text-caption text-muted">Plataforma {BRAND_NAME}</p>
        <h1 className="text-title font-semibold tracking-[-0.014em]">Overview</h1>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Negocios activos" value={String(k.activeBusinesses)} icon={Building2} index={0} />
        <StatCard label="Usuarios" value={String(k.users)} icon={Users} index={1} />
        <StatCard label="Citas este mes" value={k.monthAppointments.toLocaleString("es-PE")} icon={CalendarCheck} index={2} />
        <StatCard label="MRR" value={moneyShort(k.mrr)} icon={CircleDollarSign} index={3} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Crecimiento · negocios y MRR</CardTitle>
            <Badge tone="neutral">Datos actuales</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth} margin={{ left: -10, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="mrr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--color-faint)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-faint)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-hairline)", borderRadius: 12 }}
                    formatter={(v, n) => [n === "mrr" ? money(Number(v)) : v, n === "mrr" ? "MRR" : "Negocios"]}
                    labelStyle={{ color: "var(--color-muted)" }}
                  />
                  <Area type="monotone" dataKey="negocios" stroke="var(--color-muted)" strokeWidth={2} fill="transparent" strokeDasharray="4 4" animationDuration={900} />
                  <Area type="monotone" dataKey="mrr" stroke="var(--color-accent)" strokeWidth={2.5} fill="url(#mrr)" animationDuration={900} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plataforma</CardTitle>
            <CreditCard className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-body text-muted">Ventas procesadas</span>
              <span className="text-body font-semibold num">{k.processedSales.toLocaleString("es-PE")}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-body text-muted">Suspendidos</span>
              <span className="text-body font-semibold num">{k.suspendedBusinesses}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-body text-muted">Nuevos (mes)</span>
              <span className="text-body font-semibold num text-success">+{k.newThisMonth}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-body text-muted">Churn</span>
              <span className="text-body font-semibold num">No disponible</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Negocios recientes</CardTitle>
          <Badge tone="accent"><TrendingUp className="h-3 w-3" /> actividad</Badge>
        </CardHeader>
        <CardContent className="space-y-1">
          {db.platform.businesses.map((b, i) => (
            <motion.div
              key={b.slug}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              className="flex items-center gap-4 px-3 py-3 rounded-[var(--radius-tile)] hover:bg-subtle transition-colors"
            >
              <div className="h-9 w-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
                <UserCog className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body font-medium truncate">{b.name}</p>
                <p className="text-caption text-muted">/b/{b.slug} · {b.users} usuarios · plan {b.plan}</p>
              </div>
              <Badge tone={b.status === "ACTIVE" ? "success" : b.status === "TRIAL" ? "accent" : "danger"}>
                {b.status}
              </Badge>
              <span className="text-caption font-semibold num w-16 text-right">{b.mrr ? moneyShort(b.mrr) : "—"}</span>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
