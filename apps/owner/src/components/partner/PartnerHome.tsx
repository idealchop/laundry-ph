import { ScanLine } from "lucide-react";
import { Icon3D } from "@river-apps/icons";
import { Avatar, Badge, Button, DateStrip, HeroBanner, IconTile, ListItem, MonoText, SectionHeader, Topbar } from "@river-apps/ui";
import Link from "next/link";
import type { DaySummary, PickupRequest, Schedule, Shop } from "@/data";
import { LaundryScene } from "../brand";
import { Greeting } from "../Greeting";
import { SampleNote } from "../SampleNote";
import { PickupRequestCard } from "./PickupRequestCard";

/** Partner home: River Mobile bookings, scan to verify, and pickups to accept. Mobile-first, two columns on desktop. */
export function PartnerHome({ shop, today, schedule, requests }: { shop: Shop; today: DaySummary; schedule: Schedule; requests: PickupRequest[] }) {
  const open = requests.filter((r) => r.isNew);
  const [first, ...rest] = requests;
  return (
    <div className="mx-auto w-full max-w-[560px] pb-4 lg:max-w-[1120px] lg:px-[30px] lg:pt-6">
      <div className="lg:hidden">
        <Greeting title={`Hi, ${shop.ownerName} 👋`} name={shop.ownerName} avatar={shop.ownerAvatar} photoUrl={shop.photoUrls?.[0]} />
      </div>
      <Topbar
        className="mb-5 hidden lg:flex"
        title={`Hi, ${shop.ownerName} 👋`}
        subtitle={<>Partner · {shop.name} · {today.longDateLabel} <SampleNote className="ml-1 align-middle" /></>}
        actions={
          <Link
            href="/profile"
            aria-label="Profile"
            className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Avatar
              name={shop.name}
              preset={shop.photoUrls?.[0] ? undefined : shop.ownerAvatar}
              src={shop.photoUrls?.[0]}
              size={44}
              decorative={false}
            />
          </Link>
        }
      />
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div>
          <HeroBanner
            className="mx-4 mt-2 lg:mx-0 lg:mt-0"
            eyebrow="River Mobile"
            title="Scan River Mobile customers"
            description="Check in pickups and drop-offs fast."
            contentWidth={190}
            actions={<Button href="/scan/result" variant="white" size="md" className="h-11 px-4 text-[14.5px]" leadingIcon={<ScanLine size={20} strokeWidth={1.75} />}>Scan customer</Button>}
            illustration={<LaundryScene size={164} folded={false} />}
            illustrationClassName="right-0 bottom-5"
          />
          <SectionHeader className="px-5 pb-3 pt-[22px] lg:px-1" title="Schedule" aside={schedule.monthLabel} />
          <DateStrip className="px-5 lg:px-0" items={schedule.days} selectedKey={schedule.todayKey} />
        </div>
        <div>
          <SectionHeader className="px-5 pb-3 pt-[18px] lg:px-1 lg:pt-0" title="Pickups to accept" aside={requests.length ? `${open.length} new · sample` : "Phase 2"} />
          <div className="flex flex-col gap-2.5 px-4 lg:px-0">
            {requests.length === 0 ? (
              <p className="rounded-[22px] bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">
                Live River Mobile pickups arrive with the Partner API. Accept / decline is not wired yet — this list stays empty on real shops.
              </p>
            ) : null}
            {first ? <PickupRequestCard request={first} /> : null}
            {rest.map((r) => (
              <ListItem
                key={r.id}
                leading={<IconTile><Icon3D name={r.icon} size={34} /></IconTile>}
                title={`${r.kind === "pickup" ? "Pickup" : "Drop-off"} · ${r.serviceName}`}
                subtitle={<>{r.window}{r.pieces ? ` · ${r.pieces} pcs` : ""}{r.estimateKg ? ` · about ${r.estimateKg} kg` : ""}{r.ref ? <> · <MonoText>{r.ref}</MonoText></> : null}</>}
                trailing={r.isNew ? <Badge variant="soft">New</Badge> : <Avatar name={r.customer.name} preset={r.customer.avatar} size={34} />}
              />
            ))}
            <Button className="mt-1" href="/settings/billing" variant="secondary" size="sm">Plans · Partner free · Paid ₱950/mo</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
