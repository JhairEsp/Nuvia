import { cn } from "../../lib/utils";

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = { sm: "h-8 w-8 text-micro", md: "h-10 w-10 text-caption", lg: "h-16 w-16 text-headline" }[size];
  const initials = name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return src ? (
    <img
      src={src}
      alt={name}
      className={cn(dims, "rounded-full object-cover ring-1 ring-hairline", className)}
    />
  ) : (
    <div
      className={cn(
        dims,
        "rounded-full bg-accent-soft text-accent font-semibold flex items-center justify-center ring-1 ring-hairline",
        className,
      )}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
