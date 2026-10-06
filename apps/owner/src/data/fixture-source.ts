/**
 * In-memory LaundryDataSource over the sample fixtures. Fully interactive (create orders,
 * move statuses, add customers) but nothing persists past a page reload. Only used when the
 * build is not pointed at Firestore (see dataMode()).
 */
import { BOOKING_DONE, BOOKING_OPEN, sortOpenBookings } from "@/lib/bookings";
import { avatarFor, buildWalkInOrder, formatRef, nextStatus, toPublicTicket } from "@/lib/orders";
import { ACTIVE_STATUSES, type Booking, type Customer, type Order, type PublicTicket } from "./types";
import * as fx from "./fixtures";
import { normalizeCode, refFromCode, type LaundryDataSource, type PublicTicketSource, type Unsubscribe } from "./index";

type Listener = () => void;

const store = {
  orders: fx.sampleOrders(),
  bookings: fx.sampleBookings(),
  customers: fx.customers.map((c) => ({ ...c })),
  shop: { ...fx.shop, address: fx.shop.address ? { ...fx.shop.address } : null, location: fx.shop.location ? { ...fx.shop.location } : null },
  catalog: structuredClone(fx.catalog),
  nextNo: 423,
  listeners: new Set<Listener>(),
};
const emit = () => store.listeners.forEach((l) => l());
const subscribe = (fn: Listener): Unsubscribe => {
  store.listeners.add(fn);
  fn();
  return () => store.listeners.delete(fn);
};
const sorted = (orders: Order[]) => [...orders].sort((a, b) => b.createdAt - a.createdAt);
const OPEN = [...ACTIVE_STATUSES, "ready"];

