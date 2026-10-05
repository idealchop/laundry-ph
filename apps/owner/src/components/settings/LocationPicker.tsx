"use client";

/**
 * Map pin picker for the shop profile.
 * - Uses browser geolocation + OpenStreetMap embed (no API key).
 * - Optional Google Maps Places Autocomplete when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set.
 * Persists lat/lng + formattedAddress for River Mobile discovery.
 */
import { MapPin, Navigation } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input } from "@river-apps/ui";
import type { ShopLocation } from "@/data";
import { FieldLabel } from "../kit-extensions";

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name?.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

function osmEmbed(lat: number, lng: number): string {
  const d = 0.008;
  const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export interface LocationPickerProps {
  value: ShopLocation | null;
  onChange: (next: ShopLocation | null) => void;
  disabled?: boolean;
}

/** Remount when the saved pin identity changes so local fields reset without an effect. */
export function LocationPicker({ value, onChange, disabled }: LocationPickerProps) {
  const key = value ? `${value.lat.toFixed(6)},${value.lng.toFixed(6)}|${value.formattedAddress}` : "empty";
  return <LocationPickerFields key={key} value={value} onChange={onChange} disabled={disabled} />;
}

function LocationPickerFields({ value, onChange, disabled }: LocationPickerProps) {
  const [latStr, setLatStr] = useState(value ? String(value.lat) : "");
  const [lngStr, setLngStr] = useState(value ? String(value.lng) : "");
  const [label, setLabel] = useState(value?.formattedAddress ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const placesId = "laundry-places-search";
  const googleLoaded = useRef(false);

  const apply = useCallback(
    async (lat: number, lng: number, formatted?: string, placeId?: string) => {
      setBusy(true);
      setErr(null);
      try {
        const formattedAddress = formatted?.trim() || (await reverseGeocode(lat, lng));
        const next: ShopLocation = { lat, lng, formattedAddress, ...(placeId ? { placeId } : {}) };
        setLatStr(String(lat));
        setLngStr(String(lng));
        setLabel(formattedAddress);
        onChange(next);
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  useEffect(() => {
    if (!GOOGLE_KEY || googleLoaded.current || disabled) return;
    type Autocomplete = {
      addListener: (e: string, cb: () => void) => void;
      getPlace: () => { geometry?: { location?: { lat: () => number; lng: () => number } }; formatted_address?: string; place_id?: string };
    };
    const boot = () => {
      const el = document.getElementById(placesId) as HTMLInputElement | null;
      const g = (window as unknown as { google?: { maps?: { places?: { Autocomplete: new (el: HTMLInputElement, opts: object) => Autocomplete } } } }).google;
      if (!g?.maps?.places || !el) return;
      googleLoaded.current = true;
      const ac = new g.maps.places.Autocomplete(el, {
        fields: ["geometry", "formatted_address", "place_id"],
        componentRestrictions: { country: "ph" },
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        const loc = place.geometry?.location;
        if (!loc) return;
        void apply(loc.lat(), loc.lng(), place.formatted_address, place.place_id);
      });
    };
    const existing = document.querySelector<HTMLScriptElement>("script[data-laundry-maps]");
    if (existing) {
      if ((window as unknown as { google?: unknown }).google) boot();
      else existing.addEventListener("load", boot);
      return;
    }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&libraries=places`;
    s.async = true;
    s.dataset.laundryMaps = "1";
    s.onload = boot;
    document.head.appendChild(s);
  }, [apply, disabled]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setErr("This browser can’t share your location. Enter lat/lng or search instead.");
      return;
    }
    setBusy(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => void apply(pos.coords.latitude, pos.coords.longitude),
      () => {
        setBusy(false);
        setErr("Couldn’t get your location. Allow location access, or drop a pin manually.");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  function commitManual() {
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setErr("Enter valid latitude and longitude numbers.");
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setErr("Latitude must be −90…90 and longitude −180…180.");
      return;
    }
    void apply(lat, lng, label || undefined);
  }

  const pin = value;

  return (
    <div className="flex flex-col gap-3">
      <FieldLabel aside="For River Mobile">Map pin</FieldLabel>
      {GOOGLE_KEY ? (
        <div className="flex flex-col">
          <label htmlFor={placesId} className="mb-2 text-[14px] font-bold">Search address (Google)</label>
          <input
            id={placesId}
            type="text"
            disabled={disabled || busy}
            placeholder="Start typing a Philippine address…"
            className="h-[46px] rounded-tile bg-canvas px-4 text-[14px] font-semibold outline-none focus:bg-surface focus:ring-2 focus:ring-ink"
            autoComplete="off"
          />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" leadingIcon={<Navigation size={16} />} onClick={useMyLocation} disabled={disabled || busy}>
          Use my location
        </Button>
        {pin ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)} disabled={disabled || busy}>
            Clear pin
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input size="md" label="Latitude" inputMode="decimal" value={latStr} onChange={(e) => setLatStr(e.target.value)} disabled={disabled || busy} placeholder="14.5704" />
        <Input size="md" label="Longitude" inputMode="decimal" value={lngStr} onChange={(e) => setLngStr(e.target.value)} disabled={disabled || busy} placeholder="121.0573" />
      </div>
      <Input
        size="md"
        label="Formatted address"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        disabled={disabled || busy}
        placeholder="Street, barangay, city"
        leadingIcon={<MapPin size={18} strokeWidth={1.75} />}
      />
      <Button type="button" size="sm" variant="secondary" onClick={commitManual} disabled={disabled || busy}>
        {busy ? "Updating pin…" : "Set pin from coordinates"}
      </Button>
      {err ? <p role="alert" className="text-[13px] font-semibold text-ink">⚠︎ {err}</p> : null}
      {pin ? (
        <div className="overflow-hidden rounded-[18px] border border-grey-200 bg-grey-50">
          <iframe title="Shop map pin" className="h-[200px] w-full border-0" src={osmEmbed(pin.lat, pin.lng)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <p className="px-3 py-2 text-[12.5px] font-semibold text-muted">
            {pin.formattedAddress || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`}
            <span className="mt-0.5 block font-mono text-[11.5px] opacity-80">{pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}</span>
          </p>
        </div>
      ) : (
        <p className="rounded-[18px] bg-grey-100 px-4 py-3 text-[13.5px] font-medium text-muted">
          No pin yet. River Mobile needs a map location to show your shop nearby.
          {!GOOGLE_KEY ? " Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for Places search; OpenStreetMap works without a key." : null}
        </p>
      )}
    </div>
  );
}
