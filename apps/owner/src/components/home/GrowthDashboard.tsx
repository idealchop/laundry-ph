import { Bell, Plus, ScanLine } from "lucide-react";
import { CheckIcon, FoldedClothesIcon, Icon3D, LaundryBasketIcon, SparkleIcon, WasherIcon, DryerIcon } from "@river-apps/icons";
import {
  Avatar, Badge, BarChart, Button, Card, CardHeader, HeroBanner, IconButton, IconTile, ListItem, ProgressRing, QueueList, SearchInput,
  SegmentedControl, StatCard, Topbar,
} from "@river-apps/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Customer, DaySummary, GrowthStat, GrowthTip, QueuedOrder, QueueStatus, SalesPoint, Shop } from "@/data";
import { peso } from "@/lib/format";
import { LaundryScene } from "../brand";
import { SampleNote } from "../SampleNote";

const STATUS_ICON: Record<QueueStatus, ReactNode> = {
  Waiting: <LaundryBasketIcon size={26} />,
  Washing: <WasherIcon size={26} />,
  Drying: <DryerIcon size={26} />,
  Folding: <FoldedClothesIcon size={26} />,
  Ready: <CheckIcon size={26} />,
};
const linkCls = "text-[14px] font-bold underline decoration-grey-300 underline-offset-[3px]";

export interface GrowthDashboardProps {
  shop: Shop;
  today: DaySummary;
  stats: GrowthStat[];
  tip: GrowthTip;
  week: SalesPoint[];
  queue: QueuedOrder[];
  customers: Customer[];
}

/** Paid shop, desktop: Growth Dashboard (shown from the `lg` breakpoint). */
export function GrowthDashboard({ shop, today, stats, tip, week, queue, customers }: GrowthDashboardProps) {
  const pct = Math.round((today.sales / today.dailyTarget) * 100);
  const weekTotal = week.reduce((s, d) => s + d.value, 0);
  const peak = week.reduce((best, d, i) => (d.value > (week[best]?.value ?? 0) ? i : best), 0);
  return (
    <div className="px-[30px] pt-6">
      <Topbar
        title={`Hi ${shop.ownerName}, here’s today`}
        subtitle={<>{today.longDateLabel} · {shop.name}, {shop.area.split(", ").pop()} <SampleNote className="ml-1 align-middle" /></>}
        actions={<>
          <SearchInput className="hidden w-[300px] xl:flex" placeholder="Search order or customer" label="Search order or customer" />
          <IconButton variant="surface" label="Notifications" count={today.notifications} icon={<Bell size={20} strokeWidth={1.75} />} />
          <Avatar name={shop.ownerName} preset={shop.ownerAvatar} size={44} />
        </>}
      />
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_286px]">
        <HeroBanner
          size="lg"
          eyebrow={`Today · ${today.dateLabel}`}
          title={`Today: ${peso(today.sales)} · ${today.orders} orders`}
          titleSize="lg"
          description={`${today.kgWashed} kg washed · ${today.inQueue} orders in the queue · ${today.newRiverMobilePickups} new River Mobile pickups`}
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
          trailing={<span className="text-[12px] font-semibold text-muted">Sample</span>}
          footer={<>
            <span className="flex flex-col leading-[1.2]"><b className="text-[17px] font-extrabold">{peso(today.sales)}</b><small className="text-[12px] font-semibold text-muted">of {peso(today.dailyTarget)}</small></span>
            <Badge variant="soft">{peso(Math.max(0, today.dailyTarget - today.sales))} to go</Badge>
          </>}
        >
          <div className="my-1.5 flex justify-center"><ProgressRing value={pct} size={124} thickness={11.5} label={`${pct}%`} labelSize={23} ariaLabel={`${pct}% of daily target`} /></div>
        </StatCard>
      </div>
      <div className="mt-[18px] grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.id} className="px-4 pb-3.5 pt-4" label={s.label} value={s.value} caption={s.caption} trailing={<IconTile size={44}><Icon3D name={s.icon} size={30} /></IconTile>} />
        ))}
        <Card tone="inverse" padding="none" className="flex items-start gap-3 px-4 pb-3.5 pt-4">
          <IconTile size={44} tone="dark"><SparkleIcon size={30} /></IconTile>
          <span className="flex flex-col leading-[1.3]">
            <span className="flex items-center gap-1.5"><Badge variant="on-ink" size="sm">{tip.tag}</Badge><small className="text-[12px] font-semibold text-on-ink-muted">{tip.title}</small></span>
            <b className="mt-1 text-[13.5px]">{tip.text}</b>
          </span>
        </Card>
      </div>
      <div className="mt-[18px] grid gap-5 pb-6 xl:grid-cols-[1.25fr_1fr_1fr]">
        <Card padding="none" className="px-[18px] pb-2.5 pt-4 xl:h-[318px]">
          <CardHeader title="Sales" subtitle={`This week · ${peso(weekTotal)}`} action={<SegmentedControl label="Range" defaultValue="week" options={[{ value: "today", label: "Today" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />} />
          <BarChart className="mt-3.5 w-full" data={week} highlightIndex={peak} tooltip={peso(week[peak]?.value ?? 0)} width={420} height={236} formatValue={peso}
            ariaLabel={`Sales by day this week, peak ${peso(week[peak]?.value ?? 0)} on ${week[peak]?.label}`} />
        </Card>
        <Card padding="none" className="px-[18px] pb-2.5 pt-4 xl:h-[318px]">
          <CardHeader className="mb-1.5" title="Orders" subtitle={`${today.inQueue} in queue · ${today.ready} ready`} action={<Link href="/online" className={linkCls}>Open</Link>} />
          <QueueList label="Orders" items={queue.map((o) => ({
            id: o.ref, leading: <IconTile size={40}>{STATUS_ICON[o.status]}</IconTile>, title: o.customer.name,
            subtitle: <><span className="font-mono">{o.ref}</span> · {o.detail}</>, trailing: o.status,
          }))} />
        </Card>
        <Card padding="none" className="px-[18px] pb-2.5 pt-4 xl:h-[318px]">
          <CardHeader className="mb-1.5" title="Customers" subtitle={`${today.newCustomersThisWeek} new this week`} action={<Link href="/customers" className={linkCls}>See all</Link>} />
          <ul aria-label="Top customers">
            {customers.map((c) => (
              <ListItem as="li" key={c.id} variant="row" leading={<Avatar name={c.name} preset={c.avatar} size={40} />}
                title={<>{c.name} <Badge variant={c.tag === "Member" ? "solid" : "soft"} size="sm" className="ml-1 align-[1px]">{c.tag}</Badge></>}
                subtitle={`${c.source} · ${c.visits === 1 ? "first visit" : `${c.visits} visits`}`}
                trailing={<span className="flex flex-col items-end leading-[1.3]"><b className="text-[14px] font-extrabold">{peso(c.spent)}</b><small className="text-[12px] font-medium text-muted">all time</small></span>} />
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
