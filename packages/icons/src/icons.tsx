"use client";
import { Graphic, type GraphicProps } from "./Graphic";
import type { GraphicName } from "./raw";
import type { IconName } from "./presets";

function make(name: GraphicName, displayName: string) {
  const C = (props: GraphicProps) => <Graphic name={name} {...props} />;
  C.displayName = displayName;
  return C;
}

/** Iridescent soap bubbles. Good for washing, cleaning or "fresh" services. */
export const BubblesIcon = make("bubbles", "BubblesIcon");
/** Canister vacuum with hose. */
export const VacuumIcon = make("vacuum", "VacuumIcon");
/** Gold and lilac sparkles. Premium, detail or polish services. */
export const SparkleIcon = make("sparkle", "SparkleIcon");
/** Tyre with alloy rim. */
export const TyreIcon = make("tyre", "TyreIcon");
/** Water drop. */
export const DropIcon = make("drop", "DropIcon");
/** Small side-view car. */
export const CarIcon = make("car", "CarIcon");
/** Chat / SMS bubble. */
export const ChatIcon = make("chat", "ChatIcon");
/** Shield with check (verification, security). */
export const ShieldIcon = make("shield", "ShieldIcon");
/** Glossy success check. */
export const CheckIcon = make("check", "CheckIcon");
/** Gold peso coin (money, payment). */
export const CoinIcon = make("coin", "CoinIcon");
/** Front-load washing machine with water and bubbles. */
export const WasherIcon = make("washer", "WasherIcon");
/** Front-load dryer with tumbling clothes. */
export const DryerIcon = make("dryer", "DryerIcon");
/** Stack of folded clothes (fold, ready for pickup). */
export const FoldedClothesIcon = make("folded", "FoldedClothesIcon");
/** Laundry basket with clothes (pickup, drop-off). */
export const LaundryBasketIcon = make("basket", "LaundryBasketIcon");
/** Detergent jug. */
export const DetergentIcon = make("detergent", "DetergentIcon");
/** Clothes iron (press / plantsa). */
export const IronIcon = make("iron", "IronIcon");
/** Phone wallet with a peso coin (GCash, Maya, QR Ph). */
export const EWalletIcon = make("ewallet", "EWalletIcon");
/** A single soap bubble for decoration. */
export const BubbleGraphic = make("bubble", "BubbleGraphic");


/** Render a 3D-style icon by name, e.g. from data. */
export function Icon3D({ name, ...props }: GraphicProps & { name: IconName }) {
  return <Graphic name={name} {...props} />;
}
