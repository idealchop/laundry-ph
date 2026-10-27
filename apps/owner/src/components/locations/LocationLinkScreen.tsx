"use client";

import { Icon3D, type IconName } from "@river-apps/icons";
import { ServiceSlider } from "@/components/kit-extensions";
import { Input } from "@river-apps/ui";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/common/Button";
import { AppLoader } from "@/components/common/AppLoader";
import { useCallback, useState } from "react";
import { useVisiblePoll } from "@/lib/visible-poll";
import { money } from "@/lib/format";
import { PAID_PER_MO } from "@/lib/plans";
import { useInstallHidden } from "@/lib/pwa";
import { InstallPanel } from "@/components/pwa/InstallPanel";
import { STAFF_FEATURES } from "@/components/pwa/InstallScreen";
import { BottomSheet } from "@/components/common/BottomSheet";
import { RiverIcon } from "@/components/common/RiverIcon";
import { SupplyPicker, useSupplyPicks } from "@/components/pos/SupplyPicker";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/data/types";

const NO_SUPPLIES: never[] = [];

interface View {
  shopName: string; branchName: string; expiresAt: number; staffName: string | null; mineToday: number;
  services: { id: string; name: string; icon?: IconName; unit: "kg" | "pc" | "load"; priceCentavos: number; supplyModes?: Record<string, "free" | "additional" | "off"> }[];
  minKg?: number;
  defaults: { serviceId: string; kg: number; pieces: number };
  supplies?: { id: string; name: string; brand?: string; unit: "ml" | "pcs" | "load"; payer: "customer" | "shop"; priceCentavos: number; defaultQty: number }[];
  walkIns: { used: number; limit: number; left: number } | null;
  queue: { id: string; ref: string; status: OrderStatus; customer: string; detail: string; next: OrderStatus | null }[];
}

/**
 * Staff link page (no account). Talks only to /api/staff/{token}: the server checks the token and writes
 * that shop's Firestore orders, so walk-ins show up live in the owner's Orders queue and Home.
 */
