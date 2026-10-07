/**
 * Domain types for the Laundry.ph owner UI. They mirror the Firestore model
 * (`shops/{shopId}/…`, `public_tickets/{ticketId}`, see firebase-source.ts).
 *
 * Money: transactional amounts (orders, tickets, customers, sales) are integer
 * CENTAVOS (`…Centavos` fields). Catalog prices are centavos too.
 */
import type { AvatarPreset, IconName } from "@river-apps/icons";

/** Philippine pesos. Whole or decimal pesos (display only; never persisted). */
export type Peso = number;
/** Integer centavos (₱1 = 100). Every persisted money value uses this. */
export type Centavos = number;

export type Tier = "partner" | "paid";
/** How the shop unlocked Paid (null = Partner / never paid). */
export type PlanSource = "subscription" | "lifetime" | "demo" | null;

/** Street address for River Mobile discovery and shop listing. */
export interface ShopAddress {
  line1: string;
  line2?: string;
  barangay?: string;
  city: string;
  province?: string;
  postalCode?: string;
}

/** Map pin so River Mobile can find the shop (lat/lng + human label). */
export interface ShopLocation {
  lat: number;
  lng: number;
  /** Reverse-geocoded or owner-entered label shown to customers. */
  formattedAddress: string;
  placeId?: string;
}

export interface Shop {
  id: string;
  name: string;
  area: string;
  ownerName: string;
  ownerAvatar: AvatarPreset;
  tier: Tier;
  /** Seeded demo shop (drives the "Sample data" tag). */
  sample?: boolean;
  ownerUid?: string;
  /** Daily sales goal shown on the dashboard. */
  dailyTargetCentavos?: Centavos;
  /** Structured address (settings). */
  address?: ShopAddress | null;
  /** Map pin for River Mobile (lat/lng + formatted address). */
  location?: ShopLocation | null;
  /** Shop storefront / interior photos for River Mobile listing (download URLs). */
  photoUrls?: string[];
  /** Short owner-written blurb for the River Mobile listing (max 300 chars). */
  about?: string;
  /** How Paid was unlocked; null on Partner. */
  planSource?: PlanSource;
  /** Epoch ms when a monthly Paid plan ends; null for lifetime / Partner. */
  planExpiresAt?: number | null;
}

/** Editable shop profile fields (owner settings). */
export interface ShopProfileUpdate {
  name: string;
  area: string;
  ownerName: string;
  address: ShopAddress | null;
  location: ShopLocation | null;
  /** Listing blurb (max 300 chars). Omit to leave the stored value untouched. */
  about?: string;
  /** HTTPS download URLs from Firebase Storage (max 6). */
  photoUrls?: string[];
  dailyTargetCentavos?: Centavos;
}

/** Plan change written by billing / demo upgrade. */
export interface ShopPlanUpdate {
  tier: Tier;
  planSource: PlanSource;
  planExpiresAt: number | null;
}

export type MemberRole = "owner" | "staff";
export interface Membership {
  uid: string;
  shopId: string;
  role: MemberRole;
  status: "active" | "disabled";
}

export interface PersonRef {
  name: string;
  avatar: AvatarPreset;
}

export interface DaySummary {
  isoDate: string;
  /** e.g. "Sun, Oct 4" */
  dateLabel: string;
  /** e.g. "Sunday, Oct 4" */
  longDateLabel: string;
  salesCentavos: Centavos;
  orders: number;
  kgWashed: number;
  inQueue: number;
  ready: number;
  unpaidCentavos: Centavos;
  dailyTargetCentavos: Centavos;
  newRiverMobilePickups: number;
  newCustomersThisWeek: number;
  notifications: number;
}

export type MachineKind = "washer" | "dryer";
export interface Machine {
  id: string;
  kind: MachineKind;
  name: string;
  status: "running" | "free";
  /** "Washing", "Rinsing", "Drying". */
  stage?: string;
  orderRef?: string;
  customerName?: string;
  kg?: number;
  /** 0–100 */
  progress?: number;
  minutesLeft?: number;
  /** For a free machine: the order that should go in next. */
  nextOrderRef?: string;
}

/**
 * Order lifecycle. Flow: received → washing → drying → folding → ready → claimed (walk-in
 * pick-up at the counter) or delivered (River Mobile / rider drop-off). `cancelled` is terminal.
 */
export type OrderStatus = "received" | "washing" | "drying" | "folding" | "ready" | "claimed" | "delivered" | "cancelled";
export const ORDER_FLOW: OrderStatus[] = ["received", "washing", "drying", "folding", "ready"];
export const ACTIVE_STATUSES: OrderStatus[] = ["received", "washing", "drying", "folding"];
export const DONE_STATUSES: OrderStatus[] = ["claimed", "delivered"];
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  received: "Received",
  washing: "Washing",
  drying: "Drying",
  folding: "Folding",
  ready: "Ready",
  claimed: "Claimed",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export type PaymentStatus = "unpaid" | "paid";
