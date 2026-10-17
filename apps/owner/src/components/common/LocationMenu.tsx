"use client";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@river-apps/ui";
import { useEffect, useRef, useState } from "react";
import { ALL_LOCATIONS, useShopLocations } from "@/lib/shop-locations";

/**
 * True for a short moment after the open location changes, so screens show skeletons instead of the
 * previous location's numbers. The first load after mount never counts as a switch.
 */
export function useLocationSwitching(): boolean {
  const { ready, viewId } = useShopLocations();
  const [seen, setSeen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (ready && seen === null) setSeen(viewId);
  else if (ready && seen !== null && viewId !== seen) { setSeen(viewId); setBusy(true); }
  useEffect(() => {
    if (!busy) return;
    const t = window.setTimeout(() => setBusy(false), 450);
    return () => window.clearTimeout(t);
  }, [busy]);
  return busy;
}

/**
 * Inline location switcher ("Location ▾"): each location plus All locations. With one location it renders
 * the plain `fallback` text instead.
 */
export function LocationMenu({ fallback, className, prefix }: { fallback?: string; className?: string; prefix?: string }) {
  const shops = useShopLocations();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const multi = shops.enabled && shops.branches.length > 1;
  const current = shops.viewingAll ? "All locations" : shops.branch?.name ?? shops.branches[0]?.name ?? "Main";
  if (!multi) return fallback ? <span className={cn("truncate", className)}>{prefix}{fallback}</span> : null;
  const options = [...shops.branches.map((b) => ({ id: b.id, name: b.name })), { id: ALL_LOCATIONS, name: "All locations" }];
  const selected = shops.viewingAll ? ALL_LOCATIONS : (shops.branch?.id ?? shops.branches[0]?.id);
  return (
    <span ref={ref} className={cn("relative inline-flex min-w-0", className)}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`Location: ${current}. Change location`}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex min-w-0 items-center gap-0.5 text-ink after:absolute after:-inset-y-3 after:inset-x-0 after:content-['']">
        <span className="truncate">{prefix}{current}</span>
        <ChevronDown size={14} strokeWidth={2.2} className={cn("flex-none transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div role="listbox" aria-label="Locations" className="absolute left-0 top-full z-50 mt-2 w-[220px] overflow-hidden rounded-[16px] bg-surface py-1.5 text-[14px] font-semibold text-ink shadow-[0_12px_32px_rgba(10,10,10,0.16)] ring-1 ring-line">
          {options.map((o) => (
            <button key={o.id} type="button" role="option" aria-selected={o.id === selected} onClick={() => { setOpen(false); if (o.id !== selected) shops.setView(o.id); }}
                className="flex min-h-11 w-full items-center justify-between gap-2 px-4 text-left hover:bg-grey-50">
                <span className="truncate">{o.name}</span>
                {o.id === selected ? <Check size={16} strokeWidth={2.4} className="flex-none" aria-hidden /> : null}
              </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
