/** River 3D coloured icon set (river-kit-pack, webp 256). Decorative unless a label is given. */
export type RiverIconName =
  | "home" | "orders" | "messages" | "settings" | "items" | "payments" | "bookings" | "online-shop"
  | "reports" | "staff" | "location" | "cleaning" | "supplies" | "notifications";

export function RiverIcon({ name, size = 28, label, className }: { name: RiverIconName; size?: number; label?: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/icons/river/${name}.webp`} alt={label ?? ""} aria-hidden={label ? undefined : true} width={size} height={size} draggable={false}
      className={`block shrink-0 select-none object-contain ${className ?? ""}`} style={{ width: size, height: size }} />
  );
}
