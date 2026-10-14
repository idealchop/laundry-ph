import { Type, type FunctionDeclaration } from "@google/genai";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db, DAY, monthId } from "./db.js";
import { groupBy, inactiveCustomers, loadBookings, loadOrders, summarize } from "./data.js";

export interface ToolCtx { shopId: string; uid: string; paid: boolean }

const period = {
  days: { type: Type.INTEGER, description: "Length of the period in days (1-90). Default 7." },
  offsetDays: { type: Type.INTEGER, description: "How many days before today the period ends. 0 = up to now; 7 with days=7 = the week before last week." },
};
const p = (props: Record<string, unknown> = {}, required: string[] = []) => ({ type: Type.OBJECT, properties: { ...period, ...props }, required });

export const TOOL_DECLS: FunctionDeclaration[] = [
  { name: "getSales", description: "Sales, collected, unpaid, order count, average ticket for a period.", parameters: p() },
  { name: "getOrders", description: "Order counts by source (walk-in vs River Mobile), busiest days and hours.", parameters: p() },
  { name: "getBookings", description: "River Mobile bookings: total, pickups, drop-offs, declined, cancelled.", parameters: p() },
  { name: "topServices", description: "Top services by sales with orders and kg.", parameters: p() },
  { name: "kgAndTurnaround", description: "Kg processed and average turnaround hours (received to ready).", parameters: p() },
  { name: "pickups", description: "Pickup vs drop-off bookings for a period.", parameters: p() },
  { name: "staffPerformance", description: "Orders, sales and kg per staff member (anonymous staff ids).", parameters: p() },
  { name: "branchComparison", description: "Per-branch and combined totals across the owner's shops. Pro only.", parameters: p() },
  { name: "inactiveCustomers", description: "Customers who have not come back for N days. Contacts only when the owner explicitly asks for names/numbers.", parameters: { type: Type.OBJECT, properties: { days: { type: Type.INTEGER, description: "Inactive for at least N days. Default 30." }, includeContacts: { type: Type.BOOLEAN, description: "Include name and phone. Only true if the owner explicitly asked." } } } },
  { name: "goalProgress", description: "The owner's saved monthly goal and this month's progress so far.", parameters: { type: Type.OBJECT, properties: {} } },
  { name: "setGoal", description: "Save or replace the owner's monthly sales goal (pesos). Pro only.", parameters: { type: Type.OBJECT, properties: { monthlyTargetPhp: { type: Type.NUMBER }, note: { type: Type.STRING } }, required: ["monthlyTargetPhp"] } },
];

const clamp = (n: unknown, lo: number, hi: number, d: number) => { const v = Math.round(Number(n)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };

async function window(shopId: string, args: Record<string, unknown>) {
  const days = clamp(args.days, 1, 90, 7), off = clamp(args.offsetDays, 0, 365, 0);
  const to = Date.now() - off * DAY, from = to - days * DAY;
  const [o, b] = await Promise.all([loadOrders(shopId, from - 120 * DAY), loadBookings(shopId, from)]);
  return { days, from: new Date(from).toISOString().slice(0, 10), to: new Date(to).toISOString().slice(0, 10), s: summarize(o, b.filter((x) => x.createdAt < to), from, to), orders: o.filter((x) => x.createdAt >= from && x.createdAt < to && x.status !== "cancelled") };
}

export async function goalProgress(shopId: string) {
  const g = (await db().doc(`shops/${shopId}/companion/goal`).get()).data();
  const now = new Date(Date.now() + 8 * 3600_000);
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 8 * 3600_000;
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const s = summarize(await loadOrders(shopId, start), [], start, Date.now());
  const target = Number(g?.monthlyTargetPhp ?? 0);
  return { month: monthId(), goalPhp: target || null, note: g?.note ?? null, salesSoFarPhp: s.salesPhp, percent: target ? Math.round((s.salesPhp / target) * 100) : null, dayOfMonth: now.getUTCDate(), daysInMonth, neededPerDayPhp: target ? Math.max(0, Math.round((target - s.salesPhp) / Math.max(1, daysInMonth - now.getUTCDate() + 1))) : null };
}

export async function runTool(name: string, args: Record<string, unknown>, ctx: ToolCtx): Promise<unknown> {
  const { shopId } = ctx;
  switch (name) {
    case "getSales": { const w = await window(shopId, args); const { salesPhp, collectedPhp, unpaidPhp, orders, avgTicketPhp } = w.s; return { from: w.from, to: w.to, salesPhp, collectedPhp, unpaidPhp, orders, avgTicketPhp }; }
    case "getOrders": { const w = await window(shopId, args); const { orders, walkIns, riverMobileOrders, busiestDays, busiestHours } = w.s; return { from: w.from, to: w.to, orders, walkIns, riverMobileOrders, busiestDays, busiestHours, customers: w.s.customers }; }
    case "getBookings": case "pickups": { const w = await window(shopId, args); const { bookings, pickups, dropoffs, declinedBookings, cancelledBookings } = w.s; return { from: w.from, to: w.to, bookings, pickups, dropoffs, declinedBookings, cancelledBookings }; }
    case "topServices": { const w = await window(shopId, args); return { from: w.from, to: w.to, topServices: w.s.topServices }; }
    case "kgAndTurnaround": { const w = await window(shopId, args); return { from: w.from, to: w.to, kgProcessed: w.s.kgProcessed, avgTurnaroundHours: w.s.avgTurnaroundHours, orders: w.s.orders }; }
    case "staffPerformance": { const w = await window(shopId, args); const g = groupBy(w.orders, (o) => o.createdBy ?? "unknown"); return { from: w.from, to: w.to, staff: Object.entries(g).map(([id, v], i) => ({ staff: `Staff ${i + 1}${id === ctx.uid ? " (you)" : ""}`, ...v })) }; }
    case "branchComparison": {
      if (!ctx.paid) return { error: "Branch comparison is a Pro feature." };
      const owned = await db().collection("shops").where("ownerUid", "==", ctx.uid).limit(10).get();
      const ids = [...new Set([shopId, ...owned.docs.map((d) => d.id)])];
      const per = await Promise.all(ids.map(async (id) => { const w = await window(id, args); const name = (await db().doc(`shops/${id}`).get()).get("name") ?? id; return { shop: name, salesPhp: w.s.salesPhp, orders: w.s.orders, kg: w.s.kgProcessed, branches: groupBy(w.orders, (o) => o.branchId ?? "main") }; }));
      return { shops: per, combined: { salesPhp: per.reduce((a, b) => a + b.salesPhp, 0), orders: per.reduce((a, b) => a + b.orders, 0), kg: per.reduce((a, b) => a + b.kg, 0) } };
    }
    case "inactiveCustomers": return inactiveCustomers(shopId, clamp(args.days, 7, 365, 30), args.includeContacts === true);
    case "goalProgress": return goalProgress(shopId);
    case "setGoal": {
      if (!ctx.paid) return { error: "Goals are a Pro feature. Upgrade to Pro · ₱499/mo to track a monthly goal." };
      const t = Number(args.monthlyTargetPhp);
      if (!Number.isFinite(t) || t <= 0 || t > 10_000_000) return { error: "Invalid target" };
      // The only write a tool may do: the goal doc under companion/.
      await db().doc(`shops/${shopId}/companion/goal`).set({ monthlyTargetPhp: Math.round(t), note: String(args.note ?? "").slice(0, 200), setAt: FieldValue.serverTimestamp(), setBy: ctx.uid });
      return { saved: true, ...(await goalProgress(shopId)) };
    }
    default: return { error: `Unknown tool ${name}` };
  }
}
export { Timestamp };
