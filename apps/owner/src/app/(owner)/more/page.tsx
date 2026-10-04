import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Icon3D, type IconName } from "@river-apps/icons";
import { Card, IconTile, ListItem, SectionHeader, Topbar } from "@river-apps/ui";
import { SampleNote } from "@/components/SampleNote";

export const metadata = { title: "More" };

const GROUPS: { title: string; items: { href: string; icon: IconName; title: string; subtitle: string }[] }[] = [
  {
    title: "Your shop",
    items: [
      { href: "/customers", icon: "chat", title: "Customers", subtitle: "Walk-ins, members and history" },
      { href: "/messages", icon: "check", title: "Message Automations", subtitle: "Confirmation and Thank you SMS" },
      { href: "/settings", icon: "shield", title: "Settings", subtitle: "Shop profile, staff and plan" },
    ],
  },
  {
    title: "Preview",
    items: [
      { href: "/partner", icon: "basket", title: "Partner app", subtitle: "What a Partner (free) shop sees" },
      { href: "/t/LDY-0418", icon: "ewallet", title: "Customer ticket", subtitle: "What a walk-in sees after scanning the QR" },
    ],
  },
];

/** Phone-only overflow menu for modules that don't fit in the tab bar. */
export default function MorePage() {
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pt-4 lg:pt-6">
      <Topbar className="px-1" title="More" subtitle={<>Everything else in Laundry.ph <SampleNote className="ml-1 align-middle" /></>} />
      {GROUPS.map((g) => (
        <section key={g.title}>
          <SectionHeader as="h2" className="px-1 pb-2.5 pt-5" title={g.title} />
          <Card padding="none" className="px-3.5 py-1.5">
            <ul>
              {g.items.map((it) => (
                <li key={it.href}>
                  <Link href={it.href} className="block rounded-tile focus-visible:outline-2 focus-visible:outline-ink">
                    <ListItem variant="row" className="py-2" leading={<IconTile size={44}><Icon3D name={it.icon} size={30} /></IconTile>}
                      title={it.title} subtitle={it.subtitle} trailing={<ChevronRight size={20} strokeWidth={1.75} className="text-subtle" />} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}
