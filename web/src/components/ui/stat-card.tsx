import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "./card";

export function StatCard({
  label,
  value,
  delta,
  deltaLabel = "vs semana pasada",
  icon: Icon,
  index = 0,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  icon: LucideIcon;
  index?: number;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: [0.32, 0.72, 0, 1] }}
    >
      <Card className="p-6 group hover:shadow-[var(--shadow-float)] hover:-translate-y-0.5 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <span className="text-caption font-medium text-muted">{label}</span>
          <div className="h-9 w-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </div>
        </div>
        <div className="text-[2rem] leading-none font-semibold tracking-[-0.02em] num">{value}</div>
        {delta !== undefined && (
          <div className="mt-3 flex items-center gap-1.5 text-caption">
            <span
              className={`inline-flex items-center gap-0.5 font-semibold num ${up ? "text-success" : "text-danger"}`}
            >
              {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(delta)}%
            </span>
            <span className="text-faint">{deltaLabel}</span>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
