import { cn } from "@river-apps/ui";

/** Placeholder block; pulses only when motion is allowed. */
export function Sk({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block rounded-[12px] bg-grey-100 motion-safe:animate-pulse", className)} />;
}

function Shell({ children, wide, className }: { children: React.ReactNode; wide?: boolean; className?: string }) {
  return (
    <div role="status" aria-label="Loading" aria-busy="true" className={cn("mx-auto w-full max-w-[560px] px-4 pb-8 pt-5", wide ? "lg:max-w-[1120px] lg:px-[30px]" : "lg:max-w-[880px] lg:px-[30px]", className)}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

const Title = () => <div className="flex items-center gap-2"><Sk className="size-11 rounded-full" /><span className="space-y-1.5"><Sk className="h-7 w-36" /><Sk className="h-3.5 w-24" /></span></div>;
const Row = () => (
  <div className="flex items-center gap-3 px-4 py-3">
    <Sk className="size-10 flex-none rounded-full" />
    <span className="flex-1 space-y-1.5"><Sk className="h-4 w-2/3" /><Sk className="h-3 w-1/3" /></span>
    <Sk className="h-4 w-14" />
  </div>
);

/** List screens: Orders, History, bookings. */
export function ListSkeleton({ rows = 5, stats = true }: { rows?: number; stats?: boolean }) {
  return (
    <Shell>
      <Title />
      <div className="mt-5 flex items-center justify-between"><Sk className="h-4 w-28" /><Sk className="h-9 w-24 rounded-pill" /></div>
      {stats ? <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Sk key={i} className="h-[84px] rounded-card" />)}</div> : null}
      <Sk className="mt-4 h-12 rounded-pill" />
      <RowsSkeleton rows={rows} className="mt-4" />
    </Shell>
  );
}

/** Rows only (inside an existing screen). */
export function RowsSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return <div role="status" aria-label="Loading" className={cn("mt-3 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card", className)}>{Array.from({ length: rows }, (_, i) => <Row key={i} />)}</div>;
}

/** Three stat tiles (Home) while a location switch settles. */
export function StatsSkeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("grid grid-cols-3 gap-2.5 lg:gap-5", className)}>{Array.from({ length: 3 }, (_, i) => <Sk key={i} className="h-[76px] rounded-card" />)}</div>;
}

/** Sales: tabs, stat cards, chart, ranking. */
export function DashboardSkeleton() {
  return (
    <Shell wide>
      <Title />
      <Sk className="mt-4 h-11 w-full rounded-pill" />
      <div className="mt-4 grid grid-cols-2 gap-3"><Sk className="col-span-2 h-24 rounded-card" /><Sk className="h-20 rounded-card" /><Sk className="h-20 rounded-card" /></div>
      <Sk className="mt-3 h-52 rounded-card" />
      <RowsSkeleton rows={3} />
    </Shell>
  );
}

/** Home: header, hero, stats, cards. */
export function HomeSkeleton() {
  return (
    <Shell wide>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Sk className="size-9 rounded-[11px]" /><span className="space-y-1.5"><Sk className="h-4 w-32" /><Sk className="h-3 w-20" /></span></div>
        <Sk className="h-11 w-24 rounded-pill" />
      </div>
      <Sk className="mt-4 h-[150px] rounded-banner lg:h-[248px]" />
      <StatsSkeleton className="mt-3" />
      <Sk className="mt-3 h-[68px] rounded-card" />
      <Sk className="mt-5 h-5 w-40" />
      <Sk className="mt-2 h-36 rounded-card" />
    </Shell>
  );
}

/** Forms and detail pages: order, booking, price list, new order. */
export function FormSkeleton() {
  return (
    <Shell>
      <Title />
      <Sk className="mt-4 h-28 rounded-card" />
      <div className="mt-4 space-y-3 rounded-card bg-surface p-4 shadow-card">{Array.from({ length: 4 }, (_, i) => <Sk key={i} className="h-11 w-full" />)}</div>
      <Sk className="mt-4 h-14 rounded-pill" />
    </Shell>
  );
}

/** Customer ticket / booking page. */
export function TicketSkeleton() {
  return (
    <Shell className="max-w-[440px] lg:max-w-[440px]">
      <div className="flex items-center gap-3"><Sk className="size-12 rounded-full" /><span className="space-y-1.5"><Sk className="h-5 w-40" /><Sk className="h-3 w-24" /></span></div>
      <Sk className="mt-5 h-4 w-28" />
      <Sk className="mt-2 h-36 rounded-card" />
      <Sk className="mt-3 h-24 rounded-card" />
      <Sk className="mt-4 h-12 rounded-pill" />
    </Shell>
  );
}
