import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Tabs({
  tabs,
  initial = 0,
  className,
}: {
  tabs: Array<{ label: string; icon?: ReactNode; content: ReactNode }>;
  initial?: number;
  className?: string;
}) {
  const [active, setActive] = useState(initial);
  return (
    <div className={className}>
      <div className="flex gap-1 p-1 bg-subtle rounded-full w-fit max-w-full overflow-x-auto">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActive(i)}
            className={cn(
              "relative px-4 h-9 rounded-full text-caption font-semibold transition-colors flex items-center gap-1.5",
              i === active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {i === active && (
              <motion.span
                layoutId="tabpill"
                className="absolute inset-0 bg-surface rounded-full shadow-soft"
                transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              />
            )}
            <span className="relative flex items-center gap-1.5">{t.icon}{t.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-6">{tabs[active]?.content}</div>
    </div>
  );
}

export function Progress({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={cn("h-2 rounded-full bg-inset overflow-hidden", className)}>
      <motion.div
        className="h-full rounded-full bg-accent"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
      />
    </div>
  );
}