export function createFixtureDataSource(): LaundryDataSource {
  const findById = (id: string) => store.orders.find((o) => o.id === id) ?? null;
  const patch = (id: string, fn: (o: Order) => Order) => {
    store.orders = store.orders.map((o) => (o.id === id ? fn(o) : o));
    emit();
  };
  return {
    mode: "fixtures",
    shopId: fx.SAMPLE_SHOP_ID,
    getShop: async () => ({ ...store.shop }),
    getSchedule: async () => fx.schedule,
    getMachines: async () => fx.machines,
    getPickupRequests: async () => fx.pickupRequests,
    getVerifiedBooking: async (ref) => (!ref || ref === fx.verifiedBooking.ref ? fx.verifiedBooking : null),
    getCatalog: async () => structuredClone(store.catalog),
    getGrowthTip: async () => fx.growthTip,
    async updateCatalog(next) {
      if (!next.services?.length) throw new Error("Add at least one service.");
      const services = next.services.map((s) => ({
        id: s.id.trim() || `svc-${Date.now()}`,
        name: s.name.trim(),
        unit: s.unit === "pc" ? "pc" as const : "kg" as const,
        priceCentavos: Math.max(0, Math.round(s.priceCentavos)),
        icon: s.icon,
      }));
      if (services.some((s) => s.name.length < 2)) throw new Error("Each service needs a name.");
      const detergents = (next.detergents ?? []).map((o) => ({
        id: o.id, name: o.name.trim(), ...(o.short ? { short: o.short } : {}), priceCentavos: Math.max(0, Math.round(o.priceCentavos)), ...(o.icon ? { icon: o.icon } : {}),
      }));
      const addOns = (next.addOns ?? []).map((o) => ({
        id: o.id, name: o.name.trim(), ...(o.short ? { short: o.short } : {}), priceCentavos: Math.max(0, Math.round(o.priceCentavos)), ...(o.icon ? { icon: o.icon } : {}),
      }));
      const defaults = {
        ...next.defaults,
        serviceId: services.some((s) => s.id === next.defaults?.serviceId) ? next.defaults.serviceId : services[0]!.id,
        detergentId: detergents.some((d) => d.id === next.defaults?.detergentId) ? next.defaults.detergentId : (detergents[0]?.id ?? ""),
      };
      store.catalog = {
        services,
        detergents,
        addOns,
        minKg: Math.max(0, next.minKg ?? 5),
        returnSlots: next.returnSlots?.length ? next.returnSlots : store.catalog.returnSlots,
        defaults: { ...store.catalog.defaults, ...defaults, addOnIds: defaults.addOnIds ?? store.catalog.defaults.addOnIds, returnSlotId: defaults.returnSlotId ?? store.catalog.defaults.returnSlotId, kg: defaults.kg ?? store.catalog.defaults.kg, pieces: defaults.pieces ?? store.catalog.defaults.pieces },
      };
      emit();
      return structuredClone(store.catalog);
    },

    watchOrders: (opts, onData) =>
      subscribe(() => {
        let list = store.orders;
        if (opts.sinceMs != null) list = list.filter((o) => o.createdAt >= opts.sinceMs!);
        if (opts.openOnly) list = list.filter((o) => OPEN.includes(o.status));
        onData(sorted(list));
      }),
    watchOrder: (id, onData) => subscribe(() => onData(findById(id))),
    async findOrder(raw) {
      const code = normalizeCode(raw);
      const ref = refFromCode(code);
      return store.orders.find((o) => o.ticketId.toUpperCase() === code || o.id.toUpperCase() === code || o.ref === code || (ref && o.ref === ref)) ?? null;
    },
    async createWalkInOrder(input) {
      const now = Date.now();
      const booking = input.bookingId ? store.bookings.find((b) => b.id === input.bookingId) : undefined;
      if (input.bookingId && (!booking || (booking.status !== "accepted" && booking.status !== "received"))) {
        throw new Error("Accept the booking before turning it into an order.");
      }
      const ref = formatRef(store.nextNo++);
      let customerId = input.customer.id ?? null;
      const name = input.customer.name.trim();
      if (!customerId && name) {
        const c: Customer = { id: `c${Date.now()}`, name, phone: input.customer.phone ?? null, avatar: avatarFor(name), source: "Walk-in", visits: 0, spentCentavos: 0, createdAt: now };
        store.customers = [c, ...store.customers];
        customerId = c.id;
      }
      const base = buildWalkInOrder(store.catalog, { ...input, customer: { ...input.customer, id: customerId } }, {
        shopId: fx.SAMPLE_SHOP_ID, ref, queueNo: store.nextNo - 400, ticketId: ref, now, sample: true,
      });
      const order: Order = { ...base, id: `local-${ref}`, ...(booking ? { source: "river-mobile" as const, bookingId: booking.id } : {}) };
      if (booking) {
        store.bookings = store.bookings.map((b) => (b.id === booking.id
          ? { ...b, status: "converted", orderId: order.id, statusTimes: { ...b.statusTimes, converted: now }, updatedAt: now }
          : b));
      }
      store.customers = store.customers.map((c) =>
        c.id === customerId ? { ...c, visits: c.visits + 1, spentCentavos: c.spentCentavos + order.totalCentavos, lastVisitAt: now } : c,
      );
      store.orders = [order, ...store.orders];
      emit();
      return order;
    },
    async setOrderStatus(id, status) {
      patch(id, (o) => {
        const stageTimes = { ...o.stageTimes };
        if (nextStatus(o) === status) stageTimes[status] = Date.now();
        else delete stageTimes[o.status];
        return { ...o, status, stageTimes, updatedAt: Date.now() };
      });
    },
    async markOrderPaid(id, method) {
      patch(id, (o) => ({ ...o, paymentStatus: "paid", paymentMethod: method, paidCentavos: o.totalCentavos, updatedAt: Date.now() }));
    },
    watchBookings: (scope, onData) =>
      subscribe(() => {
        const list = store.bookings.filter((b) => (scope === "open" ? BOOKING_OPEN : BOOKING_DONE).includes(b.status));
        onData(scope === "open" ? sortOpenBookings(list) : [...list].sort((a, b) => b.updatedAt - a.updatedAt));
      }),
    getBooking: async (id) => store.bookings.find((b) => b.id === id) ?? null,
    async setBookingStatus(id, to, reason) {
      const now = Date.now();
      const note = reason?.trim().slice(0, 200) || null;
      const allowed: Record<string, Booking["status"][]> = {
        accepted: ["requested"], declined: ["requested"], received: ["accepted"], completed: ["accepted", "received"], cancelled: ["accepted", "received"],
      };
      const b = store.bookings.find((x) => x.id === id);
      if (!b) throw new Error("Booking not found.");
      if (!allowed[to]?.includes(b.status)) throw new Error("This booking has already moved on.");
      store.bookings = store.bookings.map((x) => (x.id === id
        ? {
            ...x, status: to, updatedAt: now, statusTimes: { ...x.statusTimes, [to]: now },
            ...(to === "declined" ? { declineReason: note } : {}),
            ...(to === "cancelled" ? { cancelReason: note, cancelledBy: "shop" as const } : {}),
          }
        : x));
      emit();
    },
    async createTestBooking() {
      const now = Date.now();
      const [sample] = fx.sampleBookings(now);
      const id = `bk-test-${now}`;
      const ref = `BK-T${String(now).slice(-5)}`;
      store.bookings = [{ ...sample!, id, ref, test: true, createdAt: now, updatedAt: now, statusTimes: { requested: now } }, ...store.bookings];
      emit();
      return { id, ref };
    },
    watchCustomers: (onData) => subscribe(() => onData([...store.customers])),
    async createCustomer(input) {
      const name = input.name.trim();
      if (!name) throw new Error("Enter the customer’s name.");
      const c: Customer = {
        id: `c${Date.now()}`, name, phone: input.phone || null, avatar: avatarFor(name), source: input.source ?? "Walk-in",
        visits: 0, spentCentavos: 0, createdAt: Date.now(), notes: input.notes || null,
      };
      store.customers = [c, ...store.customers];
      emit();
      return c;
    },
    async updateShopProfile(patch) {
      const name = patch.name.trim();
      if (name.length < 2) throw new Error("Enter your shop name.");
      store.shop = {
        ...store.shop,
        name,
        area: patch.area.trim(),
        ownerName: patch.ownerName.trim() || store.shop.ownerName,
        address: patch.address,
        location: patch.location,
        about: typeof patch.about === "string" ? patch.about.trim().slice(0, 300) : store.shop.about,
        dailyTargetCentavos: patch.dailyTargetCentavos ?? store.shop.dailyTargetCentavos,
        // Fixture demo shop is editable in-memory so settings can be exercised offline.
        sample: store.shop.sample,
      };
      emit();
      return { ...store.shop };
    },
    async setShopPhotos(photoUrls) {
      const cleaned = [...new Set(photoUrls.filter((u) => typeof u === "string" && u.startsWith("https://")))].slice(0, 6);
      store.shop = { ...store.shop, photoUrls: cleaned };
      emit();
      return { ...store.shop };
    },
    async setShopPlan(patch) {
      store.shop = {
        ...store.shop,
        tier: patch.tier,
        planSource: patch.planSource,
        planExpiresAt: patch.planExpiresAt,
      };
      emit();
      return { ...store.shop };
    },
  };
}

export const fixtureTicketSource: PublicTicketSource = {
  async getTicket(id) {
    const o = store.orders.find((x) => x.ticketId.toLowerCase() === id.toLowerCase());
    return o ? toPublicTicket(o, fx.shop) : null;
  },
  watchTicket(id, onData) {
    return subscribe(() => {
      const o = store.orders.find((x) => x.ticketId.toLowerCase() === id.toLowerCase());
      onData(o ? (toPublicTicket(o, fx.shop) as PublicTicket) : null);
    });
  },
};

/** Ticket ids in the sample fixtures (pre-rendered for the static export). */
export const SAMPLE_TICKET_IDS = store.orders.map((o) => o.ticketId);
