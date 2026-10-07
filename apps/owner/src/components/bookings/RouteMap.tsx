"use client";

/**
 * Read-only OSM map for a booking: shop pin, customer pin and the route between them.
 * Fits both pins on load; drag to pan, − / + to zoom, "Fit" to reset. Same tiles and projection as PinMap.
 */
import { Maximize2, Minus, Plus, Store } from "lucide-react";
import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { osmTiles, project, unproject, TILE, type LatLng, type Px } from "../settings/PinMap";

const MIN_Z = 3;
const MAX_Z = 18;
const PAD = 56;

function fit(points: LatLng[], size: { w: number; h: number }): { center: LatLng; zoom: number } {
  if (points.length === 1 || size.w <= 0) return { center: points[0]!, zoom: 16 };
  for (let z = MAX_Z - 1; z >= MIN_Z; z--) {
    const px = points.map((p) => project(p, z));
    const xs = px.map((p) => p.x), ys = px.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    if (w <= size.w - PAD * 2 && h <= size.h - PAD * 2) {
      return { center: unproject({ x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 }, z), zoom: z };
    }
  }
  return { center: points[0]!, zoom: MIN_Z };
}

export interface RouteMapProps {
  shop: LatLng | null;
  customer: LatLng | null;
  /** Route polyline (shop → customer); straight dashed line when `dashed`. */
  path: LatLng[] | null;
  dashed?: boolean;
  className?: string;
}

export function RouteMap({ shop, customer, path, dashed, className }: RouteMapProps) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  /** null = auto-fit to the pins and route. */
  const [view, setView] = useState<{ center: LatLng; zoom: number } | null>(null);
  const drag = useRef<{ id: number; start: Px; startCenter: Px } | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e!.contentRect.width, h: e!.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = [shop, customer, ...(path ?? [])].filter((p): p is LatLng => p != null);
  if (!points.length) return null;
  const { center, zoom } = view ?? fit(points, size);
  const c = project(center, zoom);
  const origin = { x: c.x - size.w / 2, y: c.y - size.h / 2 };
  const toPx = (p: LatLng) => { const q = project(p, zoom); return { x: q.x - origin.x, y: q.y - origin.y }; };
  const tiles = osmTiles(origin, size, zoom);
  const line = path && path.length > 1 ? path.map((p) => { const q = toPx(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(" ") : null;
  const shopPx = shop ? toPx(shop) : null;
  const custPx = customer ? toPx(customer) : null;

  const local = (e: PointerEvent): Px => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!e.isPrimary) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, start: local(e), startCenter: c };
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const p = local(e);
    const dx = p.x - d.start.x, dy = p.y - d.start.y;
    if (Math.hypot(dx, dy) < 3) return;
    setView({ center: unproject({ x: d.startCenter.x - dx, y: d.startCenter.y - dy }, zoom), zoom });
  }
  const zoomBy = (dz: number) => setView({ center, zoom: Math.max(MIN_Z, Math.min(MAX_Z, zoom + dz)) });

  return (
    <div className={`relative overflow-hidden rounded-[18px] border border-grey-200 bg-grey-100 ${className ?? ""}`}>
      <div
        ref={box}
        className="relative h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        role="img"
        aria-label={shop && customer ? "Map with your shop, the customer’s location and the route between them." : "Map of the location."}
      >
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element -- raw map tiles, positioned by hand
          <img key={t.key} src={t.src} alt="" draggable={false} width={TILE} height={TILE}
            className="pointer-events-none absolute max-w-none" style={{ left: t.left, top: t.top, width: TILE, height: TILE }} />
        ))}
        {line && size.w > 0 ? (
          <svg className="pointer-events-none absolute inset-0" width={size.w} height={size.h} aria-hidden>
            <polyline points={line} fill="none" stroke="#fff" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={line} fill="none" stroke="#2563EB" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashed ? "2 9" : undefined} />
          </svg>
        ) : null}
        {shopPx ? (
          <span aria-hidden className="pointer-events-none absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-on-ink shadow-[0_3px_6px_rgba(10,10,10,.35)] ring-[3px] ring-white"
            style={{ left: shopPx.x, top: shopPx.y }}>
            <Store size={17} strokeWidth={2.1} />
          </span>
        ) : null}
        {custPx ? (
          <svg aria-hidden width="34" height="44" viewBox="0 0 34 44" className="pointer-events-none absolute -translate-x-1/2 -translate-y-full drop-shadow-[0_3px_4px_rgba(10,10,10,.35)]"
            style={{ left: custPx.x, top: custPx.y + 2 }}>
            <path d="M17 1.5C8.4 1.5 1.5 8.3 1.5 16.8 1.5 28.2 17 42.5 17 42.5S32.5 28.2 32.5 16.8C32.5 8.3 25.6 1.5 17 1.5Z" fill="#2563EB" stroke="#fff" strokeWidth="2.5" />
            <circle cx="17" cy="16.5" r="5.5" fill="#fff" />
          </svg>
        ) : null}
      </div>
      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-[12px] bg-surface shadow-card">
        <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1)} disabled={zoom >= MAX_Z} className="inline-flex size-10 items-center justify-center border-b border-line disabled:opacity-40"><Plus size={18} strokeWidth={2.2} /></button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomBy(-1)} disabled={zoom <= MIN_Z} className="inline-flex size-10 items-center justify-center border-b border-line disabled:opacity-40"><Minus size={18} strokeWidth={2.2} /></button>
        <button type="button" aria-label="Fit route" onClick={() => setView(null)} disabled={view == null} className="inline-flex size-10 items-center justify-center disabled:opacity-40"><Maximize2 size={16} strokeWidth={2.2} /></button>
      </div>
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
        className="absolute bottom-0 right-0 rounded-tl-[8px] bg-surface/85 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-2">
        © OpenStreetMap
      </a>
    </div>
  );
}
