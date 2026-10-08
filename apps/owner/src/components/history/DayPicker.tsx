"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@river-apps/ui";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parts(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Weekday of a Manila calendar date, Sunday = 0. Noon UTC is the same Manila date. */
function weekday(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d, 4)).getUTCDay();
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const next = new Date(Date.UTC(y, m - 1 + delta, 1));
  return { y: next.getUTCFullYear(), m: next.getUTCMonth() + 1 };
}

function shortLabel(iso: string, today: string): string {
  if (iso === today) return "Today";
  const p = parts(iso);
  if (!p) return "Calendar";
  return `${MONTHS[p.m - 1]!.slice(0, 3)} ${p.d}`;
}

/**
 * Calendar menu for picking one shop day. Future dates are disabled.
 * `value` and `today` are `YYYY-MM-DD` in Manila.
 */
export function DayPicker({ value, today, onChange }: { value: string; today: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<"left" | "right">("left");
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const selected = parts(value);
  const todayParts = parts(today);
  const [cursor, setCursor] = useState(() => {
    const p = selected ?? todayParts;
    return p ? { y: p.y, m: p.m } : { y: 2026, m: 10 };
  });

  const toggle = () => {
    if (!open) {
      const p = parts(value) ?? todayParts;
      if (p) setCursor({ y: p.y, m: p.m });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const box = root.current?.getBoundingClientRect();
    if (box) setAlign(box.left + 320 > window.innerWidth - 12 ? "right" : "left");
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setOpen(false);
        return;
      }
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const atMax = !!todayParts && (cursor.y > todayParts.y || (cursor.y === todayParts.y && cursor.m >= todayParts.m));
  const leading = weekday(cursor.y, cursor.m, 1);
  const count = daysInMonth(cursor.y, cursor.m);
  const cells: ({ day: number; iso: string } | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: count }, (_, i) => ({ day: i + 1, iso: isoOf(cursor.y, cursor.m, i + 1) })),
  ];

  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-[12px] px-3 text-[13px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          value ? "bg-ink text-on-ink" : "bg-grey-100 text-ink hover:bg-grey-200",
        )}
      >
        <CalendarDays size={16} strokeWidth={1.75} className={value ? "text-on-ink" : "text-muted"} aria-hidden />
        {value ? shortLabel(value, today) : "Calendar"}
        <ChevronDown size={15} strokeWidth={2.2} className={cn("transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose a date"
          className={cn(
            "absolute top-[calc(100%+8px)] z-30 w-[min(320px,calc(100vw-2rem))] rounded-[20px] bg-surface p-3 shadow-popover ring-1 ring-black/5",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor((c) => shiftMonth(c.y, c.m, -1))}
              className="inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-grey-100 focus-visible:outline-2 focus-visible:outline-ink"
            >
              <ChevronLeft size={18} strokeWidth={2} />
            </button>
            <b className="text-[15px] font-extrabold tracking-[-0.02em]">{MONTHS[cursor.m - 1]} {cursor.y}</b>
            <button
              type="button"
              aria-label="Next month"
              disabled={atMax}
              onClick={() => setCursor((c) => shiftMonth(c.y, c.m, 1))}
              className="inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-grey-100 focus-visible:outline-2 focus-visible:outline-ink disabled:text-subtle disabled:hover:bg-transparent"
            >
              <ChevronRight size={18} strokeWidth={2} />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-bold text-muted" aria-hidden>
            {WEEKDAYS.map((d) => <span key={d} className="py-1">{d}</span>)}
          </div>
          <div className="grid grid-cols-7" role="group" aria-label={`${MONTHS[cursor.m - 1]} ${cursor.y}`}>
            {cells.map((cell, i) => {
              if (!cell) return <span key={`pad-${i}`} />;
              const disabled = cell.iso > today;
              const on = cell.iso === value;
              const isToday = cell.iso === today;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={disabled}
                  aria-pressed={on}
                  aria-label={`${MONTHS[cursor.m - 1]} ${cell.day}, ${cursor.y}`}
                  onClick={() => pick(cell.iso)}
                  className={cn(
                    "mx-auto flex size-10 items-center justify-center rounded-full text-[14px] font-bold focus-visible:outline-2 focus-visible:outline-ink",
                    on && "bg-ink text-on-ink",
                    !on && isToday && "ring-2 ring-ink",
                    !on && !disabled && "hover:bg-grey-100",
                    disabled && "text-subtle",
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line px-1 pt-2">
            <button
              type="button"
              onClick={() => pick(today)}
              className="h-10 rounded-pill px-3 text-[13px] font-bold text-ink hover:bg-grey-100 focus-visible:outline-2 focus-visible:outline-ink"
            >
              Today
            </button>
            <button
              type="button"
              disabled={!value}
              onClick={() => { onChange(""); setOpen(false); }}
              className="h-10 rounded-pill px-3 text-[13px] font-bold text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-ink disabled:text-subtle"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
