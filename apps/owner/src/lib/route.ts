/** Shop → customer route for the booking map: OSRM public demo router, straight line when it fails. */

export type LatLng = { lat: number; lng: number };

export interface RouteInfo {
  /** Polyline from shop to customer. */
  path: LatLng[];
  distanceM: number;
  durationS: number;
  /** "road" from OSRM; "straight" is the fallback (distance as the crow flies, ETA estimated). */
  kind: "road" | "straight";
}

/** Great-circle distance in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Straight-line fallback: ~1.3× detour factor at ~20 km/h (city traffic, motorbike / car). */
export function straightRoute(from: LatLng, to: LatLng): RouteInfo {
  const d = haversineM(from, to);
  return { path: [from, to], distanceM: d, durationS: ((d * 1.3) / 20_000) * 3600, kind: "straight" };
}

const cache = new Map<string, Promise<RouteInfo>>();

export function fetchRoute(from: LatLng, to: LatLng): Promise<RouteInfo> {
  const key = [from.lat, from.lng, to.lat, to.lng].map((v) => v.toFixed(5)).join(",");
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (async (): Promise<RouteInfo> => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { code?: string; routes?: { distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }[] };
      const r = data.routes?.[0];
      const coords = r?.geometry?.coordinates;
      if (data.code !== "Ok" || !r || !coords?.length) throw new Error("no route");
      return { path: [from, ...coords.map(([lng, lat]) => ({ lat, lng })), to], distanceM: r.distance, durationS: r.duration, kind: "road" };
    } catch {
      return straightRoute(from, to);
    }
  })();
  cache.set(key, p);
  void p.then((r) => { if (r.kind === "straight") cache.delete(key); });
  return p;
}

export function formatDistance(m: number): string {
  return m < 950 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(m < 9_950 ? 1 : 0)} km`;
}

export function formatEta(s: number): string {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), r = min % 60;
  return r ? `${h} hr ${r} min` : `${h} hr`;
}

/** Google Maps directions link (no API key). */
export function googleDirectionsUrl(from: LatLng | null, to: LatLng): string {
  const origin = from ? `&origin=${from.lat},${from.lng}` : "";
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${to.lat},${to.lng}`;
}
