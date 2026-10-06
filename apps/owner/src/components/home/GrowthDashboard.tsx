"use client";
import { Avatar, Badge, BarChart, Card, CardHeader, EmptyState, ListItem, ProgressRing, QueueList, StatCard } from "@river-apps/ui";
import Link from "next/link";
import type { Customer, DaySummary, Order, OrderStatus, SalesPoint, Shop } from "@/data";
import { money, minimalDate } from "@/lib/format";
import { customerTag } from "@/lib/orders";
import { SampleNote } from "../SampleNote";
import { AdvanceButton } from "../ui";
import { HomeHeroDesktop, HomeTopbar } from "./HomeHero";

const linkCls = "text-[14px] font-bold underline decoration-grey-300 underline-offset-[3px]";

export interface GrowthDashboardProps {
  shop: Shop;
  today: DaySummary;
  /** Centavos per day, oldest first. */
  week: SalesPoint[];
  /** Open orders, oldest first. */
  queue: Order[];
  customers: Customer[];
  onAdvance: (order: Order, to: OrderStatus) => void;
  busyId?: string | null;
}

/** Paid shop, desktop: Growth Dashboard (shown from the `lg` breakpoint). */
export function GrowthDashboard({ shop, today, week, queue, customers, onAdvance, busyId }: GrowthDashboardProps) {
  const pct = today.dailyTargetCentavos > 0 ? Math.round((today.salesCentavos / today.dailyTargetCentavos) * 100) : 0;
  const topCustomers = [...customers].sort((a, b) => b.spentCentavos - a.spentCentavos).slice(0, 4);
  const weekTotal = week.reduce((s, d) => s + d.value, 0);
  const peak = week.reduce((best, d, i) => (d.value > (week[best]?.value ?? 0) ? i : best), 0);
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pb-6 pt-4 lg:px-[30px] lg:pt-6">
      <HomeTopbar shop={shop} today={today} subtitleExtra={<> <SampleNote className="ml-1 align-middle" /></>} />
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_286px]">
        <HomeHeroDesktop shop={shop} today={today} />
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
      <div className="mt-5 grid gap-5 pb-6 xl:grid-cols-[1.25fr_1fr_1fr]">
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
                id: o.id,
                title: <Link href={`/orders/view?id=${o.id}`} className="hover:underline">{o.customer.name}</Link>,
                subtitle: <>{o.detail} · {minimalDate(o.createdAt)}</>,
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
