import { ArrowRight, Plus, ScanLine } from "lucide-react";
import { DryerIcon, Icon3D } from "@river-apps/icons";
import { Avatar, Button, Card, HeroBanner, IconButton, IconTile, QueueList, ResourceCard, SectionHeader, StatCard } from "@river-apps/ui";
import type { DaySummary, Machine, QueuedOrder, Shop } from "@/data";
import { peso } from "@/lib/format";
import { LaundryScene } from "../brand";
import { Greeting } from "../Greeting";

/** Paid home on phones (and tablets below the `lg` breakpoint). */
export function PaidHomeMobile({ shop, today, machines, queue }: { shop: Shop; today: DaySummary; machines: Machine[]; queue: QueuedOrder[] }) {
  const busy = machines.filter((m) => m.status === "running").length;
  return (
    <div className="mx-auto w-full max-w-[560px] pb-4">
      <Greeting title={shop.name} name={shop.ownerName} avatar={shop.ownerAvatar} notifications={today.notifications} />
      <HeroBanner
        className="mx-4 mt-2"
        size="sm"
        eyebrow={`Today · ${today.dateLabel}`}
        title={peso(today.sales)}
        titleSize="display"
        description={`${today.orders} orders · ${today.kgWashed} kg washed`}
        contentWidth={190}
        actions={<Button href="/scan/result" variant="white" size="sm" className="h-11 px-4 text-[14.5px]" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />}>Scan customer</Button>}
        illustration={<LaundryScene size={168} />}
        illustrationClassName="-right-[10px] bottom-3"
      />
      <div className="mx-4 mt-2.5 grid grid-cols-3 gap-2.5">
        <StatCard className="pb-3" label="In queue" value={String(today.inQueue)} />
        <StatCard className="pb-3" label="Ready" value={String(today.ready)} />
        <StatCard className="pb-3" label="Unpaid" value={peso(today.unpaid)} />
      </div>
      <SectionHeader className="px-5 pb-2.5 pt-4" title="Machines" aside={`${busy} of ${machines.length} in use`} />
      <div className="grid grid-cols-2 gap-2.5 px-4">
        {machines.map((m) =>
          m.status === "running" ? (
            <ResourceCard
              key={m.id}
              icon={<IconTile size={48} className="-ml-[5px] -mt-[5px]"><Icon3D name={m.kind} size={38} /></IconTile>}
              eyebrow={`${m.name} · ${m.stage}`}
              title={`${m.customerName} · ${m.kg} kg`}
              meta={m.orderRef}
              progress={{ value: m.progress ?? 0, label: `${m.minutesLeft}m`, ariaLabel: `${m.name}: ${m.minutesLeft} minutes left` }}
            />
          ) : (
            <ResourceCard
              key={m.id}
              variant="inverse"
              icon={<DryerIcon size={38} />}
              eyebrow={<>{m.name} · <b className="text-on-ink">Free</b></>}
              title="Load next order"
              meta={m.nextOrderRef ? `Next: ${m.nextOrderRef}` : undefined}
              action={<IconButton variant="white" label={`Load next order into ${m.name}`} className="-mr-1 -mt-0.5 size-11" icon={<ArrowRight size={20} strokeWidth={2.2} />} />}
            />
          ),
        )}
      </div>
      <SectionHeader className="px-5 pb-1 pt-4" title="Order queue" aside={`${today.inQueue} waiting`} />
      <Card padding="none" className="mx-4 px-4 py-1.5">
        <QueueList
          label="Order queue"
          items={queue.map((o) => ({
            id: o.ref,
            leading: <Avatar name={o.customer.name} preset={o.customer.avatar} size={36} />,
            title: o.customer.name,
            subtitle: <><span className="font-mono">{o.ref}</span> · {o.detail}</>,
            trailing: o.status,
          }))}
        />
      </Card>
      <div className="px-4 pt-3">
        <Button href="/orders/new" variant="secondary" fullWidth leadingIcon={<Plus size={20} strokeWidth={2} />}>New walk-in order</Button>
      </div>
    </div>
  );
}