export function LocationLinkScreen({ token }: { token: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [qty, setQty] = useState("6");
  const [busy, setBusy] = useState(false);
  const [install, setInstall] = useState(false);
  const installHidden = useInstallHidden(token);
  const [note, setNote] = useState<string | null>(null);
  const [capHit, setCapHit] = useState<string | null>(null);
  const picks = useSupplyPicks(view?.services.find((s) => s.id === serviceId), view?.supplies ?? NO_SUPPLIES);

  const load = useCallback(async () => {
    const r = await fetch(`/api/staff/${encodeURIComponent(token)}`, { cache: "no-store" }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setError(j.error ?? "This link is not active."); return; }
    setView(j); setError(null);
    setServiceId((s) => s || j.defaults?.serviceId || j.services?.[0]?.id || "");
  }, [token]);
  useVisiblePoll(load, 15_000);

  async function add() {
    setBusy(true); setNote(null);
    const r = await fetch(`/api/staff/${encodeURIComponent(token)}/walk-ins`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, serviceId, quantity: Number(qty), supplies: picks.payload }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.status === 402) { setCapHit(j.error); return; }
    if (!r?.ok) { setNote(j.error ?? "Could not add the walk-in."); return; }
    setNote(`${j.ref} added to the queue.`); setName(""); picks.reset(); void load();
  }
  async function advance(id: string) {
    await fetch(`/api/staff/${encodeURIComponent(token)}/orders/${id}`, { method: "POST" }).catch(() => null);
    void load();
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[402px] flex-col bg-canvas px-5 pt-16">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">{error.includes("expired") ? "This link expired" : "This link is not active"}</h1>
        <p className="mt-2 text-[15px] font-medium text-ink-2">{error} Ask the owner to share your link again.</p>
      </main>
    );
  }
  if (!view) return <AppLoader />;

  const svc = view.services.find((s) => s.id === serviceId);
  const atCap = Boolean(capHit) || (view.walkIns != null && view.walkIns.left <= 0);

  const n = svc?.unit === "load" ? Math.max(1, Math.round(Number(qty) || 1)) : Math.max(0, Number(qty) || 0);
  const billed = svc?.unit === "kg" && n > 0 ? Math.max(n, view.minKg ?? 0) : n;
  const extras = (view.supplies ?? []).reduce((sum, s) => sum + (picks.addOnQty[s.id] ?? 0) * s.priceCentavos, 0);
  const total = svc && n > 0 ? Math.round((billed * svc.priceCentavos + extras) / 100) * 100 : 0;
  const stepQty = (d: number) => setQty(String(svc?.unit === "load" ? Math.min(20, Math.max(1, n + d)) : Math.min(200, Math.max(0, Math.round((n + d) * 2) / 2))));
  const unitWord = svc?.unit === "load" ? (n === 1 ? "load" : "loads") : svc?.unit === "pc" ? "pcs" : "kg";

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-surface px-5 pb-10 pt-6">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[28px] font-extrabold leading-tight tracking-[-0.03em]">{view.staffName ? `Hi, ${view.staffName}` : "Walk-in"}</h1>
          <p className="mt-0.5 truncate text-[14px] font-medium text-muted">{view.branchName}{view.staffName ? ` · ${view.mineToday} today` : ""}{view.walkIns ? ` · ${view.walkIns.left} left` : ""}</p>
        </div>
      </header>

      <section className="mt-5">
        {atCap ? (
          <div className="rounded-tile border border-line px-4 py-5 text-center">
            <b className="block text-[15px]">That&apos;s 10 walk-ins today</b>
            <p className="mt-1 text-[13px] font-medium text-muted">Ask the owner to upgrade to Pro · {PAID_PER_MO} for unlimited walk-ins.</p>
          </div>
        ) : (
          <form className="flex flex-col" onSubmit={(e) => { e.preventDefault(); void add(); }}>
            <ServiceSlider
              options={view.services.map((s) => ({ id: s.id, label: s.name, icon: <Icon3D name={s.icon ?? "washer"} size={34} />, meta: `${money(s.priceCentavos)}/${s.unit}` }))}
              value={serviceId}
              onChange={(id) => { setServiceId(id); const nx = view.services.find((x) => x.id === id); if (nx?.unit === "load") setQty("1"); else if (svc?.unit === "load") setQty("6"); }}
            />
            <div className="mt-4 flex items-center gap-3 border-y border-line py-3">
              <label className="flex min-w-0 flex-1 items-baseline gap-1">
                <input inputMode="decimal" aria-label={svc?.unit === "load" ? "Loads" : svc?.unit === "pc" ? "Pieces" : "Kilos"} value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))}
                  className="w-[4.5ch] bg-transparent text-[36px] font-extrabold tabular-nums tracking-[-0.03em] outline-none" />
                <span className="text-[15px] font-bold text-muted">{unitWord}</span>
              </label>
              <button type="button" aria-label="Less" onClick={() => stepQty(svc?.unit === "kg" ? -0.5 : -1)} className="inline-flex size-11 items-center justify-center rounded-full border border-line active:bg-grey-50"><Minus size={18} strokeWidth={2.2} /></button>
              <button type="button" aria-label="More" onClick={() => stepQty(svc?.unit === "kg" ? 0.5 : 1)} className="inline-flex size-11 items-center justify-center rounded-full border border-line active:bg-grey-50"><Plus size={18} strokeWidth={2.2} /></button>
            </div>
            <SupplyPicker picks={picks} className="border-b border-line py-2" />
            <Input size="md" className="mt-4" placeholder="Customer name (optional)" aria-label="Customer name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" className="mt-5" fullWidth disabled={busy || !serviceId || total <= 0}>{busy ? "Adding…" : total > 0 ? `Add walk-in · ${money(total)}` : "Add walk-in"}</Button>
            {note ? <p className="mt-3 text-center text-[13px] font-semibold" role="status">{note}</p> : null}
          </form>
        )}
      </section>

      <section className="mt-9">
        <h2 className="text-[18px] font-extrabold tracking-[-0.02em]">Queue{view.queue.length ? <span className="ml-1.5 font-semibold text-muted">{view.queue.length}</span> : null}</h2>
        {view.queue.length === 0 ? (
          <p className="mt-2 border-t border-line pt-3 text-[14px] font-medium text-muted">No orders yet</p>
        ) : (
          <ul className="mt-2 divide-y divide-line border-t border-line">
            {view.queue.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[15px]">{o.customer}</b>
                  <p className="truncate text-[13px] font-medium text-muted">{o.ref} · {o.detail}</p>
                </div>
                {o.next ? (
                  <button type="button" onClick={() => void advance(o.id)} className="flex-none rounded-pill border border-line px-3.5 py-2 text-[13px] font-bold active:bg-grey-50"
                    aria-label={`${ORDER_STATUS_LABEL[o.status]}. Move to ${ORDER_STATUS_LABEL[o.next]}`}>
                    {ORDER_STATUS_LABEL[o.next]}
                  </button>
                ) : <span className="flex-none text-[13px] font-bold text-muted">{ORDER_STATUS_LABEL[o.status]}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {installHidden ? null : (
        <button type="button" onClick={() => setInstall(true)} className="mx-auto mt-8 flex min-h-11 items-center gap-2 px-2 text-[13.5px] font-semibold text-muted">
          <RiverIcon name="install" size={22} /> Install this counter as an app
        </button>
      )}
      {install ? <BottomSheet title="Install app" onClose={() => setInstall(false)} tall><InstallPanel token={token} features={STAFF_FEATURES} /></BottomSheet> : null}
    </main>
  );
}
