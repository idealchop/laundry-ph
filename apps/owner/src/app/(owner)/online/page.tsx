"use client";

import { Icon3D } from "@river-apps/icons";
import { Button, Card, EmptyState, Topbar } from "@river-apps/ui";
import { SampleNote } from "@/components/SampleNote";

/** Paid-only schedule module — Partner API is Phase 2. */
export default function Page() {
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" title="Online / Schedule" subtitle={<>River Mobile + phone bookings <SampleNote className="ml-1 align-middle" /></>} />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <EmptyState
          illustration={<Icon3D name="basket" size={84} />}
          title="Coming in Phase 2"
          description="Full Online / Schedule (calendar, manual phone bookings, owner alerts) needs the Partner API. Partner shops already have a lighter bookings home."
          action={
            <div className="flex flex-col gap-2">
              <Button href="/partner" size="md">Open Partner bookings</Button>
              <Button href="/home" variant="secondary" size="md">Back to home</Button>
            </div>
          }
        />
        <Card className="px-5 py-4">
          <b className="text-[16px]">What’s planned</b>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] font-medium text-ink-2">
            <li>Scan to verify River Mobile customers</li>
            <li>Accept or decline online bookings and pickups</li>
            <li>Pickup calendar and manual phone bookings</li>
            <li>Owner SMS and email alerts</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
