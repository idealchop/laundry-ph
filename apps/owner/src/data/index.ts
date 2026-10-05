/**
 * Data access for the Laundry.ph owner UI.
 *
 * Components only talk to `data` through the `LaundryDataSource` interface.
 * Default: in-memory fixtures. Set NEXT_PUBLIC_DATA_SOURCE=firebase to use the
 * named Firestore database in project mylaundryph (laundrydb / laundrydb-dev).
 */
import * as fx from "./fixtures";
import { createFirebaseDataSource } from "./firebase-source";
import type {
  Catalog, Customer, DaySummary, GrowthStat, GrowthTip, Machine, PickupRequest, PublicTicket, QueuedOrder, SalesPoint, Schedule, Shop,
  VerifiedBooking,
} from "./types";

export * from "./types";

export interface LaundryDataSource {
  /** True while the app shows seeded sample / demo data (drives <SampleDataTag />). */
  readonly isSample: boolean;
  getShop(): Promise<Shop>;
  getTodaySummary(): Promise<DaySummary>;
  getSchedule(): Promise<Schedule>;
  getMachines(): Promise<Machine[]>;
  getOrderQueue(): Promise<QueuedOrder[]>;
  getPickupRequests(): Promise<PickupRequest[]>;
  /** The booking a River Mobile QR scan resolved to (Partner API v1 later). */
  getVerifiedBooking(ref?: string): Promise<VerifiedBooking | null>;
  getCatalog(): Promise<Catalog>;
  /** Public-safe ticket projection for /t/[ticketId]. Null when unknown or expired. */
  getTicket(ticketId: string): Promise<PublicTicket | null>;
  getWeekSales(): Promise<SalesPoint[]>;
  getGrowthStats(): Promise<GrowthStat[]>;
  getGrowthTip(): Promise<GrowthTip>;
  getCustomers(): Promise<Customer[]>;
  /** Optional: persist a walk-in order + public ticket (Firebase source). */
  createWalkInOrder?(input: {
    ref: string;
    customer: QueuedOrder["customer"];
    kg: number;
    detail: string;
    status?: QueuedOrder["status"];
    ticket: PublicTicket;
  }): Promise<QueuedOrder>;
}

export const sampleDataSource: LaundryDataSource = {
  isSample: true,
  getShop: async () => fx.shop,
  getTodaySummary: async () => fx.today,
  getSchedule: async () => fx.schedule,
  getMachines: async () => fx.machines,
  getOrderQueue: async () => fx.orderQueue,
  getPickupRequests: async () => fx.pickupRequests,
  getVerifiedBooking: async (ref) => (!ref || ref === fx.verifiedBooking.ref ? fx.verifiedBooking : null),
  getCatalog: async () => fx.catalog,
  getTicket: async (id) => fx.tickets.find((t) => t.id.toLowerCase() === id.toLowerCase()) ?? null,
  getWeekSales: async () => fx.weekSales,
  getGrowthStats: async () => fx.growthStats,
  getGrowthTip: async () => fx.growthTip,
  getCustomers: async () => fx.customers,
};

/** Prefer Firebase; if a read fails (e.g. empty laundrydb before real shops), use fixtures. */
function withFixturesFallback(primary: LaundryDataSource, fallback: LaundryDataSource): LaundryDataSource {
  const wrap = <T,>(fn: () => Promise<T>, fb: () => Promise<T>) => async () => {
    try {
      return await fn();
    } catch {
      return fb();
    }
  };
  return {
    get isSample() {
      return primary.isSample;
    },
    getShop: wrap(() => primary.getShop(), () => fallback.getShop()),
    getTodaySummary: wrap(() => primary.getTodaySummary(), () => fallback.getTodaySummary()),
    getSchedule: wrap(() => primary.getSchedule(), () => fallback.getSchedule()),
    getMachines: wrap(() => primary.getMachines(), () => fallback.getMachines()),
    getOrderQueue: wrap(() => primary.getOrderQueue(), () => fallback.getOrderQueue()),
    getPickupRequests: wrap(() => primary.getPickupRequests(), () => fallback.getPickupRequests()),
    getVerifiedBooking: async (ref) => {
      try {
        return await primary.getVerifiedBooking(ref);
      } catch {
        return fallback.getVerifiedBooking(ref);
      }
    },
    getCatalog: wrap(() => primary.getCatalog(), () => fallback.getCatalog()),
    getTicket: async (id) => {
      try {
        const t = await primary.getTicket(id);
        if (t) return t;
      } catch {
        /* fall through */
      }
      return fallback.getTicket(id);
    },
    getWeekSales: wrap(() => primary.getWeekSales(), () => fallback.getWeekSales()),
    getGrowthStats: wrap(() => primary.getGrowthStats(), () => fallback.getGrowthStats()),
    getGrowthTip: wrap(() => primary.getGrowthTip(), () => fallback.getGrowthTip()),
    getCustomers: wrap(() => primary.getCustomers(), () => fallback.getCustomers()),
    createWalkInOrder: primary.createWalkInOrder?.bind(primary),
  };
}

function resolveDataSource(): LaundryDataSource {
  const mode = (process.env.NEXT_PUBLIC_DATA_SOURCE ?? "fixtures").toLowerCase();
  if (mode === "firebase") {
    return withFixturesFallback(createFirebaseDataSource(), sampleDataSource);
  }
  return sampleDataSource;
}

/** The active data source (fixtures by default; firebase when env says so). */
export const data: LaundryDataSource = resolveDataSource();

/** Ticket ids that exist in the sample fixtures (used to pre-render /t/[ticketId]). */
export const SAMPLE_TICKET_IDS = fx.tickets.map((t) => t.id);
