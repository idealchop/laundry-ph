/**
 * Data access for the Laundry.ph owner UI.
 *
 * Components talk to a shop-bound `LaundryDataSource` (see `useShop()` in lib/shop.tsx).
 * Backends:
 *   - firebase (default when NEXT_PUBLIC_DATA_SOURCE=firebase and the web config is present):
 *     the signed-in user's shop in the named Firestore DB (laundrydb / laundrydb-dev).
 *   - fixtures: in-memory sample shop, fully interactive but nothing persists. Used only when
 *     NEXT_PUBLIC_DATA_SOURCE=fixtures, NEXT_PUBLIC_DEMO_FIXTURES=1, or Firebase is not configured.
 *
 * There is no silent fallback from Firestore to fixtures: a failed Firestore read shows an
 * error on screen so a broken shop is never mistaken for real data.
 */
import { hasFirebaseWebConfig } from "@/lib/firebase/config";
import type {
  Catalog, Customer, GrowthTip, Machine, NewCustomer, NewWalkInOrder, Order, OrderStatus, PaymentMethod, PickupRequest,
  PublicTicket, Schedule, Shop, VerifiedBooking,
} from "./types";

export * from "./types";

export type Unsubscribe = () => void;
export type DataMode = "firebase" | "fixtures";

export interface WatchOrdersOptions {
  /** Only orders created at or after this epoch ms. */
  sinceMs?: number;
  /** Only open orders (received … ready), any age. */
  openOnly?: boolean;
}

export interface LaundryDataSource {
  readonly mode: DataMode;
  readonly shopId: string;
  getShop(): Promise<Shop>;
  getSchedule(): Promise<Schedule>;
  getMachines(): Promise<Machine[]>;
  getPickupRequests(): Promise<PickupRequest[]>;
  /** River Mobile booking resolved from a QR (Partner API v1 later). Demo doc only for now. */
  getVerifiedBooking(ref?: string): Promise<VerifiedBooking | null>;
  getCatalog(): Promise<Catalog>;
  /** Static tip until AI Growth ships; null when the shop has none. */
  getGrowthTip(): Promise<GrowthTip | null>;

  /** Live orders, newest first. */
  watchOrders(opts: WatchOrdersOptions, onData: (orders: Order[]) => void, onError: (e: Error) => void): Unsubscribe;
  watchOrder(orderId: string, onData: (order: Order | null) => void, onError: (e: Error) => void): Unsubscribe;
  /** Resolve a scanned / typed code: ticket URL, ticket id, ref ("LDY-0423", "423") or order id. */
  findOrder(code: string): Promise<Order | null>;
  /** Create a walk-in order + its public ticket (+ customer upsert) atomically. */
  createWalkInOrder(input: NewWalkInOrder): Promise<Order>;
  setOrderStatus(orderId: string, status: OrderStatus): Promise<void>;
  markOrderPaid(orderId: string, method: PaymentMethod): Promise<void>;

  watchCustomers(onData: (customers: Customer[]) => void, onError: (e: Error) => void): Unsubscribe;
  createCustomer(input: NewCustomer): Promise<Customer>;
}

/** Public, no-login reads for /t/[ticketId]. */
export interface PublicTicketSource {
  getTicket(ticketId: string): Promise<PublicTicket | null>;
  watchTicket(ticketId: string, onData: (t: PublicTicket | null) => void, onError: (e: Error) => void): Unsubscribe;
}

/** Which backend this build uses. */
export function dataMode(): DataMode {
  const mode = (process.env.NEXT_PUBLIC_DATA_SOURCE ?? "fixtures").toLowerCase();
  const demo = process.env.NEXT_PUBLIC_DEMO_FIXTURES === "1";
  if (mode === "firebase" && !demo && hasFirebaseWebConfig()) return "firebase";
  return "fixtures";
}

/** Extract the code from a scanned ticket URL ("…/t/LDY-0423-ABCD2345") or return the trimmed input. */
export function normalizeCode(raw: string): string {
  const s = raw.trim();
  const m = s.match(/\/t\/([^/?#\s]+)/);
  return decodeURIComponent(m?.[1] ?? s).toUpperCase();
}
/** "423", "0423", "ldy-423" → "LDY-0423"; null when it doesn't look like a ref. */
export function refFromCode(code: string): string | null {
  const m = code.match(/^(?:LDY-?)?(\d{1,6})$/i);
  return m ? `LDY-${m[1]!.padStart(4, "0")}` : null;
}