export type PaymentMethod = "cash" | "gcash";
export type OrderSource = "walk-in" | "river-mobile";

export interface OrderLine {
  label: string;
  amountCentavos: Centavos;
}
export interface OrderOption {
  id: string;
  name: string;
  priceCentavos: Centavos;
}

/** shops/{shopId}/orders/{orderId}. Timestamps are epoch milliseconds on the client. */
/** How a walk-in order goes back to the customer. */
export type Fulfillment = "pickup" | "delivery";

export interface Order {
  id: string;
  shopId: string;
  /** Human ticket number, e.g. "LDY-0423" (unique per shop, from meta/counters). */
  ref: string;
  /** Daily queue number shown at the counter. */
  queueNo: number;
  /** public_tickets/{ticketId} token (unguessable). */
  ticketId: string;
  source: OrderSource;
  status: OrderStatus;
  customer: PersonRef & { phone?: string };
  customerId?: string | null;
  serviceId: string;
  serviceName: string;
  unit: "kg" | "pc";
  /** Entered quantity (kg or pieces). */
  quantity: number;
  /** Billed quantity after the minimum-kg rule. */
  billedQuantity: number;
  /** Kilos (0 for per-piece services). */
  kg: number;
  detergent: OrderOption | null;
  addOns: OrderOption[];
  /** Clothes type (absent on older orders = Regular clothes). */
  clothesType?: OrderClothesType | null;
  lines: OrderLine[];
  subtotalCentavos: Centavos;
  totalCentavos: Centavos;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod | null;
  paidCentavos: Centavos;
  /** e.g. "Mon, Oct 5 · 5:00 PM" */
  readyBy: string;
  /** Pickup at the shop or delivery to the customer (absent on older orders). */
  fulfillment?: Fulfillment;
  /** One-line summary, e.g. "6.5 kg · Wash-Dry-Fold". */
  detail: string;
  stageTimes: Partial<Record<OrderStatus, number>>;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  sample?: boolean;
  /** River Mobile booking this order came from. */
  bookingId?: string;
}

export interface NewWalkInOrder {
  customer: { id?: string | null; name: string; phone?: string };
  serviceId: string;
  quantity: number;
  detergentId: string;
  addOnIds: string[];
  returnSlotId: string;
  /** Clothes type id (defaults to Regular clothes). */
  clothesTypeId?: string;
  /** Pieces / pairs for a per-piece clothes type. */
  typePieces?: number;
  /** Defaults to "pickup". */
  fulfillment?: Fulfillment;
  /** River Mobile booking this order converts (marks the booking "converted" in the same write). */
  bookingId?: string;
}

export interface PickupRequest {
  id: string;
  kind: "pickup" | "dropoff";
  serviceName: string;
  icon: IconName;
  window: string;
  estimateKg?: number;
  pieces?: number;
  estimateCentavos?: Centavos;
  customer: PersonRef;
  area?: string;
  distanceKm?: number;
  ref?: string;
  isNew: boolean;
}

/* ---------- River Mobile bookings (shops/{shopId}/bookings/{bookingId}) ---------- */

/**
 * requested → accepted → received → completed   (Partner: the shop tracks the booking itself)
 * requested → accepted → converted               (Paid: becomes a normal order, `orderId` set)
 * requested → declined (shop)  ·  requested | accepted → cancelled (customer via API, or shop)
 */
export type BookingStatus = "requested" | "accepted" | "received" | "completed" | "converted" | "declined" | "cancelled";
/** How the laundry reaches the shop: the shop picks it up, or the customer drops it off. */
export type BookingType = "pickup" | "dropoff";

export interface Booking {
  id: string;
  shopId: string;
  /** Short human code shown to the owner and the customer, e.g. "BK-7Q2M9X". */
  ref: string;
  source: "river-mobile";
  status: BookingStatus;
  customer: { name: string; phone: string };
  serviceId: string | null;
  serviceName: string;
  type: BookingType;
  /** How the laundry goes back: customer collects at the shop, or the shop delivers. */
  fulfillment: Fulfillment;
  /** Shop-local date "YYYY-MM-DD" and time "HH:mm" (Asia/Manila). */
  slot: { date: string; time: string };
  /** Epoch ms of the slot start. */
  slotAt: number;
  estKg: number | null;
  address: string | null;
  /** Customer pin from River Mobile (optional; the app geocodes `address` when it's missing). */
  location: { lat: number; lng: number } | null;
  /** Clothes type the customer picked, when not Regular clothes. */
  clothesType: { id: string; name: string } | null;
  notes: string | null;
  declineReason: string | null;
  cancelReason: string | null;
  cancelledBy: "customer" | "shop" | null;
  /** Order created from this booking (status "converted"). */
  orderId: string | null;
  statusTimes: Partial<Record<BookingStatus, number>>;
  createdAt: number;
  updatedAt: number;
  /** Created by the dev-only test booking tools. */
  test: boolean;
}

