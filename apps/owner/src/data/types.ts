/**
 * Domain types for the Laundry.ph owner UI. They mirror the planned Firestore model
 * (`workspaces/{shopId}/…`, `public_tickets/{token}`) closely enough to swap the sample
 * fixtures for real reads later without touching components.
 */
import type { AvatarPreset, IconName } from "@river-apps/icons";

/** Philippine pesos. Whole or decimal pesos (not centavos). */
export type Peso = number;

export type Tier = "partner" | "paid";

export interface Shop {
  id: string;
  name: string;
  area: string;
  ownerName: string;
  ownerAvatar: AvatarPreset;
  tier: Tier;
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
  sales: Peso;
  orders: number;
  kgWashed: number;
  inQueue: number;
  ready: number;
  unpaid: Peso;
  dailyTarget: Peso;
  newRiverMobilePickups: number;
  newCustomersThisWeek: number;
  notifications: number;
}

export interface ScheduleDay {
  key: string;
  weekday: string;
  day: number;
  count: number;
  ariaLabel?: string;
}
export interface Schedule {
  monthLabel: string;
  todayKey: string;
  days: ScheduleDay[];
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

export type QueueStatus = "Waiting" | "Washing" | "Drying" | "Folding" | "Ready";
export interface QueuedOrder {
  ref: string;
  customer: PersonRef;
  kg: number;
  detail: string;
  status: QueueStatus;
}

export interface PickupRequest {
  id: string;
  kind: "pickup" | "dropoff";
  serviceName: string;
  icon: IconName;
  window: string;
  estimateKg?: number;
  pieces?: number;
  estimate?: Peso;
  customer: PersonRef;
  area?: string;
  distanceKm?: number;
  ref?: string;
  isNew: boolean;
}

export interface PricedLine {
  name: string;
  price: Peso;
}
export interface VerifiedBooking {
  ref: string;
  customer: PersonRef;
  source: "River Mobile";
  checkedIn: string;
  serviceName: string;
  serviceIcon: IconName;
  estimateKg: number;
  estimate: Peso;
  addOns: PricedLine[];
  pickup: { window: string; address: string; fee: Peso };
}

export interface CatalogService {
  id: string;
  name: string;
  unit: "kg" | "pc";
  price: Peso;
  icon: IconName;
}
export interface CatalogOption {
  id: string;
  name: string;
  /** Short label for chips, e.g. "Shop". Falls back to name. */
  short?: string;
  price: Peso;
  icon?: IconName;
}
export interface ReturnSlot {
  id: string;
  label: string;
}
export interface Catalog {
  services: CatalogService[];
  detergents: CatalogOption[];
  addOns: CatalogOption[];
  /** Minimum billed kilos for per-kg services. */
  minKg: number;
  returnSlots: ReturnSlot[];
  /** Pre-filled values for a new walk-in ticket. */
  defaults: { serviceId: string; kg: number; pieces: number; detergentId: string; addOnIds: string[]; returnSlotId: string; customer: string };
  nextQueueNo: number;
  nextTicketRef: string;
}

export type TicketStage = "received" | "washing" | "drying" | "folding" | "ready";
export const TICKET_STAGES: TicketStage[] = ["received", "washing", "drying", "folding", "ready"];

/** Public-safe projection shown on /t/[ticketId] (no login). */
export interface PublicTicket {
  id: string;
  shopName: string;
  queueNo: number;
  maskedName: string;
  stage: TicketStage;
  stageTimes: Partial<Record<TicketStage, string>>;
  readyBy: string;
  updatedAt: string;
  kg: number;
  serviceName: string;
  amountDue: Peso;
  paid: boolean;
}

export interface SalesPoint {
  label: string;
  value: Peso;
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
export interface Customer {
  id: string;
  name: string;
  avatar: AvatarPreset;
  source: "River Mobile" | "Walk-in";
  visits: number;
  tag: CustomerTag;
  spent: Peso;
}
