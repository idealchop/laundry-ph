"use client";

import { Icon3D } from "@river-apps/icons";
import { Button, Card, EmptyState, Topbar } from "@river-apps/ui";
import { SampleNote } from "@/components/SampleNote";

/** Paid-only. SMS is not wired — honest coming soon (no fake sends). */
export default function Page() {
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" title="Message Automations" subtitle={<>SMS to customers — Paid plan <SampleNote className="ml-1 align-middle" /></>} />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <EmptyState
          illustration={<Icon3D name="chat" size={84} />}
          title="SMS not connected yet"
          description="We won’t pretend texts are sending. Confirmation and Thank-you SMS land in Phase 3 with a real provider and per-plan quota."
          action={<Button href="/home" variant="secondary" size="md">Back to home</Button>}
        />
        <Card className="px-5 py-4">
          <b className="text-[16px]">Paid plan · coming soon</b>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] font-medium text-ink-2">
            <li>Default SMS: Confirmation and Thank you</li>
            <li>Custom messages from templates</li>
            <li>SMS quota per plan</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
