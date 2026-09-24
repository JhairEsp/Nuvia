import type { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-caption font-semibold text-ink mb-1.5", className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full h-11 px-4 rounded-[var(--radius-control)] bg-subtle text-body text-ink",
        "placeholder:text-faint border border-transparent transition-all duration-[150ms]",
        "focus:outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent-soft",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full px-4 py-3 rounded-[var(--radius-control)] bg-subtle text-body text-ink",
        "placeholder:text-faint border border-transparent transition-all duration-[150ms]",
        "focus:outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent-soft min-h-24",
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
