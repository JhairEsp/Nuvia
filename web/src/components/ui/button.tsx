import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 font-medium select-none transition-all duration-[150ms] active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent hover:bg-accent-hover shadow-soft",
        secondary: "text-accent border border-accent/35 hover:bg-accent-soft",
        ghost: "text-ink hover:bg-subtle",
        quiet: "bg-subtle text-ink hover:bg-inset",
        danger: "bg-danger text-white hover:opacity-90",
      },
      size: {
        sm: "h-9 px-3.5 text-caption rounded-full",
        md: "h-11 px-5 text-body rounded-full",
        lg: "h-13 px-7 text-headline rounded-full",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  loading?: boolean;
}

export function Button({ className, variant, size, loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button className={cn(button({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
