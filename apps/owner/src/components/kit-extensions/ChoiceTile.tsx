import { Check } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@river-apps/ui";

export interface ChoiceTileProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title" | "children"> {
  selected?: boolean;
  /** Usually a 3D icon from @river-apps/icons. */
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /**
   * "stacked" = icon above bold title + subtitle (legacy grids).
   * "inline" = icon left of text (payment methods).
   * "compact" = icon + price on one row, name below — minimal, not bold (POS services).
   * "card" = roomy carousel card: big icon left, bold name + price, check on the right (POS services, one per view).
   */
  layout?: "stacked" | "inline" | "compact" | "card";
}

/**
 * A larger selectable card for one-of-many choices (service type, payment method).
 * Grey at rest, white with a 2px black ring when selected (the kit's focus language).
 * Uses `aria-pressed`; put several in a `role="radiogroup"`-like group with a label.
 * Candidate for upstreaming to @river-apps/ui.
 */
export function ChoiceTile({ selected = false, icon, title, subtitle, layout = "stacked", className, type = "button", ...rest }: ChoiceTileProps) {
  const stacked = layout === "stacked";
  const compact = layout === "compact";
  const card = layout === "card";
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "relative text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        stacked && "flex flex-col items-start gap-1 rounded-panel p-3",
        compact && "flex flex-col items-stretch gap-1.5 rounded-panel p-2.5",
        layout === "inline" && "flex min-h-[60px] items-center gap-2.5 rounded-tile px-3",
        card && "flex min-h-[84px] items-center gap-3 rounded-panel py-3 pl-3 pr-10",
        selected ? "bg-surface ring-2 ring-ink" : "bg-grey-100 hover:bg-grey-200",
        className,
      )}
      {...rest}
    >
      {card ? (
        <>
          <span className="flex size-14 flex-none items-center justify-center rounded-tile bg-surface">{icon}</span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <b className="text-[15px] font-bold leading-tight tracking-[-0.02em] text-ink">{title}</b>
            {subtitle ? <small className="truncate text-[13.5px] font-semibold text-muted">{subtitle}</small> : null}
          </span>
        </>
      ) : compact ? (
        <>
          <span className="flex items-center gap-1.5">
            {icon}
            {subtitle ? <small className="truncate text-[11.5px] font-medium leading-none text-muted">{subtitle}</small> : null}
          </span>
          <span className="truncate text-[12.5px] font-medium leading-tight tracking-[-0.01em] text-ink">{title}</span>
        </>
      ) : (
        <>
          {icon}
          <span className={cn("flex flex-col", stacked ? "gap-1" : "leading-[1.2]")}>
            <b className={cn("tracking-[-0.01em]", stacked ? "mt-0.5 text-[13px] leading-tight" : "text-[14px]")}>{title}</b>
            {subtitle ? <small className={cn("font-semibold text-muted", stacked ? "text-[12px]" : "text-[11.5px]")}>{subtitle}</small> : null}
          </span>
        </>
      )}
      {card ? (
        <span aria-hidden className={cn(
          "absolute right-4 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full",
          selected ? "bg-ink text-on-ink" : "border-2 border-grey-300 bg-surface",
        )}>
          {selected ? <Check size={14} strokeWidth={3} /> : null}
        </span>
      ) : null}
      {(stacked || compact) && selected ? (
        <span aria-hidden className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-ink text-on-ink">
          <Check size={13} strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}
