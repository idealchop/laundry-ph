/** The one customer link encoded in the shop QR. */

export function bookingUrl(origin: string, shopId: string): string {
  return `${origin}/book?shop=${encodeURIComponent(shopId)}`;
}

/** Shown on the shop QR page. The public booking page does not repeat these steps. */
export const HOW_IT_WORKS = [
  "Customers scan this one code and open the booking page.",
  "They choose a service, and whether the shop picks the laundry up or they drop it off.",
  "They leave an email or a mobile number. For delivery, they also leave an address so the shop knows where to bring it back.",
  "The request shows in Orders → Online. Accept it to start the order.",
] as const;
