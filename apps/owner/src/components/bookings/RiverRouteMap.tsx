"use client";

/**
 * Booking route on River Maps (MapLibre GL + River's self-hosted Philippines PMTiles), same stack as Barbers.ph.
 * Shop = River store pin, customer = River 3D pin; the route is a teal line (dashed when it's a straight-line estimate).
 */
import { RiverMap, RIVER_STYLE_URL_V2026_10 } from "@river/map";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect } from "react";
import type { LatLng } from "../settings/PinMap";

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || RIVER_STYLE_URL_V2026_10;
const TEAL = "#0F8A8C";

function RouteLine({ map, path, dashed }: { map: MapLibreMap; path: LatLng[] | null; dashed?: boolean }) {
  useEffect(() => {
    const id = "lp-route";
    const data = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: (path ?? []).map((p) => [p.lng, p.lat]) } };
    const draw = () => {
      const src = map.getSource(id) as { setData?: (d: unknown) => void } | undefined;
      if (src?.setData) src.setData(data);
      else {
        map.addSource(id, { type: "geojson", data });
        map.addLayer({ id: `${id}-casing`, type: "line", source: id, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff", "line-width": 7 } });
        map.addLayer({ id, type: "line", source: id, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": TEAL, "line-width": 4, ...(dashed ? { "line-dasharray": [1.5, 1.5] } : {}) } });
      }
    };
    if (map.isStyleLoaded()) draw(); else map.once("load", draw);
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(map.getContainer());
    return () => { ro.disconnect(); };
  }, [map, path, dashed]);
  return null;
}

function Pin({ kind }: { kind: "shop" | "customer" }) {
  return kind === "customer" ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icons3d/pin.png" alt="Customer" draggable={false} style={{ width: 34, height: 44, objectFit: "contain", filter: "drop-shadow(0 4px 6px rgba(0,0,0,.2))" }} />
  ) : (
    <span aria-label="Your shop" className="inline-flex size-8 items-center justify-center rounded-full bg-ink text-[15px] shadow-card ring-[3px] ring-white">🏪</span>
  );
}

export function RiverRouteMap({ shop, customer, path, dashed, className }: { shop: LatLng | null; customer: LatLng | null; path: LatLng[] | null; dashed?: boolean; className?: string }) {
  const pts = [shop, customer].filter(Boolean) as LatLng[];
  const centre = customer ?? shop ?? { lat: 14.5995, lng: 120.9842 };
  const pins = [
    ...(shop ? [{ id: "shop", coords: { latitude: shop.lat, longitude: shop.lng }, data: "shop" as const }] : []),
    ...(customer ? [{ id: "customer", coords: { latitude: customer.lat, longitude: customer.lng }, data: "customer" as const }] : []),
  ];
  return (
    <div className={`relative overflow-hidden rounded-[20px] bg-grey-100 ${className ?? ""}`} data-testid="river-route-map">
      <RiverMap
        style={{ width: "100%", height: "100%" }}
        styleUrl={STYLE_URL}
        workerUrl="/maplibre/maplibre-gl-worker.mjs"
        center={{ latitude: centre.lat, longitude: centre.lng }}
        zoom={14}
        pins={pins}
        renderPin={(p) => <Pin kind={p.data as "shop" | "customer"} />}
        fitCoords={(path?.length ? path : pts).map((p) => ({ latitude: p.lat, longitude: p.lng }))}
        padding={{ top: 56, right: 40, bottom: 32, left: 40 }}
        gestures="cooperative"
        attribution={false}
      >
        {(map) => <RouteLine map={map} path={path} dashed={dashed} />}
      </RiverMap>
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" aria-label="Map data © OpenStreetMap contributors" className="absolute bottom-1.5 right-1.5 z-[2] inline-flex size-5 items-center justify-center rounded-full bg-white/85 text-[11px] font-bold text-ink-2 shadow-sm">ⓘ</a>
    </div>
  );
}
