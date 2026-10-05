import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { IconTile, cn } from "@river-apps/ui";

export interface Step {
  key: string;
  label: string;
  /** A 3D icon; upcoming steps are shown greyed out. */
  icon: ReactNode;
  /** Small line under the label, e.g. a time. Defaults: "Now" for current, "—" for upcoming. */
  meta?: ReactNode;
}

export interface StepTrackerProps {
  steps: Step[];
  /** Index of the current step. Steps before it are done; after it are upcoming. Use steps.length when all are done. */
  current: number;
  /** Accessible name for the list, e.g. "Order status". */
  label: string;
  className?: string;
}

/**
 * Horizontal progress tracker (Received → Washing → Drying → Folding → Ready).
 * Done steps get a small black check; the current step is a white tile with a black ring;
 * upcoming steps are greyed. Status is also spelled out in words, never colour only.
 * Candidate for upstreaming to @river-apps/ui.
 */
export function StepTracker({ steps, current, label, className }: StepTrackerProps) {
  const n = Math.max(1, steps.length);
  const edge = 50 / n; // centre of the first/last column, in %
  const done = Math.min(Math.max(current, 0), n - 1);
  return (
    <ol aria-label={label} className={cn("relative grid", className)} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      <i aria-hidden className="absolute top-[23px] h-[3px] rounded-full bg-grey-200" style={{ left: `${edge}%`, right: `${edge}%` }} />
      <i aria-hidden className="absolute top-[23px] h-[3px] rounded-full bg-ink" style={{ left: `${edge}%`, width: `${(done / n) * 100}%` }} />
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "now" : "next";
        return (
          <li key={s.key} aria-current={state === "now" ? "step" : undefined} className="relative flex flex-col items-center gap-1.5">
            <span className="relative">
              <IconTile
                size={48}
                tone={state === "now" ? "white" : "grey"}
                className={cn(state === "now" && "ring-2 ring-ink", state === "next" && "[&>svg]:opacity-35 [&>svg]:grayscale")}
              >
                {s.icon}
              </IconTile>
              {state === "done" ? (
                <span aria-hidden className="absolute -right-1 -top-1 flex size-[18px] items-center justify-center rounded-full bg-ink text-on-ink ring-2 ring-surface">
                  <Check size={11} strokeWidth={3.2} />
                </span>
              ) : null}
            </span>
            <b className={cn("text-[11.5px] leading-none", state === "next" ? "font-semibold text-muted" : "font-bold")}>{s.label}</b>
            <small className="text-[10.5px] font-semibold leading-none text-muted">
              {s.meta ?? (state === "now" ? "Now" : state === "next" ? "—" : "Done")}
            </small>
            <span className="sr-only">{state === "done" ? "done" : state === "now" ? "in progress" : "not started"}</span>
          </li>
        );
      })}
    </ol>
  );
}
