/** Laundry.ph River 3D icon set (public/icons3d/laundry, built by /workspace/icons/laundry-pack/build.py). 128px webp up to 64px on screen, 256 above. */
export const LAUNDRY_ICONS = [
  "washer", "dryer", "folded", "iron", "detergent", "fabcon", "bleach", "basket", "pickup-bag", "rider", "shop", "ticket", "qr",
  "staff", "cash", "wallet", "chart", "supplies", "expenses", "calendar", "rush", "settings", "install", "moments", "orders", "booking",
] as const;
export type LaundryIconName = (typeof LAUNDRY_ICONS)[number];

/** Older names used around the app, mapped onto the laundry set. */
const ALIAS = {
  home: "shop", messages: "moments", items: "washer", payments: "cash", bookings: "booking", "online-shop": "shop",
  reports: "chart", location: "booking", cleaning: "washer", notifications: "calendar",
} as const;
export type RiverIconName = LaundryIconName | keyof typeof ALIAS;

export function RiverIcon({ name, size = 28, label, className }: { name: RiverIconName; size?: number; label?: string; className?: string }) {
  const file = (ALIAS as Record<string, LaundryIconName>)[name] ?? name;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/icons3d/laundry/${size > 64 ? 256 : 128}/${file}.webp`} alt={label ?? ""} aria-hidden={label ? undefined : true} width={size} height={size} draggable={false}
      className={`block shrink-0 select-none object-contain ${className ?? ""}`} style={{ width: size, height: size }} />
  );
}
