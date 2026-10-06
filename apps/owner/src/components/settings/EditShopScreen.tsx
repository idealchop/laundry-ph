"use client";

import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Badge, Button, Card, Input } from "@river-apps/ui";
import type { Shop, ShopAddress, ShopLocation } from "@/data";
import { reverseGeocodePin } from "@/lib/geocode";
import { FocusHeader } from "@/components/FocusHeader";
import { useAction, useShop, useShopQuery } from "@/lib/shop";
import { SHOP_ABOUT_MAX, defaultShopAbout } from "@/lib/shop-about";
import { ErrorNote } from "../ui";
import { LocationPicker } from "./LocationPicker";
import { ShopPhotos } from "./ShopPhotos";

function profileKey(shop: Shop): string {
  const a = shop.address;
  const L = shop.location;
  return [shop.name, shop.ownerName, shop.about, a?.line1, a?.city, L?.lat, L?.lng, L?.formattedAddress].join("|");
}

/** Full-screen shop profile editor (name, map pin, photos). Address/area are derived from the pin. */
export function EditShopScreen() {
  const { shop, source, reload } = useShop();
  const [busy, setBusy] = useState(false);

  return (
    <>
      <FocusHeader
        title="Edit shop"
        backHref="/profile"
        trailing={
          <Button
            type="submit"
            form="edit-shop-form"
            size="sm"
            className="min-w-[4.5rem]"
            disabled={busy}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        }
      />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-10 pt-2">
        <ProfileEditor
          key={profileKey(shop)}
          shop={shop}
          source={source}
          reload={reload}
          onBusyChange={setBusy}
        />
        <ShopPhotos shop={shop} />
      </div>
    </>
  );
}

function ProfileEditor({
  shop,
  source,
  reload,
  onBusyChange,
}: {
  shop: Shop;
  source: ReturnType<typeof useShop>["source"];
  reload: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const { busy, error, run, setError } = useAction();
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(shop.name);
  const [location, setLocation] = useState<ShopLocation | null>(shop.location ?? null);
  /** null = untouched: show the stored blurb, or a personalised starter built from the shop's data. */
  const [aboutDraft, setAboutDraft] = useState<string | null>(null);
  const catalog = useShopQuery((s) => s.getCatalog());
  const serviceNames = (catalog.data?.services ?? []).map((sv) => sv.name);
  const about = aboutDraft ?? (shop.about?.trim() ? shop.about : defaultShopAbout(shop, serviceNames));
  const aboutId = useId();
  const readOnly = shop.sample === true && source.mode === "firebase";

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    const ok = await run(async (s) => {
      // Address fields are no longer edited by hand. Keep what's stored, and refresh area/address from
      // the pin when it moved (or they were never filled). A failed lookup leaves stored values as-is.
      let area = shop.area;
      let address: ShopAddress | null = shop.address ?? null;
      let geoFill = "";
      const prev = shop.location;
      const pinMoved = location ? !prev || prev.lat.toFixed(6) !== location.lat.toFixed(6) || prev.lng.toFixed(6) !== location.lng.toFixed(6) : false;
      if (location && (pinMoved || !area.trim() || !address)) {
        const geo = await reverseGeocodePin(location.lat, location.lng);
        if (geo) {
          geoFill = geo.formatted;
          if (geo.area) area = geo.area;
          if (geo.address) address = { ...geo.address, ...(shop.address?.line2 ? { line2: shop.address.line2 } : {}) };
        }
      }
      // Owner name is no longer edited here; resend the stored value untouched.
      const loc = location && geoFill && !location.formattedAddress ? { ...location, formattedAddress: geoFill } : location;
      await s.updateShopProfile({ name, area, ownerName: shop.ownerName, address, location: loc, about: about.slice(0, SHOP_ABOUT_MAX) });
      return true;
    }, "Sign in to save your shop profile and map pin.");
    if (ok) {
      setSaved(true);
      reload();
      router.push("/profile");
    }
  }

  return (
    <Card className="px-4 py-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <b className="text-[16px]">Shop profile</b>
          <p className="mt-0.5 text-[13px] font-medium text-muted">
            Your map pin helps River Mobile find your shop.
          </p>
        </div>
        {shop.location ? (
          <Badge variant="soft" size="sm" className="shrink-0">
            <MapPin size={12} className="mr-1 inline" />
            Pinned
          </Badge>
        ) : null}
      </div>

      {readOnly ? (
        <p className="rounded-tile bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">
          This is the shared demo shop — create your own shop to edit the profile and map pin.
        </p>
      ) : null}

      <form id="edit-shop-form" onSubmit={onSave} className="mt-3 grid gap-4 sm:grid-cols-2">
        <Input size="md" label="Shop name" containerClassName="sm:col-span-2" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} disabled={readOnly || busy} />
        <div className="flex flex-col sm:col-span-2">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <label htmlFor={aboutId} className="text-[14px] font-bold">About <span className="font-semibold text-muted">(optional)</span></label>
            <span className={`text-[12px] font-semibold tabular-nums ${about.length >= SHOP_ABOUT_MAX ? "text-ink" : "text-muted"}`} aria-live="polite">
              {about.length}/{SHOP_ABOUT_MAX}
            </span>
          </div>
          <textarea
            id={aboutId}
            value={about}
            onChange={(e) => setAboutDraft(e.target.value.slice(0, SHOP_ABOUT_MAX))}
            maxLength={SHOP_ABOUT_MAX}
            rows={5}
            disabled={readOnly || busy}
            placeholder="Tell River Mobile customers what makes your shop great."
            aria-describedby={`${aboutId}-hint`}
            className="min-h-[140px] resize-y rounded-tile bg-canvas px-4 py-3 text-[14px] font-medium leading-relaxed text-ink outline-none transition-shadow placeholder:text-subtle focus:bg-surface focus:ring-2 focus:ring-ink disabled:opacity-60"
          />
          <p id={`${aboutId}-hint`} className="mt-1.5 text-[12px] font-semibold text-muted">
            {aboutDraft === null && !shop.about?.trim() ? "A starter from your shop details. Edit it, or save as is." : "Shown on your River Mobile listing."}
          </p>
        </div>

        <div className="sm:col-span-2">
          <LocationPicker value={location} onChange={setLocation} disabled={readOnly || busy} />
        </div>

        {error ? <ErrorNote className="sm:col-span-2">{error}</ErrorNote> : null}
        {saved ? (
          <p className="sm:col-span-2 text-[13.5px] font-semibold text-ink">
            Saved. River Mobile customers will see your shop at this pin.
          </p>
        ) : null}

        <div className="sm:col-span-2">
          <Button type="submit" size="md" fullWidth disabled={readOnly || busy || name.trim().length < 2}>
            {busy ? "Saving…" : "Save shop profile"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
