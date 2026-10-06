"use client";
import { Icon3D } from "@river-apps/icons";
import { Avatar, Badge, Button, Card, CardHeader, DateStrip, IconTile, ListItem, MonoText, SectionHeader } from "@river-apps/ui";
import Link from "next/link";
import type { DaySummary, PickupRequest, Schedule, Shop } from "@/data";
import { Greeting } from "../Greeting";
import { HomeHeroDesktop, HomeHeroMobile, HomeTopbar } from "../home/HomeHero";
import { SampleNote } from "../SampleNote";
import { PickupRequestCard } from "./PickupRequestCard";

const linkCls = "text-[14px] font-bold underline decoration-grey-300 underline-offset-[3px]";

function Pickups({ requests }: { requests: PickupRequest[] }) {
  const [first, ...rest] = requests;
  return (
    <div className="flex flex-col gap-2.5">
      {requests.length === 0 ? (
        <p className="rounded-[18px] bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">
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
    </div>
  );
}

function UpgradeCard({ className }: { className?: string }) {
  return (
    <Card padding="none" className={`flex items-center justify-between gap-3 px-4 py-3.5 ${className ?? ""}`}>
      <span className="flex min-w-0 flex-col leading-[1.3]">
        <b className="text-[14px]">You’re on Partner (free)</b>
        <small className="text-[12.5px] font-semibold text-muted">Paid adds the counter POS, Sales and Customers · ₱950/mo</small>
      </span>
      <Button href="/settings/billing" variant="secondary" size="sm" className="flex-none">Plans</Button>
    </Card>
  );
}

/**
 * Partner (free) home. Same header and black hero as Paid home (from River Mobile / online bookings data),
 * without the Walk-in button. Partner sections below: schedule, pickups to accept, plan upgrade.
 */
export function PartnerHome({ shop, today, schedule, requests }: { shop: Shop; today: DaySummary; schedule: Schedule; requests: PickupRequest[] }) {
  const open = requests.filter((r) => r.isNew);
  const pickupsAside = requests.length ? `${open.length} new · sample` : "Phase 2";
  return (
    <>
      {/* Phone: mirrors PaidHomeMobile spacing. */}
      <div className="mx-auto w-full max-w-[560px] pb-4 lg:hidden">
        <Greeting name={shop.ownerName} avatar={shop.ownerAvatar} photoUrl={shop.photoUrls?.[0]} onlineHref="/partner/bookings" />
        <HomeHeroMobile shop={shop} today={today} showWalkIn={false} />
        <SectionHeader className="px-5 pb-1 pt-4" title="Schedule" aside={schedule.monthLabel} />
        <Card padding="none" className="mx-4 px-3 py-3">
          <DateStrip items={schedule.days} selectedKey={schedule.todayKey} />
        </Card>
        <SectionHeader className="px-5 pb-1 pt-4" title="Pickups to accept" aside={pickupsAside} />
        <div className="mx-4"><Pickups requests={requests} /></div>
        <UpgradeCard className="mx-4 mt-2.5" />
      </div>

      {/* Desktop: mirrors GrowthDashboard spacing. */}
      <div className="mx-auto hidden w-full max-w-[1120px] px-4 pb-6 pt-4 lg:block lg:px-[30px] lg:pt-6">
        <HomeTopbar shop={shop} today={today} onlineHref="/partner/bookings" subtitleExtra={<> · Partner <SampleNote className="ml-1 align-middle" /></>} />
        <div className="mt-5">
          <HomeHeroDesktop shop={shop} today={today} showWalkIn={false} />
        </div>
        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_1fr]">
          <Card padding="none" className="px-[18px] pb-4 pt-4">
            <CardHeader className="mb-3" title="Schedule" subtitle={schedule.monthLabel} />
            <DateStrip items={schedule.days} selectedKey={schedule.todayKey} />
          </Card>
          <Card padding="none" className="px-[18px] pb-4 pt-4">
            <CardHeader className="mb-3" title="Pickups to accept" subtitle={pickupsAside} action={<Link href="/partner/bookings" className={linkCls}>All bookings</Link>} />
            <Pickups requests={requests} />
          </Card>
        </div>
        <UpgradeCard className="mt-5" />
      </div>
    </>
  );
}
