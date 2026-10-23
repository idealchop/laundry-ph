"use client";
import { LocationSwitcher } from "./LocationSwitcher";
import { cn } from "@river-apps/ui";
import { useEffect, useState } from "react";
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
 * Location switcher (Barbers.ph parity): small label + chevron opening a "Choose location" bottom sheet
 * with search (>5 locations), a check on the selected one, and All locations. One location: plain `fallback`.
 */
export function LocationMenu({ fallback, className, prefix }: { fallback?: string; className?: string; prefix?: string }) {
  const shops = useShopLocations();
  const multi = shops.enabled && shops.branches.length > 1;
  const current = shops.viewingAll ? "All locations" : shops.branch?.name ?? shops.branches[0]?.name ?? "Main";
  if (!multi) return fallback ? <span className={cn("truncate", className)}>{prefix}{fallback}</span> : null;
  const options = shops.branches.map((b) => ({ id: b.id, name: b.name, sub: b.area || b.address || undefined }));
  const selected = shops.viewingAll ? ALL_LOCATIONS : (shops.branch?.id ?? shops.branches[0]?.id ?? "");
  return (
    <LocationSwitcher value={selected} options={options} allId={ALL_LOCATIONS} label={`${prefix ?? ""}${current}`}
      onChange={(id) => { if (id !== selected) shops.setView(id); }} className={cn("text-ink", className)} />
  );
}
