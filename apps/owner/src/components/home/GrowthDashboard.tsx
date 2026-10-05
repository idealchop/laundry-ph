"use client";
import { Bell, Plus, ScanLine } from "lucide-react";
import { Icon3D, SparkleIcon } from "@river-apps/icons";
import {
  Avatar, Badge, BarChart, Button, Card, CardHeader, EmptyState, HeroBanner, IconButton, IconTile, ListItem, ProgressRing, QueueList, SearchInput,
  StatCard, Topbar,
} from "@river-apps/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Customer, DaySummary, GrowthStat, GrowthTip, Order, OrderStatus, SalesPoint, Shop } from "@/data";
import { money } from "@/lib/format";
import { customerTag } from "@/lib/orders";
import { LaundryScene } from "../brand";
import { SampleNote } from "../SampleNote";
import { AdvanceButton, statusIcon } from "../ui";

const linkCls = "text-[14px] font-bold underline decoration-grey-300 underline-offset-[3px]";

export interface GrowthDashboardProps {
  shop: Shop;
  today: DaySummary;
  stats: GrowthStat[];
  tip: GrowthTip | null;
  /** Centavos per day, oldest first. */
  week: SalesPoint[];
  /** Open orders, oldest first. */
  queue: Order[];
  customers: Customer[];
  onAdvance: (order: Order, to: OrderStatus) => void;
  busyId?: string | null;
}

