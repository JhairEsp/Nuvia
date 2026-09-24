import { cn } from "../../lib/utils";

/** Switch iOS-style (skill ui-apple-components §6). */
export function Switch({
  checked,
  onChange,
  label,
  className,
  disabled = false,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "disabled:opacity-50 disabled:cursor-not-allowed relative h-[31px] w-[51px] rounded-full transition-colors duration-300 shrink-0",
        checked ? "bg-success" : "bg-inset",
        className,
  disabled = false,
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-soft",
          "transition-transform duration-300 [transition-timing-function:cubic-bezier(.32,.72,0,1)]",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}
