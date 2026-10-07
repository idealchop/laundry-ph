import type { ShopAddress } from "@/data";

/** What a map pin resolves to: the full label plus the readable bits River Mobile lists. */
export interface PinAddress {
  /** Full one-line label (Nominatim display_name), or "lat, lng" when the lookup fails. */
  formatted: string;
  /** Short "Barangay/area, City" label, e.g. "Kapitolyo, Pasig". Empty when unknown. */
  area: string;
  /** Structured address, or null when the lookup has no street or city. */
  address: ShopAddress | null;
}

type NominatimAddress = Partial<Record<
  "house_number" | "road" | "building" | "amenity" | "shop" | "neighbourhood" | "quarter" | "suburb" | "village" | "hamlet"
  | "city_district" | "city" | "town" | "municipality" | "county" | "state" | "region" | "postcode",
  string
>>;

const cache = new Map<string, Promise<PinAddress | null>>();
const keyOf = (lat: number, lng: number) => `${lat.toFixed(6)},${lng.toFixed(6)}`;
const clean = (v?: string) => (v ?? "").trim();
const strip = (v: string) => v.replace(/^City of\s+/i, "").replace(/\s+City$/i, "").trim();

/** Turn Nominatim address parts into the shop's area + structured address (PH-friendly field picks). */
export function toPinAddress(displayName: string, a: NominatimAddress): Omit<PinAddress, "formatted"> & { formatted: string } {
  const street = [clean(a.house_number), clean(a.road)].filter(Boolean).join(" ");
  const line1 = street || clean(a.building) || clean(a.amenity) || clean(a.shop);
  const barangay = clean(a.quarter) || clean(a.suburb) || clean(a.village) || clean(a.neighbourhood) || clean(a.hamlet);
  const city = clean(a.city) || clean(a.town) || clean(a.municipality) || clean(a.city_district);
  const province = clean(a.state) || clean(a.region) || clean(a.county);
  const postalCode = clean(a.postcode);
  const area = [barangay, city ? strip(city) : ""].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(", ");
  const address: ShopAddress | null = line1 || city
    ? {
        line1: line1 || barangay || city,
        ...(barangay ? { barangay } : {}),
        city: city || barangay,
        ...(province && province !== city ? { province } : {}),
        ...(postalCode ? { postalCode } : {}),
      }
    : null;
  return { formatted: displayName.trim(), area, address };
}

/**
 * Reverse-geocode a pin with OpenStreetMap Nominatim (no API key; already used by the map pin picker).
 * Cached per coordinate so the picker and the save step share one request. Resolves null on failure.
 */
export function reverseGeocodePin(lat: number, lng: number): Promise<PinAddress | null> {
  const key = keyOf(lat, lng);
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal }).finally(() => clearTimeout(timer));
      if (!res.ok) return null;
      const data = (await res.json()) as { display_name?: string; address?: NominatimAddress };
      if (!data.display_name && !data.address) return null;
      return toPinAddress(data.display_name ?? "", data.address ?? {});
    } catch {
      return null;
    }
  })();
  cache.set(key, p);
  // Don't pin failures in the cache; a later save can retry.
  void p.then((r) => { if (!r) cache.delete(key); });
  return p;
}

const forwardCache = new Map<string, Promise<{ lat: number; lng: number } | null>>();

/**
 * Forward-geocode a free-text address with Nominatim (PH only). Used when a booking has an address but no pin.
 * Cached per address; failures aren't cached. Resolves null when nothing is found.
 */
export function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const q = address.trim();
  if (!q) return Promise.resolve(null);
  const hit = forwardCache.get(q);
  if (hit) return hit;
  const p = (async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ph&accept-language=en&q=${encodeURIComponent(q)}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal }).finally(() => clearTimeout(timer));
      if (!res.ok) return null;
      const rows = (await res.json()) as { lat?: string; lon?: string }[];
      const lat = Number(rows[0]?.lat), lng = Number(rows[0]?.lon);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    } catch {
      return null;
    }
  })();
  forwardCache.set(q, p);
  void p.then((r) => { if (!r) forwardCache.delete(q); });
  return p;
}
