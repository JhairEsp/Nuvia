import { cn } from "../../lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-[var(--radius-tile)]", className)} />;
}

export function StatSkeleton() {
  return (
    <div className="rounded-[var(--radius-card)] border border-hairline bg-surface p-6 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}
