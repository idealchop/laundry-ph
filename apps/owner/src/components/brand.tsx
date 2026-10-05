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


export function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
