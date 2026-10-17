"use client";

import { Icon3D, type IconName } from "@river-apps/icons";
import { ServiceSlider } from "@/components/kit-extensions";
import { HeroPhoto } from "@/components/home/HeroPhoto";
import { Button, Input } from "@river-apps/ui";
import { useCallback, useEffect, useState } from "react";
import { money } from "@/lib/format";
import { PAID_PER_MO } from "@/lib/plans";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/data/types";

interface View {
  shopName: string; branchName: string; expiresAt: number;
  services: { id: string; name: string; icon?: IconName; unit: "kg" | "pc"; priceCentavos: number }[];
  defaults: { serviceId: string; kg: number; pieces: number };
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
  const [note, setNote] = useState<string | null>(null);
  const [capHit, setCapHit] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/staff/${encodeURIComponent(token)}`, { cache: "no-store" }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setError(j.error ?? "This link is not active."); return; }
    setView(j); setError(null);
    setServiceId((s) => s || j.defaults?.serviceId || j.services?.[0]?.id || "");
  }, [token]);
  useEffect(() => { void load(); const t = window.setInterval(() => void load(), 10_000); return () => window.clearInterval(t); }, [load]);

  async function add() {
    setBusy(true); setNote(null);
    const r = await fetch(`/api/staff/${encodeURIComponent(token)}/walk-ins`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, serviceId, quantity: Number(qty) }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.status === 402) { setCapHit(j.error); return; }
    if (!r?.ok) { setNote(j.error ?? "Could not add the walk-in."); return; }
    setNote(`${j.ref} added to the queue.`); setName(""); void load();
  }
  async function advance(id: string) {
    await fetch(`/api/staff/${encodeURIComponent(token)}/orders/${id}`, { method: "POST" }).catch(() => null);
    void load();
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[402px] flex-col bg-canvas px-5 pt-16">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">{error.includes("expired") ? "This link expired" : "This link is not active"}</h1>
        <p className="mt-2 text-[15px] font-medium text-ink-2">{error} Shop links expire each month.</p>
      </main>
    );
  }
  if (!view) return <main className="mx-auto min-h-dvh max-w-[402px] bg-canvas px-4 pt-8"><p className="text-[14px] font-semibold text-muted">Loading…</p></main>;

  const svc = view.services.find((s) => s.id === serviceId);
  const atCap = Boolean(capHit) || (view.walkIns != null && view.walkIns.left <= 0);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6">
      <header className="relative isolate overflow-hidden rounded-banner bg-black px-5 py-5 text-white">
        <HeroPhoto className="-right-6" />
        <div className="relative z-10 min-w-0 pr-28">
          <p className="truncate text-[12.5px] font-medium text-white/65">Staff link · {view.branchName}</p>
          <h1 className="mt-1 truncate text-[20px] font-extrabold leading-tight tracking-[-0.025em]">{view.shopName}</h1>
          {view.walkIns ? <p className="mt-1.5 text-[13px] font-medium text-white/65">{view.walkIns.left} of {view.walkIns.limit} walk-ins left today</p> : <p className="mt-1.5 text-[13px] font-medium text-white/65">Add walk-ins and move orders</p>}
        </div>
      </header>

      <section className="mt-5 rounded-card bg-surface px-4 py-4 shadow-card">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-extrabold">New walk-in</h2>
        </div>
        {atCap ? (
          <div className="mt-3 rounded-tile bg-grey-100 px-4 py-4 text-center">
            <b className="block text-[15px]">That&apos;s 10 walk-ins today</b>
            <p className="mt-1 text-[13px] font-medium text-muted">Ask the owner to upgrade to Pro · {PAID_PER_MO} for unlimited walk-ins.</p>
          </div>
        ) : (
          <form className="mt-3 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void add(); }}>
            <ServiceSlider
              options={view.services.map((s) => ({ id: s.id, label: s.name, icon: <Icon3D name={s.icon ?? "washer"} size={34} />, meta: `${money(s.priceCentavos)}/${s.unit}` }))}
              value={serviceId}
              onChange={setServiceId}
            />
            <Input size="md" label={svc?.unit === "pc" ? "Pieces" : "Kilos"} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
            <Input size="md" label="Customer name (optional)" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" fullWidth disabled={busy || !serviceId}>{busy ? "Adding…" : "Add walk-in"}</Button>
            {note ? <p className="text-[13px] font-semibold" role="status">{note}</p> : null}
          </form>
        )}
      </section>

      <section className="mt-5">
        <h2 className="px-1 text-[12.5px] font-extrabold uppercase tracking-[0.04em] text-muted">Queue</h2>
        {view.queue.length === 0 ? (
          <p className="mt-2 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No orders in the queue.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {view.queue.map((o) => (
              <li key={o.id} className="flex items-center gap-3 rounded-card bg-surface px-3 py-3 shadow-card">
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[15px]">{o.ref} · {o.customer}</b>
                  <p className="truncate text-[12.5px] font-medium text-muted">{o.detail} · {ORDER_STATUS_LABEL[o.status]}</p>
                </div>
                {o.next ? <Button size="sm" variant="secondary" onClick={() => void advance(o.id)}>{ORDER_STATUS_LABEL[o.next]}</Button> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
