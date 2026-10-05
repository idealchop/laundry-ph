/**
 * End-to-end smoke test of the Firestore data layer + firestore.rules against the local
 * emulators (demo project, nothing touches mylaundryph). Run from the repo root:
 *   pnpm test:emulator
 * Uses the real src/data + src/lib code, bundled with esbuild.
 */
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getDb, getFirebaseAuth } from "@/lib/firebase/client";
import { createFirebaseDataSource, firebaseTicketSource } from "@/data/firebase-source";
import { createShop, getJoinableDemoShop, joinDemoShop, resolveMembership } from "@/data/membership";
import { catalog } from "@/data/fixtures";
import type { Order } from "@/data/types";

const PROJECT = "demo-mylaundryph";
const DB = "laundrydb-dev";
const BASE = `http://127.0.0.1:8180/v1/projects/${PROJECT}/databases/${DB}/documents`;
let failures = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra !== undefined ? `  ${JSON.stringify(extra)}` : ""}`);
  if (!cond) failures++;
};
async function denied(name: string, fn: () => Promise<unknown>) {
  try { await fn(); ok(name + " (expected denied)", false); }
  catch (e) { ok(name + " denied", String((e as { code?: string }).code ?? e).includes("permission")); }
}
function enc(v: unknown): unknown {
  if (v === null) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  const fields: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as object)) fields[k] = enc(x);
  return { mapValue: { fields } };
}
async function adminSet(path: string, data: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(data)) fields[k] = enc(x);
  const r = await fetch(`${BASE}/${path}`, { method: "PATCH", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" }, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`seed ${path}: ${r.status} ${await r.text()}`);
}

async function main() {
  await adminSet("shops/sample-laundry", { id: "sample-laundry", name: "Sample Laundry", area: "Kapitolyo, Pasig", ownerName: "Liza", ownerAvatar: "rose", tier: "paid", sample: true, dailyTargetCentavos: 1000000, planSource: "demo", address: { line1: "12 Mabini St.", city: "Pasig" }, location: { lat: 14.5704, lng: 121.0573, formattedAddress: "12 Mabini St., Kapitolyo, Pasig" } });
  await adminSet("shops/sample-laundry/meta/catalog", catalog as unknown as Record<string, unknown>);
  await adminSet("shops/sample-laundry/meta/counters", { nextTicketNo: 423, queueDate: "", queueNo: 0 });

  const auth = getFirebaseAuth();
  const db = getDb();
  // Unauthenticated
  await denied("unauth read orders", () => getDocs(collection(db, "shops", "sample-laundry", "orders")));
  await denied("unauth get sample shop", () => getDoc(doc(db, "shops", "sample-laundry")));

  const a = (await createUserWithEmailAndPassword(auth, `a${Date.now()}@test.dev`, "secret123")).user;
  ok("A has no membership yet", (await resolveMembership(a.uid)) === null);
  await denied("A reads orders before joining", () => getDocs(collection(db, "shops", "sample-laundry", "orders")));
  const demo = await getJoinableDemoShop();
  ok("demo shop joinable", demo?.id === "sample-laundry");
  await denied("A self-joins demo as owner", () => setDoc(doc(db, "shops", "sample-laundry", "members", a.uid), { uid: a.uid, shopId: "sample-laundry", role: "owner", status: "active", createdAt: serverTimestamp() }));
  await joinDemoShop(a, "sample-laundry");
  const m = await resolveMembership(a.uid);
  ok("A is staff of demo", m?.role === "staff" && m.shopId === "sample-laundry");

  const src = createFirebaseDataSource("sample-laundry");
  const order = await src.createWalkInOrder({ customer: { name: "Joy Pascual", phone: "09175550142" }, serviceId: "wdf", quantity: 6.5, detergentId: "hypo", addOnIds: ["softener", "stain"], returnSlotId: "tomorrow" });
  ok("order ref from counter", order.ref === "LDY-0423", order.ref);
  ok("order total centavos (6.5*3500+2500+2000+4000=31250 → 31300)", order.totalCentavos === 31300, order.totalCentavos);
  ok("ticket id format", /^LDY-0423-[A-Z0-9]{8}$/.test(order.ticketId), order.ticketId);
  const saved = (await getDoc(doc(db, "shops", "sample-laundry", "orders", order.id))).data();
  ok("order persisted with status received", saved?.status === "received" && saved?.totalCentavos === 31300);
  ok("new customer created & linked", Boolean(order.customerId));
  const cust = (await getDoc(doc(db, "shops", "sample-laundry", "customers", order.customerId!))).data();
  ok("customer visits=1 spent=31300", cust?.visits === 1 && cust?.spentCentavos === 31300, cust);

  // Public ticket readable without auth via REST, no list
  const pub = await fetch(`${BASE}/public_tickets/${order.ticketId}`);
  ok("public ticket GET without auth", pub.status === 200);
  const pubJson = await pub.json() as { fields: Record<string, { stringValue?: string }> };
  ok("public ticket masks name", pubJson.fields.maskedName?.stringValue === "Joy P.", pubJson.fields.maskedName);
  ok("public ticket has no phone", !JSON.stringify(pubJson).includes("0917"));
  const list = await fetch(`${BASE}/public_tickets`);
  ok("public ticket LIST denied", list.status === 403, list.status);
  const orderRest = await fetch(`${BASE}/shops/sample-laundry/orders/${order.id}`);
  ok("order GET without auth denied", orderRest.status === 403, orderRest.status);

  // Status flow
  for (const s of ["washing", "drying", "folding", "ready", "claimed"] as const) await src.setOrderStatus(order.id, s);
  let o = (await getDoc(doc(db, "shops", "sample-laundry", "orders", order.id))).data();
  ok("order claimed with stage times", o?.status === "claimed" && Object.keys(o?.stageTimes ?? {}).length === 6, Object.keys(o?.stageTimes ?? {}));
  await src.setOrderStatus(order.id, "ready");
  o = (await getDoc(doc(db, "shops", "sample-laundry", "orders", order.id))).data();
  ok("undo claimed → ready", o?.status === "ready" && !o?.stageTimes?.claimed);
  try { await src.setOrderStatus(order.id, "washing"); ok("invalid jump rejected", false); } catch { ok("invalid jump rejected", true); }
  await src.markOrderPaid(order.id, "cash");
  const t = await firebaseTicketSource.getTicket(order.ticketId);
  ok("ticket ready + paid", t?.stage === "ready" && t?.paid === true && t?.amountDueCentavos === 0, t);
  await denied("A edits order total", () => updateDoc(doc(db, "shops", "sample-laundry", "orders", order.id), { totalCentavos: 1 }));
  await denied("A deletes nothing: lists public tickets", () => getDocs(collection(db, "public_tickets")));

  // Second order with existing customer id
  const o2: Order = await src.createWalkInOrder({ customer: { id: order.customerId, name: "Joy Pascual" }, serviceId: "press", quantity: 10, detergentId: "shop", addOnIds: [], returnSlotId: "today" });
  ok("second ref + queue", o2.ref === "LDY-0424" && o2.queueNo === 2, [o2.ref, o2.queueNo]);
  const cust2 = (await getDoc(doc(db, "shops", "sample-laundry", "customers", order.customerId!))).data();
  ok("customer visits incremented", cust2?.visits === 2 && cust2?.spentCentavos === 31300 + 15000, cust2);
  const c = await src.createCustomer({ name: "Ben Torres", phone: "09170000000" });
  ok("createCustomer", Boolean(c.id));
  const found = await src.findOrder(`https://x/t/${o2.ticketId}`);
  ok("findOrder by ticket URL", found?.id === o2.id);
  const found2 = await src.findOrder("424");
  ok("findOrder by short ref", found2?.id === o2.id);
  await new Promise<void>((res) => { const un = src.watchOrders({ openOnly: true }, (rows) => { ok("watch open orders", rows.some((r) => r.id === o2.id)); un(); res(); }, (e) => { ok("watch open orders", false, e.message); res(); }); });
  await new Promise<void>((res) => { const un = src.watchOrders({ sinceMs: Date.now() - 86400000 }, (rows) => { ok("watch recent orders", rows.length >= 2, rows.length); un(); res(); }, (e) => { ok("watch recent", false, e.message); res(); }); });
  await denied("staff edits catalog", () => setDoc(doc(db, "shops", "sample-laundry", "meta", "catalog"), { x: 1 }));
  await denied("staff edits demo shop", () => updateDoc(doc(db, "shops", "sample-laundry"), { name: "Hacked" }));
  await signOut(auth);

  // User B creates own shop
  const b = (await createUserWithEmailAndPassword(auth, `b${Date.now()}@test.dev`, "secret123")).user;
  await denied("B reads A's shop orders", () => getDocs(collection(db, "shops", "sample-laundry", "orders")));
  await denied("B reads A's customers", () => getDocs(collection(db, "shops", "sample-laundry", "customers")));
  await denied("B updates A's public ticket", () => updateDoc(doc(db, "public_tickets", order.ticketId), { stage: "received" }));
  const shopId = await createShop(b, { name: "Bea's Wash", area: "Cubao", ownerName: "Bea" });
  const mb = await resolveMembership(b.uid);
  ok("B owns new shop", mb?.role === "owner" && mb.shopId === shopId, shopId);
  const srcB = createFirebaseDataSource(shopId);
  const ob = await srcB.createWalkInOrder({ customer: { name: "" }, serviceId: "wd", quantity: 3, detergentId: "shop", addOnIds: [], returnSlotId: "today" });
  ok("B first order LDY-0001 min-kg billed", ob.ref === "LDY-0001" && ob.billedQuantity === 5 && ob.totalCentavos === 15000 && !ob.customerId, [ob.ref, ob.totalCentavos]);
  await setDoc(doc(db, "shops", shopId, "meta", "catalog"), { ...catalog, minKg: 4 }).then(() => ok("owner edits catalog", true), () => ok("owner edits catalog", false));
  await denied("B creates shop owned by someone else", () => setDoc(doc(db, "shops", "evil-shop"), { id: "evil-shop", name: "Evil", ownerUid: "someone", sample: false, tier: "paid", createdAt: serverTimestamp() }));
  await denied("B creates a sample shop", () => setDoc(doc(db, "shops", "evil2"), { id: "evil2", name: "Evil", ownerUid: b.uid, sample: true, tier: "paid", createdAt: serverTimestamp() }));

  console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error("CRASH", e); process.exit(1); });