/** Paid shop, desktop: Growth Dashboard (shown from the `lg` breakpoint). */
export function GrowthDashboard({ shop, today, stats, tip, week, queue, customers, onAdvance, busyId }: GrowthDashboardProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const pct = today.dailyTargetCentavos > 0 ? Math.round((today.salesCentavos / today.dailyTargetCentavos) * 100) : 0;
  const topCustomers = [...customers].sort((a, b) => b.spentCentavos - a.spentCentavos).slice(0, 4);
  const weekTotal = week.reduce((s, d) => s + d.value, 0);
  const peak = week.reduce((best, d, i) => (d.value > (week[best]?.value ?? 0) ? i : best), 0);
  return (
    <div className="px-[30px] pt-6">
      <Topbar
        title={`Hi ${shop.ownerName}, here’s today`}
        subtitle={<>{today.longDateLabel} · {shop.name}{shop.area ? `, ${shop.area.split(", ").pop()}` : ""} <SampleNote className="ml-1 align-middle" /></>}
        actions={<>
          <form className="hidden xl:flex" onSubmit={(e) => { e.preventDefault(); if (search.trim()) router.push(`/scan/result?code=${encodeURIComponent(search.trim())}`); }}>
            <SearchInput className="w-[300px]" placeholder="Find ticket, e.g. LDY-0423" label="Find order by ticket" value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
          <IconButton variant="surface" label="Notifications" count={today.notifications} icon={<Bell size={20} strokeWidth={1.75} />} />
          <Avatar name={shop.ownerName} preset={shop.ownerAvatar} size={44} />
        </>}
      />
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_286px]">
        <HeroBanner
          size="lg"
          eyebrow={`Today · ${today.dateLabel}`}
          title={`Today: ${money(today.salesCentavos)} · ${today.orders} orders`}
          titleSize="lg"
          description={`${today.kgWashed} kg washed · ${today.inQueue} orders in progress · ${today.ready} ready for pickup`}
          contentWidth={460}
          actions={<>
            <Button href="/orders/new" variant="white" size="md" leadingIcon={<Plus size={18} strokeWidth={1.9} />}>New walk-in order</Button>
            <Button href="/scan/result" variant="ghost-inverse" size="md" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />}>Scan customer</Button>
          </>}
          illustration={<LaundryScene size={268} />}
          illustrationClassName="right-[34px] bottom-3"
        />
        <StatCard
          className="px-5 pb-4 pt-[18px]"
          layout="title"
          label="Daily target"
          footer={<>
            <span className="flex flex-col leading-[1.2]"><b className="text-[17px] font-extrabold">{money(today.salesCentavos)}</b><small className="text-[12px] font-semibold text-muted">of {money(today.dailyTargetCentavos)}</small></span>
            <Badge variant="soft">{money(Math.max(0, today.dailyTargetCentavos - today.salesCentavos))} to go</Badge>
          </>}
        >
          <div className="my-1.5 flex justify-center"><ProgressRing value={pct} size={124} thickness={11.5} label={`${pct}%`} labelSize={23} ariaLabel={`${pct}% of daily target`} /></div>
        </StatCard>
      </div>
      <div className="mt-[18px] grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.id} className="px-4 pb-3.5 pt-4" label={s.label} value={s.value} caption={s.caption} trailing={<IconTile size={44}><Icon3D name={s.icon} size={30} /></IconTile>} />
        ))}
        {tip ? (
          <Card tone="inverse" padding="none" className="flex items-start gap-3 px-4 pb-3.5 pt-4">
            <IconTile size={44} tone="dark"><SparkleIcon size={30} /></IconTile>
            <span className="flex flex-col leading-[1.3]">
              <span className="flex items-center gap-1.5"><Badge variant="on-ink" size="sm">{tip.tag}</Badge><small className="text-[12px] font-semibold text-on-ink-muted">{tip.title} · sample</small></span>
              <b className="mt-1 text-[13.5px]">{tip.text}</b>
            </span>
          </Card>
        ) : null}
      </div>
      <div className="mt-[18px] grid gap-5 pb-6 xl:grid-cols-[1.25fr_1fr_1fr]">
        <Card padding="none" className="px-[18px] pb-2.5 pt-4 xl:h-[318px]">
          <CardHeader title="Sales" subtitle={`Last 7 days · ${money(weekTotal)}`} action={<Link href="/sales" className={linkCls}>Sales Record</Link>} />
          <BarChart className="mt-3.5 w-full" data={week} highlightIndex={peak} tooltip={money(week[peak]?.value ?? 0)} width={420} height={236} formatValue={money}
            ariaLabel={`Sales by day for the last 7 days, peak ${money(week[peak]?.value ?? 0)} on ${week[peak]?.label}`} />
        </Card>
        <Card padding="none" className="px-[18px] pb-2.5 pt-4 xl:h-[318px]">
          <CardHeader className="mb-1.5" title="Orders" subtitle={`${today.inQueue} in progress · ${today.ready} ready`} action={<Link href="/orders" className={linkCls}>Open board</Link>} />
          {queue.length ? (
            <div className="max-h-[240px] overflow-y-auto">
              <QueueList label="Orders" items={queue.map((o) => ({
                id: o.id, leading: <IconTile size={40}>{statusIcon(o.status)}</IconTile>,
                title: <Link href={`/orders/view?id=${o.id}`} className="hover:underline">{o.customer.name}</Link>,
                subtitle: <><span className="font-mono">{o.ref}</span> · {o.detail}</>,
                trailing: <AdvanceButton order={o} compact onAdvance={(to) => onAdvance(o, to)} busy={busyId === o.id} />,
              }))} />
            </div>
          ) : (
            <EmptyState className="mt-3 border-0 py-6" title="Queue is clear" description="Create a walk-in order to start." />
          )}
        </Card>
        <Card padding="none" className="px-[18px] pb-2.5 pt-4 xl:h-[318px]">
          <CardHeader className="mb-1.5" title="Customers" subtitle={`${today.newCustomersThisWeek} new this week`} action={<Link href="/customers" className={linkCls}>See all</Link>} />
          <ul aria-label="Top customers">
            {topCustomers.map((c) => {
              const tag = customerTag(c);
              return (
                <ListItem as="li" key={c.id} variant="row" leading={<Avatar name={c.name} preset={c.avatar} size={40} />}
                  title={<>{c.name} <Badge variant={tag === "Member" ? "solid" : "soft"} size="sm" className="ml-1 align-[1px]">{tag}</Badge></>}
                  subtitle={`${c.source} · ${c.visits === 0 ? "no visits yet" : c.visits === 1 ? "first visit" : `${c.visits} visits`}`}
                  trailing={<span className="flex flex-col items-end leading-[1.3]"><b className="text-[14px] font-extrabold">{money(c.spentCentavos)}</b><small className="text-[12px] font-medium text-muted">all time</small></span>} />
              );
            })}
            {topCustomers.length === 0 ? <li className="py-6 text-center text-[13.5px] font-semibold text-muted">No customers yet</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
