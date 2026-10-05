"use client";

import Link from "next/link";
import { Badge, Card, ListItem } from "@river-apps/ui";
import { CalendarClock, MessageSquareText, ScanLine, Smartphone, Store } from "lucide-react";
import { FocusHeader } from "@/components/FocusHeader";

export const FEATURES = [
  {
    id: "pos",
    icon: Store,
    title: "Walk-in POS",
    subtitle: "Counter orders, tickets and queue",
    status: "Paid" as const,
    href: "/orders/new",
  },
  {
    id: "listing",
    icon: Smartphone,
    title: "River Mobile listing",
    subtitle: "Shop appears for nearby customers",
    status: "Partner" as const,
    href: "/profile/edit",
  },
  {
    id: "scan",
    icon: ScanLine,
    title: "Scan credits",
    subtitle: "River Apps settles each accepted scan",
    status: "Partner" as const,
    href: "/profile?credits=1",
  },
  {
    id: "online",
    icon: CalendarClock,
    title: "Online bookings",
    subtitle: "Windows, capacity and phone bookings",
    status: "Paid" as const,
    href: "/online",
  },
  {
    id: "messages",
    icon: MessageSquareText,
    title: "Message automations",
    subtitle: "SMS templates — coming soon",
    status: "Coming soon" as const,
    href: "/messages",
  },
] as const;

/** Product feature list with Partner / Paid / Coming soon status — not the credits ledger. */
export function FeaturesScreen() {
  return (
    <>
      <FocusHeader title="Features" backHref="/profile" />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-10 pt-2">
        <Card padding="none" className="px-2 py-1">
          <ul>
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.id}>
                  <Link href={f.href} className="block rounded-tile focus-visible:outline-2 focus-visible:outline-ink">
                    <ListItem
                      variant="row"
                      className="py-2.5"
                      leading={
                        <span className="inline-flex size-10 items-center justify-center rounded-tile bg-grey-100">
                          <Icon size={18} strokeWidth={1.75} />
                        </span>
                      }
                      title={f.title}
                      subtitle={f.subtitle}
                      trailing={
                        <Badge variant="soft" size="sm">
                          {f.status}
                        </Badge>
                      }
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
        <p className="px-1 text-[13px] font-medium leading-snug text-muted">
          Partner free covers River Mobile bookings and listing. Paid unlocks walk-in POS, Online and more from ₱950/month.
        </p>
      </div>
    </>
  );
}
