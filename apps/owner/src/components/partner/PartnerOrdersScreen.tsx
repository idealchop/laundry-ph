"use client";

import { Button, Topbar } from "@river-apps/ui";
import { useId, useState, type KeyboardEvent } from "react";
import { SampleNote } from "@/components/SampleNote";
import { useBookings, useShop } from "@/lib/shop";
import { BookingsList } from "../bookings/BookingsList";

export type PartnerOrdersTab = "bookings" | "history";
const TABS: { id: PartnerOrdersTab; label: string }[] = [
  { id: "bookings", label: "Bookings" },
  { id: "history", label: "History" },
];

/** Partner "Orders": live River Mobile Bookings (accept / decline / track) and History behind simple text tabs (default Bookings). */
export function PartnerOrdersScreen({ initialTab = "bookings", title = "Orders", basePath = "/partner/orders" }: {
  initialTab?: PartnerOrdersTab;
  title?: string;
  /** Route this screen lives on (Partner: /partner/orders). */
  basePath?: string;
}) {
  const { shop } = useShop();
  const { bookings } = useBookings("open");
  const fresh = bookings.filter((b) => b.status === "requested").length;
  const [tab, setTab] = useState<PartnerOrdersTab>(initialTab);
  const base = useId();
  const select = (next: PartnerOrdersTab) => {
    setTab(next);
    // Keep the URL shareable without a navigation (works with static export too).
    window.history.replaceState(null, "", next === "history" ? `${basePath}?tab=history` : basePath);
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = tab === "bookings" ? "history" : "bookings";
    select(next);
    document.getElementById(`${base}-tab-${next}`)?.focus();
  };

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" title={title} subtitle={<>{fresh ? `${fresh} new ${fresh === 1 ? "request" : "requests"} · ` : ""}River Mobile bookings for {shop.name} <SampleNote className="ml-1 align-middle" /></>} />
      <div role="tablist" aria-label={title} className="mt-3 flex gap-6 border-b border-line px-1">
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              id={`${base}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => select(t.id)}
              onKeyDown={onKey}
              className={`relative -mb-px min-h-11 border-b-2 pb-2 pt-2 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${on ? "border-ink font-bold text-ink" : "border-transparent font-semibold text-muted hover:text-ink"}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div id={`${base}-panel-bookings`} role="tabpanel" aria-labelledby={`${base}-tab-bookings`} hidden={tab !== "bookings"} className="mt-5 pb-6">
        {tab === "bookings" ? (
          <BookingsList
            scope="open"
            emptyAction={!shop.location ? <Button href="/profile/edit" variant="secondary" size="md">Set your shop pin</Button> : undefined}
          />
        ) : null}
      </div>

      <div id={`${base}-panel-history`} role="tabpanel" aria-labelledby={`${base}-tab-history`} hidden={tab !== "history"} className="mt-5 pb-6">
        {tab === "history" ? <BookingsList scope="history" /> : null}
      </div>
    </div>
  );
}
