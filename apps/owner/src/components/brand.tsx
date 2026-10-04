import { BubbleGraphic, FoldedClothesIcon, LaundryBasketIcon, WasherIcon } from "@river-apps/icons";
import { LogoMark } from "@river-apps/ui";

/** White washer-door glyph for the kit LogoMark. */
export function DoorGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none">
      <circle cx="12" cy="13.6" r="7.4" stroke="#fff" strokeWidth="2.3" />
      <path d="M7.4 15c1.5-1.2 3.1-1.2 4.6 0s3.1 1.2 4.6 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M3.5 2.4h9" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="19.2" cy="2.4" r="1.6" fill="#fff" />
    </svg>
  );
}

export function LaundryBrand({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size}><DoorGlyph /></LogoMark>
      <span className="text-[19px] font-extrabold tracking-[-0.02em] text-ink">
        Laundry<span className="font-semibold text-subtle">.ph</span>
      </span>
    </span>
  );
}

/** Hero illustration composed from kit 3D icons: washer, basket, folded stack and soap bubbles. */
export function LaundryScene({ size = 200, folded = true }: { size?: number; folded?: boolean }) {
  const k = size / 200;
  return (
    <div className="relative" style={{ width: size, height: 150 * k }}>
      <span className="absolute" style={{ left: 22 * k, top: 4 * k }}><WasherIcon size={128 * k} /></span>
      <span className="absolute" style={{ left: 112 * k, top: 66 * k }}><LaundryBasketIcon size={86 * k} /></span>
      {folded ? <span className="absolute" style={{ left: -6 * k, top: 82 * k }}><FoldedClothesIcon size={62 * k} /></span> : null}
      <BubbleGraphic size={26 * k} className="absolute" style={{ left: 150 * k, top: 18 * k }} />
      <BubbleGraphic size={16 * k} className="absolute" style={{ left: 178 * k, top: 46 * k }} />
      <BubbleGraphic size={12 * k} className="absolute" style={{ left: 10 * k, top: 22 * k }} />
      <BubbleGraphic size={18 * k} className="absolute" style={{ left: 134 * k, top: 0 }} />
    </div>
  );
}
