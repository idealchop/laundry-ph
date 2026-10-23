/**
 * Staff performance (Barbers.ph "Performance" parity, no commission): who recorded each order.
 * Owner sign-ins count as "You"; a location's staff link counts as that location's staff; online bookings as "Online".
 */
import type { Order } from "@/data/types";
import { isCounted } from "./orders";

export interface StaffRow { key: string; name: string; orders: number; salesCentavos: number; collectedCentavos: number; kg: number }

export function staffKey(o: Pick<Order, "createdBy" | "source">): string {
  if (o.createdBy?.startsWith("staff:") || o.createdBy?.startsWith("staff-link:")) return o.createdBy;
  if (o.source === "river-mobile" && !o.createdBy) return "online";
  return "owner";
}

export function staffName(key: string, branchName: (id: string) => string): string {
  if (key === "owner") return "You (owner)";
  if (key === "online") return "Online bookings";
  const id = key.slice("staff-link:".length);
  return `${branchName(id) || "Location"} counter link`;
}

export function staffStats(orders: Order[], branchName: (id: string) => string): StaffRow[] {
  const m = new Map<string, StaffRow>();
  for (const o of orders.filter(isCounted)) {
    const k = staffKey(o);
    const nm = k.startsWith("staff:") ? `${o.staffName || "Staff"}${o.branchId && branchName(o.branchId) ? ` · ${branchName(o.branchId)}` : ""}` : staffName(k, branchName);
    const x = m.get(k) ?? { key: k, name: nm, orders: 0, salesCentavos: 0, collectedCentavos: 0, kg: 0 };
    x.orders += 1; x.salesCentavos += o.totalCentavos; x.collectedCentavos += o.paidCentavos; x.kg = Math.round((x.kg + o.kg) * 10) / 10;
    m.set(k, x);
  }
  return [...m.values()].sort((a, b) => b.salesCentavos - a.salesCentavos);
}
