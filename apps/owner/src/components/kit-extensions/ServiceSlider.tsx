"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { IconTile, cn } from "@river-apps/ui";

export interface ServiceOption { id: string; label: string; icon: ReactNode; meta?: ReactNode }

/**
 * Swipeable service picker. Same pattern as the Orders status row (StepTracker): snap row,
 * edge fades, 48px icon tiles, and the selected one is a white tile with a black ring.
 */
export function ServiceSlider({ options, value, onChange, label = "Service", visible = 3.4, className }: {
  options: ServiceOption[]; value: string; onChange: (id: string) => void; label?: string; visible?: number; className?: string;
}) {
  const row = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const [edges, setEdges] = useState({ start: true, end: false });
  const measure = () => {
    const el = row.current; if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft >= max - 2 });
  };
  const at = Math.max(0, options.findIndex((o) => o.id === value));
  useEffect(() => {
    const el = row.current;
    const item = el?.children[0]?.children[at] as HTMLElement | undefined;
    if (!el || !item) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: item.offsetLeft - (el.clientWidth - item.offsetWidth) / 2, behavior: first.current || reduce ? "auto" : "smooth" });
    first.current = false;
    const id = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(id);
  }, [at]);
  const fade = 24;
  const mask = `linear-gradient(to right, ${edges.start ? "#000" : "transparent"} 0, #000 ${fade}px, #000 calc(100% - ${fade}px), ${edges.end ? "#000" : "transparent"} 100%)`;
  const style: CSSProperties = { maskImage: mask, WebkitMaskImage: mask };
  return (
    <div ref={row} onScroll={measure} style={style}
      className={cn("snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-0.5 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      <div role="radiogroup" aria-label={label} className="flex">
        {options.map((o) => {
          const on = o.id === value;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.id)}
              style={{ width: `${100 / Math.min(visible, options.length)}%` }}
              className="group flex flex-none snap-center flex-col items-center gap-1.5 rounded-[14px] pb-1 outline-none [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              <span className="transition-transform duration-100 group-active:scale-90 motion-reduce:transition-none motion-reduce:group-active:scale-100">
                <IconTile size={48} tone={on ? "white" : "grey"}
                  className={cn(on ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : "transition-colors group-hover:bg-grey-200")}>
                  {o.icon}
                </IconTile>
              </span>
              <b className="max-w-full truncate px-1 text-[11.5px] font-bold leading-none">{o.label}</b>
              {o.meta ? <small className="text-[10.5px] font-semibold leading-none text-muted">{o.meta}</small> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
