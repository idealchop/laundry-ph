/**
 * River Apps hero art: a photoreal object on pure black, pinned right, fading softly into the card's black.
 * No tile, border or cutout box. The card itself must be bg-black.
 */
export function HeroPhoto({ src = "/hero/laundry-washer.webp", className = "" }: { src?: string; className?: string }) {
  const mask = "linear-gradient(to right, transparent 0%, #000 42%), linear-gradient(to bottom, #000 78%, transparent 100%)";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      className={`pointer-events-none absolute inset-y-0 right-0 z-0 h-full w-auto max-w-none select-none ${className}`}
      style={{ maskImage: mask, WebkitMaskImage: mask, maskComposite: "intersect", WebkitMaskComposite: "source-in" }}
    />
  );
}
