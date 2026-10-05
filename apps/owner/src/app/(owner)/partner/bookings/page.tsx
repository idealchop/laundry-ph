"use client";

import { Icon3D } from "@river-apps/icons";
import { Button, Card, EmptyState, Topbar } from "@river-apps/ui";
import { SampleNote } from "@/components/SampleNote";
import { useShop } from "@/lib/shop";

export default function Page() {
  const { shop } = useShop();
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" title="Bookings" subtitle={<>River Mobile pickups for {shop.name} <SampleNote className="ml-1 align-middle" /></>} />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
              Tip: set your map pin in Settings so River Mobile can find you when listing goes live.
            </p>
          ) : null}
          <Button className="mt-3" href="/settings" size="sm" variant="secondary">Shop address & pin</Button>
        </Card>
      </div>
    </div>
  );
}
