/**
 * Firestore-backed LaundryDataSource for project mylaundryph.
 * Uses the named database from NEXT_PUBLIC_FIRESTORE_DATABASE (laundrydb | laundrydb-dev).
 *
 * Document layout (mirrors fixtures / planned multi-tenant model):
 *   shops/{shopId}                         Shop (+ sample: true for demo)
 *   shops/{shopId}/meta/today              DaySummary
 *   shops/{shopId}/meta/schedule           Schedule
 *   shops/{shopId}/meta/catalog            Catalog
 *   shops/{shopId}/meta/growth             { tip, stats, weekSales }
 *   shops/{shopId}/machines/{id}
 *   shops/{shopId}/orders/{ref}
 *   shops/{shopId}/customers/{id}
 *   shops/{shopId}/pickups/{id}
 *   public_tickets/{ticketId}
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { connection } from "next/server";
import { getDb } from "@/lib/firebase/client";
import { shopId as defaultShopId } from "@/lib/firebase/config";
import type { LaundryDataSource } from "./index";
import type {
  Catalog,
  Customer,
  DaySummary,
  GrowthStat,
  GrowthTip,
  Machine,
  PickupRequest,
  PublicTicket,
  QueuedOrder,
  SalesPoint,
  Schedule,
  Shop,
  VerifiedBooking,
} from "./types";

function shopRef(shopId: string) {
  return doc(getDb(), "shops", shopId);
}

async function requireShop(shopId: string): Promise<Shop & { sample?: boolean }> {
  const snap = await getDoc(shopRef(shopId));
  if (!snap.exists()) throw new Error(`Shop not found: ${shopId}`);
  return snap.data() as Shop & { sample?: boolean };
}

async function meta<T>(shopId: string, id: string): Promise<T | null> {
  const snap = await getDoc(doc(getDb(), "shops", shopId, "meta", id));
  return snap.exists() ? (snap.data() as T) : null;
}

/** Opt the request into dynamic rendering so App Hosting does not SSG against Firestore at build. */
async function dynamicRequest(): Promise<void> {
  await connection();
}

export function createFirebaseDataSource(opts?: { shopId?: string }): LaundryDataSource {
  const shopId = opts?.shopId ?? defaultShopId;

  return {
    // Seeded demo shops carry sample: true; real shops will flip isSample off later.
    get isSample() {
      return true;
    },

    async getShop() {
      await dynamicRequest();
      const data = await requireShop(shopId);
      const shop = { ...data } as Shop & { sample?: boolean };
      delete shop.sample;
      return shop as Shop;
    },

    async getTodaySummary() {
      await dynamicRequest();
      const m = await meta<DaySummary>(shopId, "today");
      if (!m) throw new Error(`Missing shops/${shopId}/meta/today`);
      return m;
    },

    async getSchedule() {
      await dynamicRequest();
      const m = await meta<Schedule>(shopId, "schedule");
      if (!m) throw new Error(`Missing shops/${shopId}/meta/schedule`);
      return m;
    },

    async getMachines() {
      await dynamicRequest();
      const snap = await getDocs(collection(getDb(), "shops", shopId, "machines"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Machine);
    },

    async getOrderQueue() {
      await dynamicRequest();
      const snap = await getDocs(collection(getDb(), "shops", shopId, "orders"));
      const orders = snap.docs.map((d) => ({ ref: d.id, ...d.data() }) as QueuedOrder);
      return orders.sort((a, b) => b.ref.localeCompare(a.ref));
    },

    async getPickupRequests() {
      await dynamicRequest();
      const snap = await getDocs(collection(getDb(), "shops", shopId, "pickups"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PickupRequest);
    },

    async getVerifiedBooking(ref?: string) {
      await dynamicRequest();
      const m = await meta<VerifiedBooking>(shopId, "verifiedBooking");
      if (!m) return null;
      if (ref && m.ref !== ref) return null;
      return m;
    },

    async getCatalog() {
      await dynamicRequest();
      const m = await meta<Catalog>(shopId, "catalog");
      if (!m) throw new Error(`Missing shops/${shopId}/meta/catalog`);
      return m;
    },

    async getTicket(ticketId: string) {
      await dynamicRequest();
      const snap = await getDoc(doc(getDb(), "public_tickets", ticketId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as PublicTicket;
    },

    async getWeekSales() {
      await dynamicRequest();
      const m = await meta<{ weekSales: SalesPoint[] }>(shopId, "growth");
      return m?.weekSales ?? [];
    },

    async getGrowthStats() {
      await dynamicRequest();
      const m = await meta<{ stats: GrowthStat[] }>(shopId, "growth");
      return m?.stats ?? [];
    },

    async getGrowthTip() {
      await dynamicRequest();
      const m = await meta<{ tip: GrowthTip }>(shopId, "growth");
      if (!m?.tip) throw new Error(`Missing growth tip for ${shopId}`);
      return m.tip;
    },

    async getCustomers() {
      await dynamicRequest();
      const snap = await getDocs(collection(getDb(), "shops", shopId, "customers"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Customer);
    },

    async createWalkInOrder(input: {
      ref: string;
      customer: QueuedOrder["customer"];
      kg: number;
      detail: string;
      status?: QueuedOrder["status"];
      ticket: PublicTicket;
    }) {
      await dynamicRequest();
      const order: QueuedOrder & { shopId: string } = {
        ref: input.ref,
        customer: input.customer,
        kg: input.kg,
        detail: input.detail,
        status: input.status ?? "Waiting",
        shopId,
      };
      await setDoc(doc(getDb(), "shops", shopId, "orders", input.ref), order);
      const ticketBody: DocumentData = { ...input.ticket };
      delete ticketBody.id;
      await setDoc(doc(getDb(), "public_tickets", input.ticket.id), ticketBody);
      return order;
    },
  };
}