export interface PricedLine {
  name: string;
  priceCentavos: Centavos;
}
export interface VerifiedBooking {
  ref: string;
  customer: PersonRef;
  source: "River Mobile";
  checkedIn: string;
  serviceName: string;
  serviceIcon: IconName;
  estimateKg: number;
  estimateCentavos: Centavos;
  addOns: PricedLine[];
  pickup: { window: string; address: string; feeCentavos: Centavos };
}

export interface CatalogService {
  id: string;
  name: string;
  unit: "kg" | "pc";
  /** Per kg or per piece. */
  priceCentavos: Centavos;
  icon: IconName;
}
export interface CatalogOption {
  id: string;
  name: string;
  /** Short label for chips, e.g. "Shop". Falls back to name. */
  short?: string;
  priceCentavos: Centavos;
  icon?: IconName;
}
/**
 * How a clothes type changes the walk-in price:
 * - "regular": the service's own per-kg / per-piece price, no surcharge.
 * - "per_kg_surcharge": service price + `priceCentavos` extra per billed kg (per-kg services only).
 * - "per_piece": the load is priced by pieces instead of weight (`priceCentavos` each).
 */
export type ClothesPricing = "regular" | "per_kg_surcharge" | "per_piece";
export interface ClothesType {
  id: string;
  name: string;
  pricing: ClothesPricing;
  /** Surcharge per kg, or price per piece/pair. 0 for "regular". */
  priceCentavos: Centavos;
  /** Per-piece types: "pc" (default) or "pair" (shoes). */
  pieceUnit?: "pc" | "pair";
  /** Disabled types stay in the list but don't show at the counter or to River Mobile. */
  enabled: boolean;
  icon: IconName;
}
/** Clothes type saved on an order (snapshot of the price at the time). */
export interface OrderClothesType {
  id: string;
  name: string;
  pricing: ClothesPricing;
  priceCentavos: Centavos;
  /** Pieces/pairs billed for per-piece types. */
  pieces?: number;
  pieceUnit?: "pc" | "pair";
}
export interface ReturnSlot {
  id: string;
  label: string;
}
export interface Catalog {
  services: CatalogService[];
  detergents: CatalogOption[];
  addOns: CatalogOption[];
  /** Clothes types with their pricing mode (Regular clothes first). Older catalogs get the PH defaults. */
  clothesTypes: ClothesType[];
  /** Minimum billed kilos for per-kg services. */
  minKg: number;
  returnSlots: ReturnSlot[];
  /** Pre-filled values for a new walk-in ticket. */
  defaults: { serviceId: string; kg: number; pieces: number; detergentId: string; addOnIds: string[]; returnSlotId: string; clothesTypeId?: string };
}

export type TicketStage = "received" | "washing" | "drying" | "folding" | "ready";
export const TICKET_STAGES: TicketStage[] = ["received", "washing", "drying", "folding", "ready"];

/**
 * Public-safe projection shown on /t/[ticketId] (no login): no phone, no address,
 * masked name only. Written by shop members alongside the order.
 */
export interface PublicTicket {
  id: string;
  shopId: string;
  shopName: string;
  ref: string;
  queueNo: number;
  maskedName: string;
  stage: TicketStage;
  /** Set once the customer has the laundry back. */
  done?: "claimed" | "delivered" | null;
  cancelled?: boolean;
  /** Epoch ms per stage. */
  stageTimes: Partial<Record<TicketStage, number>>;
  readyBy: string;
  /** Epoch ms. */
  updatedAt: number;
  kg: number;
  quantityLabel: string;
  serviceName: string;
  /** Clothes type name when not Regular, e.g. "Beddings / blankets / comforters". */
  clothesType?: string;
  totalCentavos: Centavos;
  amountDueCentavos: Centavos;
  paid: boolean;
  sample?: boolean;
}

export interface SalesPoint {
  label: string;
  /** Centavos. */
  value: Centavos;
}
export interface GrowthStat {
  id: string;
  label: string;
  value: string;
  caption: string;
  icon: IconName;
}
export interface GrowthTip {
  tag: "AI";
  title: string;
  text: string;
}

export type CustomerTag = "Member" | "Regular" | "New";
/** shops/{shopId}/customers/{customerId} */
export interface Customer {
  id: string;
  name: string;
  /** Lower-cased name for search. */
  nameLower?: string;
  phone?: string | null;
  avatar: AvatarPreset;
  source: "River Mobile" | "Walk-in";
  visits: number;
  /** Stored tag ("Member" is manual); New/Regular derive from visits when absent. */
  tag?: CustomerTag | null;
  spentCentavos: Centavos;
  lastVisitAt?: number | null;
  createdAt?: number | null;
  notes?: string | null;
}

export interface NewCustomer {
  name: string;
  phone?: string;
  source?: Customer["source"];
  notes?: string;
}
