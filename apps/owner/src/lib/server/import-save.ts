/**
 * AI import save: reviewed customers + past walk-ins → shops/{shopId}/customers and /orders.
 * Imported orders: source "import", already finished (claimed), dated on the record's day, no public
 * ticket, and never counted in usage/{day}.walkIns, so the Partner daily walk-in cap is untouched.
 */
import { FieldValue, Timestamp, type WriteBatch } from "firebase-admin/firestore";
import { adminDb } from "./admin";
import { avatarFor } from "@/lib/orders";
import { cleanCustomer, cleanWalkIn, IMPORT_MAX_RECORDS, normPhone, type ImportCustomer, type ImportSaveResult, type ImportWalkIn } from "@/lib/import/types";

const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);

type Svc = { id: string; name: string; unit?: string };
/** Best catalog match for a free-text service, else a generic "import" service. */
export function matchService(services: Svc[], text: string, unit: "kg" | "pc"): { id: string; name: string } {
  const w = new Set(words(text));
  let best: Svc | null = null; let score = 0;
  for (const s of services) {
    const sw = words(s.name);
    const hit = sw.filter((x) => w.has(x) || [...w].some((y) => y.length > 2 && x.startsWith(y))).length / Math.max(1, sw.length);
    const sc = hit + (s.unit === unit ? 0.05 : 0);
    if (sc > score) { score = sc; best = s; }
  }
  if (best && score >= 0.5) return { id: best.id, name: best.name };
  return { id: "import", name: text.trim() || "Laundry" };
}

export function parseSaveBody(b: unknown): { customers: ImportCustomer[]; walkIns: ImportWalkIn[] } {
  const o = (b ?? {}) as { customers?: unknown; walkIns?: unknown };
  const cs = Array.isArray(o.customers) ? o.customers : [];
  const ws = Array.isArray(o.walkIns) ? o.walkIns : [];
  if (cs.length + ws.length > IMPORT_MAX_RECORDS) throw new Error(`Up to ${IMPORT_MAX_RECORDS} records at a time.`);
  return {
    customers: cs.map((c, i) => cleanCustomer(c, `c${i}`)).filter((c) => c != null),
    walkIns: ws.map((w, i) => cleanWalkIn(w, `w${i}`)).filter((w) => w != null),
  };
}

export async function saveImport(shopId: string, uid: string, input: { customers: ImportCustomer[]; walkIns: ImportWalkIn[] }, branchId?: string): Promise<ImportSaveResult> {
  const db = adminDb();
  const shop = db.collection("shops").doc(shopId);
  const [shopSnap, catSnap, existing] = await Promise.all([shop.get(), shop.collection("meta").doc("catalog").get(), shop.collection("customers").select("nameLower", "name", "phone").limit(5000).get()]);
  const sample = shopSnap.get("sample") === true;
  const services: Svc[] = Array.isArray(catSnap.get("services")) ? catSnap.get("services") : [];
  const byName = new Map<string, string>(); const byPhone = new Map<string, string>();
  for (const d of existing.docs) {
    byName.set(key(String(d.get("nameLower") ?? d.get("name") ?? "")), d.id);
    const p = normPhone(d.get("phone")); if (p) byPhone.set(p, d.id);
  }

  const batches: WriteBatch[] = [db.batch()]; let ops = 0;
  const write = (fn: (b: WriteBatch) => void) => { if (ops >= 450) { batches.push(db.batch()); ops = 0; } fn(batches[batches.length - 1]!); ops++; };
  const stats = new Map<string, { visits: number; spent: number; last: number }>();
  const created = new Set<string>();
  let skipped = 0; let customers = 0;

  const ensureCustomer = (c: { name: string; phone?: string; address?: string; notes?: string }): string => {
    const phone = normPhone(c.phone);
    const hit = (phone && byPhone.get(phone)) || byName.get(key(c.name));
    if (hit) return hit;
    const ref = shop.collection("customers").doc();
    const notes = [c.notes, c.address ? `Address: ${c.address}` : ""].filter(Boolean).join(" · ").slice(0, 300);
    write((b) => b.set(ref, {
      name: c.name, nameLower: c.name.toLowerCase(), phone: phone || null, avatar: avatarFor(c.name), source: "Walk-in",
      visits: 0, spentCentavos: 0, tag: null, notes: notes || null, address: c.address || null, lastVisitAt: null,
      imported: true, importSource: "import", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), createdBy: uid, ...(sample ? { sample: true } : {}),
    }));
    byName.set(key(c.name), ref.id); if (phone) byPhone.set(phone, ref.id);
    created.add(ref.id); customers++;
    return ref.id;
  };

  for (const c of input.customers) {
    const before = customers; ensureCustomer(c); if (customers === before) skipped++;
  }

  let walkIns = 0; let n = 0;
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  for (const w of input.walkIns) {
    if (!(w.amount > 0) && !(w.quantity > 0)) { skipped++; continue; }
    const name = w.customer.trim() || "Walk-in customer";
    const customerId = w.customer.trim() ? ensureCustomer({ name }) : null;
    const at = w.date ? Date.parse(`${w.date}T12:00:00+08:00`) : Date.now();
    const when = Math.min(at, Date.now());
    const svc = matchService(services, w.service, w.unit);
    const total = Math.round(w.amount * 100);
    const qtyLabel = w.quantity > 0 ? `${w.quantity} ${w.unit}` : "";
    const ref = shop.collection("orders").doc();
    const ts = Timestamp.fromMillis(when);
    n++;
    write((b) => b.set(ref, {
      shopId, ref: `IMP-${stamp}-${String(n).padStart(3, "0")}`, queueNo: 0, ticketId: "", source: "import", status: "claimed",
      customer: { name, avatar: avatarFor(name) }, customerId,
      serviceId: svc.id, serviceName: svc.name, unit: w.unit, quantity: w.quantity, billedQuantity: w.quantity, kg: w.unit === "kg" ? w.quantity : 0,
      detergent: null, addOns: [], clothesType: null,
      lines: [{ label: [qtyLabel, svc.name].filter(Boolean).join(" · "), amountCentavos: total }],
      subtotalCentavos: total, totalCentavos: total,
      paymentStatus: w.paid ? "paid" : "unpaid", paymentMethod: w.paid ? "cash" : null, paidCentavos: w.paid ? total : 0,
      readyBy: "", fulfillment: "pickup", detail: [qtyLabel, svc.name].filter(Boolean).join(" · "),
      stageTimes: { received: ts, claimed: ts }, createdAt: ts, updatedAt: FieldValue.serverTimestamp(), importedAt: FieldValue.serverTimestamp(),
      createdBy: uid, imported: true, ...(branchId ? { branchId } : {}), ...(sample ? { sample: true } : {}),
    }));
    walkIns++;
    if (customerId) {
      const s = stats.get(customerId) ?? { visits: 0, spent: 0, last: 0 };
      s.visits++; s.spent += total; s.last = Math.max(s.last, when); stats.set(customerId, s);
    }
  }

  for (const [id, s] of stats) {
    const ref = shop.collection("customers").doc(id);
    write((b) => b.set(ref, { visits: FieldValue.increment(s.visits), spentCentavos: FieldValue.increment(s.spent), ...(created.has(id) ? { lastVisitAt: Timestamp.fromMillis(s.last) } : {}), updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
  }
  write((b) => b.set(shop.collection("audit_logs").doc(), { actor: uid, action: "import.save", resource: "orders", resourceId: stamp, customers, walkIns, at: FieldValue.serverTimestamp() }));
  for (const b of batches) await b.commit();
  return { customers, walkIns, skipped };
}
