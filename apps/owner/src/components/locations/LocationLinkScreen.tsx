"use client";

import { Icon3D, type IconName } from "@river-apps/icons";
import { ServiceSlider } from "@/components/kit-extensions";
import { HeroPhoto } from "@/components/home/HeroPhoto";
import { Input } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { AppLoader } from "@/components/common/AppLoader";
import { useCallback, useState } from "react";
import { useVisiblePoll } from "@/lib/visible-poll";
import { money } from "@/lib/format";
import { PAID_PER_MO } from "@/lib/plans";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/data/types";

interface View {
  shopName: string; branchName: string; expiresAt: number; staffName: string | null; mineToday: number;
  services: { id: string; name: string; icon?: IconName; unit: "kg" | "pc" | "load"; priceCentavos: number }[];
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
  const [used, setUsed] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);
  const [capHit, setCapHit] = useState<string | null>(null);

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
    const r = await fetch(`/api/staff/${encodeURIComponent(token)}/walk-ins`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, serviceId, quantity: Number(qty), supplies: Object.entries(used).map(([id, q]) => ({ id, qty: Number(q) || 0 })) }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.status === 402) { setCapHit(j.error); return; }
    if (!r?.ok) { setNote(j.error ?? "Could not add the walk-in."); return; }
    setNote(`${j.ref} added to the queue.`); setName(""); setUsed({}); void load();
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

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6">
      <header className="relative isolate overflow-hidden rounded-banner bg-black px-5 py-5 text-white">
        <HeroPhoto className="-right-6" />
        <div className="relative z-10 min-w-0 pr-28">
          <p className="truncate text-[12.5px] font-medium text-white/65">{view.staffName ? `Hi, ${view.staffName}` : "Staff link"} · {view.branchName}</p>
          <h1 className="mt-1 truncate text-[20px] font-extrabold leading-tight tracking-[-0.025em]">{view.shopName}</h1>
          <p className="mt-1.5 text-[13px] font-medium text-white/65">{view.staffName ? `${view.mineToday} walk-in${view.mineToday === 1 ? "" : "s"} by you today` : "Add walk-ins and move orders"}{view.walkIns ? ` · ${view.walkIns.left} of ${view.walkIns.limit} left` : ""}</p>
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
              onChange={(id) => { setServiceId(id); const nx = view.services.find((x) => x.id === id); if (nx?.unit === "load") setQty("1"); else if (svc?.unit === "load") setQty("6"); }}
            />
            {svc?.unit === "load" ? (
              <div className="flex items-center justify-between rounded-[14px] bg-grey-100 px-3 py-2">
                <span className="text-[14px] font-bold">Loads <span className="font-semibold text-muted">· {money(svc.priceCentavos)} each</span></span>
                <span className="flex items-center gap-2">
                  <button type="button" aria-label="One load less" disabled={Number(qty) <= 1} onClick={() => setQty(String(Math.max(1, Math.round(Number(qty) || 1) - 1)))} className="size-10 rounded-full bg-surface text-[20px] font-bold shadow-card disabled:opacity-40">−</button>
                  <b className="w-6 text-center text-[17px] tabular-nums">{Math.max(1, Math.round(Number(qty) || 1))}</b>
                  <button type="button" aria-label="One load more" onClick={() => setQty(String(Math.min(20, Math.round(Number(qty) || 1) + 1)))} className="size-10 rounded-full bg-surface text-[20px] font-bold shadow-card">+</button>
                </span>
              </div>
            ) : <Input size="md" label={svc?.unit === "pc" ? "Pieces" : "Kilos"} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />}
            {svc?.unit === "load" ? <p className="-mt-1 px-1 text-[13px] font-semibold text-muted">Total {money(Math.max(1, Math.round(Number(qty) || 1)) * svc.priceCentavos)}</p> : null}
            {view.supplies?.length ? (
              <div>
                <span className="mb-1.5 block px-1 text-[13px] font-bold">Supplies &amp; add-ons</span>
                <div className="flex flex-wrap gap-1.5">
                  {view.supplies.map((x) => {
                    const on = x.id in used;
                    return (
                      <button key={x.id} type="button" aria-pressed={on}
                        onClick={() => setUsed((m) => { if (on) { const n = { ...m }; delete n[x.id]; return n; } return { ...m, [x.id]: String(x.defaultQty) }; })}
                        className={`min-h-10 rounded-full px-3 text-[13px] font-semibold ${on ? "bg-ink text-white" : "bg-grey-100 text-ink"}`}>
                        {x.brand ? `${x.name} · ${x.brand}` : x.name}{x.payer === "customer" ? ` +${money(x.priceCentavos)}` : ""}
                      </button>
                    );
                  })}
                </div>
                {view.supplies.filter((x) => x.id in used).map((x) => (
                  <label key={x.id} className="mt-1.5 flex items-center gap-2 px-1 text-[13px] font-semibold">
                    <span className="min-w-0 flex-1 truncate">{x.name}</span>
                    <input inputMode="decimal" aria-label={`${x.name} quantity`} value={used[x.id]} onChange={(e) => setUsed((m) => ({ ...m, [x.id]: e.target.value.replace(/[^\d.]/g, "").slice(0, 7) }))}
                      className="h-9 w-20 rounded-[10px] border border-line bg-surface px-2 text-right tabular-nums" />
                    <span className="w-12 text-muted">{x.unit === "load" ? "load" : x.unit}</span>
                  </label>
                ))}
              </div>
            ) : null}
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
