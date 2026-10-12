"use client";

import { Avatar, Button } from "@river-apps/ui";
import { useEffect, useState } from "react";
import type { Booking } from "@/data";
import { readPublicBookings, updatePublicBooking } from "@/lib/public-bookings";
import {
  HOME_LOCATION_ID, branchLinkExpired, findBranchByToken, linkExpiryLabel,
} from "@/lib/shop-locations";

function useBookings() {
  const [rows, setRows] = useState<Booking[]>([]);
  useEffect(() => {
    const pull = () => setRows(readPublicBookings());
    pull();
    const timer = window.setInterval(pull, 1000);
    window.addEventListener("storage", pull);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", pull);
    };
  }, []);
  return rows;
}

/** The page a shop opens from the link. No account. */
export function LocationLinkScreen({ token }: { token: string }) {
  const [now, setNow] = useState(() => Date.now());
  const [found, setFound] = useState<ReturnType<typeof findBranchByToken>>(null);
  const [ready, setReady] = useState(false);
  const rows = useBookings();

  useEffect(() => {
    const pull = () => setFound(findBranchByToken(token));
    pull();
    setReady(true);
    window.addEventListener("storage", pull);
    return () => window.removeEventListener("storage", pull);
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!ready) {
    return <main className="mx-auto min-h-dvh max-w-[402px] bg-canvas px-4 pt-8"><p className="text-[14px] font-semibold text-muted">Loading…</p></main>;
  }

  const branch = found?.branch;
  if (!branch || branchLinkExpired(branch, now)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[402px] flex-col bg-canvas px-5 pt-16">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">{branch ? "This link expired" : "This link is not active"}</h1>
        <p className="mt-2 text-[15px] font-medium text-ink-2">
          {branch
            ? `It stopped on ${linkExpiryLabel(branch.linkExpiresAt!)}. Shop links expire each month. Ask the shop to send a new one.`
            : "Ask the shop to send a new link. Each link expires after one month."}
        </p>
      </main>
    );
  }

  const here = (row: Booking) => (row.branchId || HOME_LOCATION_ID) === branch.id;
  const waiting = rows.filter((row) => here(row) && row.status === "requested").sort((a, b) => a.createdAt - b.createdAt);
  const accepted = rows.filter((row) => here(row) && (row.status === "accepted" || row.status === "received")).sort((a, b) => b.updatedAt - a.updatedAt);
  const shopName = found.store.shopName || "Laundry.ph";

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6">
      <header className="flex min-w-0 items-center gap-2.5">
        <Avatar name={shopName} preset="sky" size={44} />
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium text-muted">Shop link</p>
          <h1 className="truncate text-[18px] font-extrabold leading-tight tracking-[-0.02em]">{shopName}</h1>
          <p className="truncate text-[13px] font-semibold text-muted">{branch.name}</p>
        </div>
      </header>

      <section className="mt-5">
        <h2 className="px-1 text-[12.5px] font-extrabold uppercase tracking-[0.04em] text-muted">Waiting</h2>
        {waiting.length === 0 ? (
          <p className="mt-2 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No one waiting.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {waiting.map((row) => (
              <li key={row.id} className="rounded-card bg-surface px-3 py-3 shadow-card">
                <b className="block truncate text-[16px]">{row.customer.name || row.customer.email || row.customer.phone || "Customer"}</b>
                <p className="mt-0.5 truncate text-[13px] font-medium text-muted">{row.serviceName} · {row.ref}</p>
                <p className="mt-0.5 text-[12.5px] font-semibold text-muted">{row.type === "pickup" ? "Pickup" : "Drop-off"}</p>
                <Button className="mt-3" size="sm" fullWidth onClick={() => {
                  const at = Date.now();
                  updatePublicBooking(row.id, { status: "accepted", statusTimes: { ...row.statusTimes, accepted: at }, updatedAt: at });
                }}>Accept</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {accepted.length ? (
        <section className="mt-5">
          <h2 className="px-1 text-[12.5px] font-extrabold uppercase tracking-[0.04em] text-muted">Accepted</h2>
          <ul className="mt-2 flex flex-col gap-3">
            {accepted.map((row) => (
              <li key={row.id} className="rounded-card bg-surface px-3 py-3 shadow-card">
                <b className="block truncate text-[16px]">{row.customer.name || row.customer.email || row.customer.phone || "Customer"}</b>
                <p className="mt-0.5 truncate text-[13px] font-medium text-muted">{row.serviceName} · {row.ref}</p>
                <p className="mt-0.5 text-[12.5px] font-semibold text-muted">Accepted</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
