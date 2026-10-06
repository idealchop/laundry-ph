import type { Shop } from "@/data";

/** Max length of the shop's "About" blurb (enforced in firestore.rules too). */
export const SHOP_ABOUT_MAX = 300;

/** "A", "A and B", "A, B and more". */
function listServices(names: string[]): string {
  const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (uniq.length === 0) return "";
  if (uniq.length === 1) return uniq[0]!;
  if (uniq.length === 2) return `${uniq[0]} and ${uniq[1]}`;
  return `${uniq[0]}, ${uniq[1]} and more`;
}

/**
 * Personalised starter blurb from the shop's own data: name, area (from the map pin) and its
 * catalog's service names. Pickup/delivery is mentioned only for River Mobile partner shops.
 * Always fits SHOP_ABOUT_MAX.
 */
export function defaultShopAbout(shop: Pick<Shop, "name" | "area" | "tier">, serviceNames: string[]): string {
  const name = shop.name.trim() || "Our shop";
  const area = shop.area.trim();
  const services = listServices(serviceNames);
  const where = area ? ` in ${area}` : "";
  const delivery = shop.tier === "partner" ? ", with pickup and delivery" : "";
  const offer = services ? ` We offer ${services}${delivery}.` : delivery ? " We offer pickup and delivery." : "";
  const text = `${name} is your neighbourhood laundry shop${where}.${offer} Drop off today and get it back fresh and folded.`;
  return text.length <= SHOP_ABOUT_MAX ? text : text.slice(0, SHOP_ABOUT_MAX - 1).trimEnd() + "…";
}
