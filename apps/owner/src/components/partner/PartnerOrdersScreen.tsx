"use client";

import { Icon3D } from "@river-apps/icons";
import { Button, Card, EmptyState, Topbar } from "@river-apps/ui";
import { useId, useState, type KeyboardEvent } from "react";
import { SampleNote } from "@/components/SampleNote";
import { useShop } from "@/lib/shop";

export type PartnerOrdersTab = "bookings" | "history";
const TABS: { id: PartnerOrdersTab; label: string }[] = [
  { id: "bookings", label: "Bookings" },
  { id: "history", label: "History" },
];

/** Partner "Orders": River Mobile Bookings and History behind simple text tabs (default Bookings). */
export function PartnerOrdersScreen({ initialTab = "bookings" }: { initialTab?: PartnerOrdersTab }) {
  const { shop } = useShop();
  const [tab, setTab] = useState<PartnerOrdersTab>(initialTab);
  const base = useId();
  const select = (next: PartnerOrdersTab) => {
    setTab(next);
    // Keep the URL shareable without a navigation (works with static export too).
    window.history.replaceState(null, "", next === "history" ? "/partner/orders?tab=history" : "/partner/orders");
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
      <Topbar className="px-1" title="Orders" subtitle={<>River Mobile bookings for {shop.name} <SampleNote className="ml-1 align-middle" /></>} />
      <div role="tablist" aria-label="Orders" className="mt-3 flex gap-6 border-b border-line px-1">
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
        <div className="grid gap-4 lg:grid-cols-2">
          <EmptyState
            illustration={<Icon3D name="basket" size={84} />}
            title="No live bookings yet"
            description="Accept and decline from River Mobile arrives with the Partner API (Phase 2). Until then this list stays empty — we won’t fake bookings."
            action={<Button href="/partner" variant="secondary" size="md">Back to Partner home</Button>}
          />
          <Card className="px-5 py-4">
            <b className="text-[16px]">What’s planned</b>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] font-medium text-ink-2">
              <li>Incoming River Mobile bookings with accept / decline</li>
              <li>Weigh-in and final amount (laundry is priced by kilo)</li>
              <li>Owner alerts for new bookings</li>
            </ul>
            {!shop.location ? (
              <p className="mt-3 text-[13px] font-semibold text-muted">
                Tip: set your map pin in Edit shop so River Mobile can find you when listing goes live.
              </p>
            ) : null}
            <Button className="mt-3" href="/profile/edit" size="sm" variant="secondary">Shop address & pin</Button>
          </Card>
        </div>
      </div>

      <div id={`${base}-panel-history`} role="tabpanel" aria-labelledby={`${base}-tab-history`} hidden={tab !== "history"} className="mt-5 pb-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <EmptyState
            illustration={<Icon3D name="folded" size={84} />}
            title="Nothing here yet"
            description="Completed and declined Partner bookings will show up after the Partner API ships. No sample history is invented on this screen."
            action={<Button href="/partner" variant="secondary" size="md">Back to Partner home</Button>}
          />
          <Card className="px-5 py-4">
            <b className="text-[16px]">What’s planned</b>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] font-medium text-ink-2">
              <li>Completed and declined bookings</li>
              <li>Totals per day and week</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
