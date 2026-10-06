"use client";
import { Check } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
  /**
   * Show only this many steps at once and swipe for the rest (scroll-snap, no scrollbar). The current
   * step is scrolled to the centre on load and whenever it changes. Omit to show every step.
   */
  visible?: number;
  className?: string;
}

type State = "done" | "now" | "next";

function StepItem({ step: s, state }: { step: Step; state: State }) {
  return (
    <>
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
    </>
  );
}

const stateOf = (i: number, current: number): State => (i < current ? "done" : i === current ? "now" : "next");

/**
 * Horizontal progress tracker (Received → Washing → Drying → Folding → Ready).
 * Done steps get a small black check; the current step is a white tile with a black ring;
 * upcoming steps are greyed. Status is also spelled out in words, never colour only.
 * Candidate for upstreaming to @river-apps/ui.
 */
export function StepTracker({ steps, current, label, visible, className }: StepTrackerProps) {
  if (visible && visible < steps.length) {
    return <ScrollingStepTracker steps={steps} current={current} label={label} visible={visible} className={className} />;
  }
  const n = Math.max(1, steps.length);
  const edge = 50 / n; // centre of the first/last column, in %
  const done = Math.min(Math.max(current, 0), n - 1);
  return (
    <ol aria-label={label} className={cn("relative grid", className)} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      <i aria-hidden className="absolute top-[23px] h-[3px] rounded-full bg-grey-200" style={{ left: `${edge}%`, right: `${edge}%` }} />
      <i aria-hidden className="absolute top-[23px] h-[3px] rounded-full bg-ink" style={{ left: `${edge}%`, width: `${(done / n) * 100}%` }} />
      {steps.map((s, i) => {
        const state = stateOf(i, current);
        return (
          <li key={s.key} aria-current={state === "now" ? "step" : undefined} className="relative flex flex-col items-center gap-1.5">
            <StepItem step={s} state={state} />
          </li>
        );
      })}
    </ol>
  );
}

/** `visible`-at-a-time variant: snap row, per-step connector halves, edge fades, current step kept centred. */
function ScrollingStepTracker({ steps, current, label, visible, className }: Required<Omit<StepTrackerProps, "className">> & { className?: string }) {
  const n = steps.length;
  const done = Math.min(Math.max(current, 0), n - 1);
  const row = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = () => {
    const el = row.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft >= max - 2 });
  };

  // Centre the current step (the last one once everything is done) on mount and on each status change.
  useEffect(() => {
    const el = row.current;
    const item = el?.children[0]?.children[done] as HTMLElement | undefined;
    if (!el || !item) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: item.offsetLeft - (el.clientWidth - item.offsetWidth) / 2, behavior: first.current || reduce ? "auto" : "smooth" });
    first.current = false;
    const id = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(id);
  }, [done]);

  const fade = 24;
  const mask = `linear-gradient(to right, ${edges.start ? "#000" : "transparent"} 0, #000 ${fade}px, #000 calc(100% - ${fade}px), ${edges.end ? "#000" : "transparent"} 100%)`;
  const maskStyle: CSSProperties = { maskImage: mask, WebkitMaskImage: mask };

  return (
    <div
      ref={row}
      onScroll={measure}
      className={cn("snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-0.5 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}
      style={maskStyle}
    >
      <ol aria-label={label} className="flex">
        {steps.map((s, i) => {
          const state = stateOf(i, current);
          return (
            <li
              key={s.key}
              aria-current={state === "now" ? "step" : undefined}
              className="relative flex flex-none snap-center flex-col items-center gap-1.5"
              style={{ width: `${100 / visible}%` }}
            >
              {/* Connector halves: left half joins the previous step, right half the next. */}
              {i > 0 ? <i aria-hidden className={cn("absolute left-0 right-1/2 top-[23px] h-[3px]", i <= done ? "bg-ink" : "bg-grey-200")} /> : null}
              {i < n - 1 ? <i aria-hidden className={cn("absolute left-1/2 right-0 top-[23px] h-[3px]", i < done ? "bg-ink" : "bg-grey-200")} /> : null}
              <StepItem step={s} state={state} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
