"use client";

import { Button } from "@river-apps/ui";
import { ReceiptText } from "lucide-react";
import { useMemo } from "react";
import type { Booking, Order } from "@/data";
import { useBookings } from "@/lib/shop";
import { qty } from "@/lib/format";
import { StatusPill } from "../ui";
import { BookingCard } from "./BookingCard";

const noop = async () => false;

/** Converted bookings by id (recent history), so online order cards can show pickup vs drop-off, slot and address. */
export function useConvertedBookings(): Map<string, Booking> {
  const { bookings } = useBookings("history");
  return useMemo(() => new Map(bookings.filter((b) => b.status === "converted").map((b) => [b.id, b])), [bookings]);
}

/** "Order details" pill button used on online order cards. */
export function OrderDetailsButton({ href, label }: { href: string; label: string }) {
  return (
    <Button size="sm" pill variant="secondary" className="h-11 px-4 text-[14px]" href={href} aria-label={label}
      leadingIcon={<ReceiptText size={16} strokeWidth={2} />}>
      Order details
    </Button>
  );
}

/**
 * Online (River Mobile) order in the same rich card as "Pickups to accept": service tile, title, time · kg,
 * status pill, customer + call, address, pickup / delivery line. One action: Order details.
 * `booking` (the converted booking, when loaded) supplies pickup vs drop-off, slot and address.
 */
export function OnlineOrderCard({ order: o, booking, now }: { order: Order; booking?: Booking | null; now: number }) {
  const card: Booking = {
    id: o.id,
    shopId: o.shopId,
    ref: o.ref,
    source: "river-mobile",
    status: "converted",
    customer: { name: o.customer.name, phone: booking?.customer.phone || o.customer.phone || "" },
    serviceId: o.serviceId,
    serviceName: o.clothesType ? `${o.serviceName} · ${o.clothesType.name.split(" /")[0]}` : o.serviceName,
    type: booking?.type ?? "pickup",
    fulfillment: o.fulfillment ?? booking?.fulfillment ?? "pickup",
    slot: booking?.slot ?? { date: "", time: "" },
    slotAt: booking?.slotAt ?? o.createdAt,
    estKg: o.kg || booking?.estKg || null,
    address: booking?.address ?? null,
    location: booking?.location ?? null,
    notes: null,
    declineReason: null,
    cancelReason: null,
    cancelledBy: null,
    orderId: o.id,
    statusTimes: {},
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    test: booking?.test ?? false,
  };
  const when = o.readyBy ? `${o.fulfillment === "delivery" ? "Deliver" : "Ready"} ${o.readyBy}` : null;
  const meta = [when, o.quantity ? qty(o.quantity, o.unit) : null].filter(Boolean).join(" · ");
  return (
    <BookingCard
      booking={card}
      canConvert={false}
      onMove={noop}
      compact
      now={now}
      meta={meta || undefined}
      pill={<StatusPill status={o.status} />}
      footer={<OrderDetailsButton href={`/orders/view?id=${o.id}`} label={`Order details for ${o.ref}`} />}
    />
  );
}
