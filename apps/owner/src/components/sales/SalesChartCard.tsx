"use client";

import { Card, cn } from "@river-apps/ui";
import { RiverIcon } from "@/components/common/RiverIcon";
import { money } from "@/lib/format";
import type { SalesRow } from "@/lib/sales";

/** Barbers.ph "Sales by hour / by day" card: busiest bar black, a quiet placeholder chart when there are no sales. */
export function SalesChartCard({ series, kind, className }: { series: SalesRow[]; kind: "hour" | "day"; className?: string }) {
  const peak = series.reduce((best, row) => (row.salesCentavos > best.sales ? { sales: row.salesCentavos, label: row.label } : best), { sales: 0, label: "" });
  const quiet = series.filter((row) => row.salesCentavos === 0).length;
  const rows = kind === "hour" && peak.sales > 0 ? trimHours(series) : series;
  return (
    <Card padding="none" className={cn("px-4 py-4", className)}>
      <h2 className="text-[16px] font-bold">{kind === "hour" ? "Sales by hour" : "Sales by day"}</h2>
      <p className="mt-0.5 text-[12.5px] font-semibold text-muted">
        {peak.sales > 0 ? `Busiest ${kind === "hour" ? "at" : "on"} ${peak.label} · ${money(peak.sales)}` : kind === "hour" ? "Today, by the hour" : "By day"}
      </p>
      {peak.sales > 0 ? <ColumnChart rows={rows} /> : (
        <div className="relative mt-3 h-[132px] overflow-hidden rounded-[16px] border border-line" role="img" aria-label={kind === "hour" ? "No sales yet today" : "No sales in this range yet"}>
          <div aria-hidden className="absolute inset-x-4 bottom-3 flex h-[96px] items-end gap-1.5 opacity-60">
            {[28, 46, 34, 62, 50, 74, 40, 58, 36, 52, 30, 44].map((h, i) => <span key={i} className="flex-1 rounded-t-[5px] bg-grey-100" style={{ height: `${h}%` }} />)}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-surface/90 via-surface/70 to-surface/30 text-center">
            <RiverIcon name="chart" size={44} />
            <b className="mt-1.5 text-[14.5px]">{kind === "hour" ? "No sales yet today" : "No sales in this range"}</b>
          </div>
        </div>
      )}
      {kind === "day" && quiet > 0 && peak.sales > 0 ? <p className="mt-3 text-[12.5px] font-semibold text-muted">{quiet} {quiet === 1 ? "day" : "days"} with no sales</p> : null}
    </Card>
  );
}

/** Hours from the first to the last sale (at least 7 AM–6 PM), so one sale is one thin bar. */
function trimHours(series: SalesRow[]): SalesRow[] {
  const on = series.map((r, i) => (r.salesCentavos > 0 ? i : -1)).filter((i) => i >= 0);
  const lo = Math.min(0, on[0] ?? 0), hi = Math.max(Math.min(series.length - 1, 11), on[on.length - 1] ?? 0);
  return series.slice(lo, hi + 1);
}

/** Column chart for hours or days. The busiest bar is black. */
export function ColumnChart({ rows }: { rows: SalesRow[] }) {
  const data = rows.length > 0 ? rows : [];
  const max = Math.max(1, ...data.map((row) => row.salesCentavos));
  const highlight = data.reduce((best, row, i) => (row.salesCentavos > (data[best]?.salesCentavos ?? 0) ? i : best), 0);
  const peak = (data[highlight]?.salesCentavos ?? 0) > 0 ? highlight : -1;
  const dense = data.length > 8;
  const labeled = new Set<number>();
  if (peak >= 0) labeled.add(peak);
  data.forEach((row, i) => {
    const edge = i === 0 || i === data.length - 1;
    if (dense && !edge && row.salesCentavos <= 0) return;
    if (dense && [...labeled].some((kept) => kept !== i && Math.abs(kept - i) < 2)) return;
    labeled.add(i);
  });
  return (
    <div
      className="mt-4 flex h-[156px] items-end gap-2"
      role="img"
      aria-label={data.map((row) => `${row.label}: ${money(row.salesCentavos)}`).join(", ")}
    >
      {data.map((row, i) => {
        const on = i === peak;
        const height = row.salesCentavos === 0 ? 4 : Math.max(8, Math.round((row.salesCentavos / max) * 124));
        return (
          <div key={`${row.label}-${i}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${row.label}: ${money(row.salesCentavos)}`}>
            <div className={cn("w-full max-w-10 rounded-t-[8px]", on ? "bg-ink" : row.salesCentavos > 0 ? "bg-grey-300" : "bg-grey-100")} style={{ height }} />
            <span className={cn("mt-1.5 h-4 w-full truncate text-center text-[11px] font-bold leading-4", on ? "text-ink" : "text-subtle", !labeled.has(i) && "invisible")}>
              {tickLabel(row.label, dense)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function tickLabel(label: string, dense: boolean): string {
  if (!dense) return label;
  const hour = /^(\d+)\s*(AM|PM)$/i.exec(label);
  if (hour) return `${hour[1]}${hour[2]!.toLowerCase().startsWith("a") ? "a" : "p"}`;
  const day = /(\d+)\s*$/.exec(label);
  return day?.[1] ?? label.slice(0, 1);
}
