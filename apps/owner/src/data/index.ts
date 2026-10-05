/**
 * Data access for the Laundry.ph owner UI.
 *
 * Components only talk to `data` through the `LaundryDataSource` interface. Today it is backed by
 * in-memory sample fixtures; later a Firestore implementation (workspaces/{shopId}/…, public_tickets)
 * can be dropped in here without changing any screen. Methods are async on purpose.
 */
import * as fx from "./fixtures";
import type {
  Catalog, Customer, DaySummary, GrowthStat, GrowthTip, Machine, PickupRequest, PublicTicket, QueuedOrder, SalesPoint, Schedule, Shop,
  VerifiedBooking,
} from "./types";

export * from "./types";

export interface LaundryDataSource {
  /** True while the app shows seeded sample data (drives <SampleDataTag />). */
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

/** The active data source. Swap for a Firestore-backed implementation in a later phase. */
export const data: LaundryDataSource = sampleDataSource;

/** Ticket ids that exist in the sample data (used to pre-render /t/[ticketId]). */
export const SAMPLE_TICKET_IDS = fx.tickets.map((t) => t.id);
