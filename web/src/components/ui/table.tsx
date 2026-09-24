import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/** Table-lite con jerarquía real: sin bordes pesados, filas aireadas (§ design system). */
export function DataTable({
  head,
  rows,
  className,
  empty,
}: {
  head: string[];
  rows: ReactNode[][];
  className?: string;
  empty?: ReactNode;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-body">
        <thead>
          <tr className="border-b border-hairline">
            {head.map((h, i) => (
              <th key={h} className={cn(
                "text-micro font-semibold uppercase tracking-[0.1em] text-faint pb-3 px-3",
                i === 0 ? "text-left" : "text-right",
                i === 0 && "pl-1",
              )}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={head.length} className="py-12 text-center text-muted">{empty ?? "Sin resultados"}</td></tr>
          )}
          {rows.map((cells, r) => (
            <tr key={r} className="border-b border-hairline/60 last:border-0 hover:bg-subtle/60 transition-colors">
              {cells.map((cell, c) => (
                <td key={c} className={cn("py-3 px-3", c === 0 ? "text-left pl-1" : "text-right")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
