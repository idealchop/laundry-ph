"use client";

import { Icon3D } from "@river-apps/icons";
import { Button, Card, EmptyState, Topbar } from "@river-apps/ui";
import { SampleNote } from "@/components/SampleNote";

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" title="History" subtitle={<>Past River Mobile bookings <SampleNote className="ml-1 align-middle" /></>} />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
  );
}
