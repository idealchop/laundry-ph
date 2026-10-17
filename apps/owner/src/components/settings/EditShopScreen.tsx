"use client";

import { ChevronLeft, ImagePlus, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Badge, Card, Input, cn } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import type { Shop, ShopAddress, ShopLocation } from "@/data";
import { fileToDataUrl } from "@/components/community/posts";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import { reverseGeocodePin } from "@/lib/geocode";
import { useAction, useShop, useShopQuery } from "@/lib/shop";
import { SHOP_ABOUT_MAX, defaultShopAbout } from "@/lib/shop-about";
import { locationCount } from "@/lib/format";
import { clampLocations, useShopMark } from "@/lib/shop-mark";
import { useShopLocations } from "@/lib/shop-locations";
import { ErrorNote } from "../ui";
import { LocationPicker } from "./LocationPicker";
import { ShopPhotos } from "./ShopPhotos";

function profileKey(shop: Shop): string {
  const a = shop.address;
  const L = shop.location;
  return [shop.name, shop.ownerName, shop.about, a?.line1, a?.city, L?.lat, L?.lng, L?.formattedAddress].join("|");
}

/** Full-screen shop profile editor: name, logo, about, map pin, and photos. */
export function EditShopScreen() {
  const { shop, source, reload, isGuest } = useShop();
  const { isAuthenticated } = useAuthGate();
  const router = useRouter();
  const mark = useShopMark(shop.id, Math.max(1, locationCount(shop.area, Boolean(shop.location))));
  const signedIn = isAuthenticated && !isGuest;

  useEffect(() => {
    if (signedIn) return;
    router.replace("/profile");
  }, [signedIn, router]);

  if (!signedIn) return null;

  return mark.ready ? (
    <ProfileEditor key={profileKey(shop)} shop={shop} source={source} reload={reload} mark={mark} />
  ) : (
    <EditorBar dirty={false} busy={false} hold="" onBack={() => router.push("/profile")} />
  );
}

function EditorBar({ dirty, busy, hold, onBack }: { dirty: boolean; busy: boolean; hold: string; onBack: () => void }) {
  return (
    <>
      <div className="flex h-14 flex-none items-center justify-between gap-2 px-5 pt-1">
        <button type="button" aria-label="Back" onClick={onBack} className="inline-flex size-11 flex-none items-center justify-center rounded-full bg-grey-100 text-ink">
          <ChevronLeft size={22} strokeWidth={1.75} />
        </button>
        <span className="truncate text-[15px] font-bold">Update shop</span>
        <Button type="submit" form="edit-shop-form" size="sm" className="min-w-[4.5rem]" disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
      {hold ? <p className="px-5 pb-1 text-[13px] font-semibold">{hold}</p> : null}
    </>
  );
}

function ProfileEditor({
  shop,
  source,
  reload,
  mark,
}: {
  shop: Shop;
  source: ReturnType<typeof useShop>["source"];
  reload: () => void;
  mark: ReturnType<typeof useShopMark>;
}) {
  const router = useRouter();
  const { enabled } = useShopLocations();
  const { busy, error, run, setError } = useAction();
  const logoRef = useRef<HTMLInputElement>(null);
  const [hold, setHold] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [name, setName] = useState(shop.name);
  const [logo, setLogo] = useState(mark.logoUrl);
  const [locations, setLocations] = useState(String(mark.locations));
  const [location, setLocation] = useState<ShopLocation | null>(shop.location ?? null);
  const [aboutDraft, setAboutDraft] = useState<string | null>(shop.about?.trim() ? shop.about : null);
  const catalog = useShopQuery((s) => s.getCatalog());
  const serviceNames = (catalog.data?.services ?? []).map((sv) => sv.name);
  const about = aboutDraft ?? (shop.about?.trim() ? shop.about : defaultShopAbout(shop, serviceNames));
  const aboutId = useId();
  const readOnly = shop.sample === true && source.mode === "firebase";
  const pinSame = samePin(location, shop.location ?? null);
  const dirty = !readOnly && (
    name.trim() !== shop.name
    || logo !== mark.logoUrl
    || !pinSame
    || (aboutDraft !== null && about !== (shop.about ?? ""))
    || (!enabled && clampLocations(locations) !== mark.locations)
  );
  const working = busy || logoBusy;

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function leave(href: string) {
    if (dirty) {
      setHold("Save your changes before going back.");
      return;
    }
    router.push(href);
  }

  async function onLogo(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setError(null);
    setLogoBusy(true);
    try {
      setLogo(await fileToDataUrl(file, 480, 0.82));
      setHold("");
    } catch {
      setError("Couldn’t read that logo. Try a smaller image.");
    } finally {
      setLogoBusy(false);
      if (logoRef.current) logoRef.current.value = "";
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setHold("");
    setError(null);
    const ok = await run(async (s) => {
      let area = shop.area;
      let address: ShopAddress | null = shop.address ?? null;
      let geoFill = "";
      const prev = shop.location;
      const pinMoved = location ? !prev || prev.lat.toFixed(6) !== location.lat.toFixed(6) || prev.lng.toFixed(6) !== location.lng.toFixed(6) : false;
      if (!enabled && location && (pinMoved || !area.trim() || !address)) {
        const geo = await reverseGeocodePin(location.lat, location.lng);
        if (geo) {
          geoFill = geo.formatted;
          if (geo.area) area = geo.area;
          if (geo.address) address = { ...geo.address, ...(shop.address?.line2 ? { line2: shop.address.line2 } : {}) };
        }
      }
      const loc = !enabled && location && geoFill && !location.formattedAddress ? { ...location, formattedAddress: geoFill } : (enabled ? shop.location ?? null : location);
      await s.updateShopProfile({
        name,
        area,
        ownerName: shop.ownerName,
        address: enabled ? (shop.address ?? null) : address,
        location: loc,
        about: about.slice(0, SHOP_ABOUT_MAX),
      });
      mark.save({ logoUrl: logo, locations: clampLocations(locations) });
      return true;
    }, "Sign in to save your shop profile and map pin.");
    if (ok) {
      reload();
      router.push("/profile");
    }
  }

  return (
    <>
      <EditorBar dirty={dirty} busy={working} hold={hold} onBack={() => leave("/profile")} />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-10 pt-2">
        <Card className="px-4 py-3.5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <b className="text-[16px]">Shop profile</b>
              <p className="mt-0.5 text-[13px] font-medium text-muted">Your map pin helps customers find your shop.</p>
            </div>
            {location ? (
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

          <form id="edit-shop-form" onSubmit={onSave} className="mt-3 grid gap-4">
            <div className="flex items-end gap-3">
              <div className="flex flex-none flex-col items-center">
                <span className="mb-2 text-[14px] font-bold">Logo</span>
                <button
                  type="button"
                  aria-label={logo ? "Change logo" : "Upload logo"}
                  disabled={working || readOnly}
                  onClick={() => logoRef.current?.click()}
                  className="flex size-14 items-center justify-center overflow-hidden rounded-full bg-grey-100 ring-1 ring-line"
                >
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt="" className="size-full object-cover" />
                  ) : (
                    <ImagePlus size={20} className="text-muted" />
                  )}
                </button>
                <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={working || readOnly} onChange={(e) => void onLogo(e.target.files?.[0])} />
              </div>
              <div className="min-w-0 flex-1">
                <Input size="md" label="Shop name" value={name} onChange={(e) => { setName(e.target.value); setHold(""); }} required minLength={2} maxLength={80} disabled={readOnly || working} />
              </div>
            </div>
            {enabled ? (
              <p className="text-[12.5px] font-semibold text-muted">This name is the brand on every shop. Each shop’s pin is set under Shops.</p>
            ) : (
              <>
                <Input size="md" label="Locations" inputMode="numeric" value={locations} onChange={(e) => setLocations(e.target.value.replace(/[^\d]/g, "").slice(0, 2))} disabled={readOnly || working} />
                <p className="-mt-2 text-[12.5px] font-semibold text-muted">How many shops you run. This shows on your profile.</p>
              </>
            )}
            <AboutField id={aboutId} about={about} starter={aboutDraft === null && !shop.about?.trim()} disabled={readOnly || working} onChange={(value) => setAboutDraft(value)} />
            {enabled ? (
              <Button type="button" variant="secondary" size="md" onClick={() => leave("/settings/shops")}>Shops</Button>
            ) : (
              <LocationPicker value={location} onChange={setLocation} disabled={readOnly || working} />
            )}
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <Button type="submit" size="md" fullWidth disabled={readOnly || working || !dirty || name.trim().length < 2}>
              {working ? "Saving…" : "Save shop profile"}
            </Button>
          </form>
        </Card>
        <ShopPhotos shop={shop} />
      </div>
    </>
  );
}

function samePin(next: ShopLocation | null, saved: ShopLocation | null) {
  if (!next && !saved) return true;
  if (!next || !saved) return false;
  return next.lat.toFixed(6) === saved.lat.toFixed(6) && next.lng.toFixed(6) === saved.lng.toFixed(6);
}

function AboutField({ id, about, starter, disabled, onChange }: { id: string; about: string; starter: boolean; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[14px] font-bold">About <span className="font-semibold text-muted">(optional)</span></label>
        <span className={cn("text-[12px] font-semibold tabular-nums", about.length >= SHOP_ABOUT_MAX ? "text-ink" : "text-muted")} aria-live="polite">
          {about.length}/{SHOP_ABOUT_MAX}
        </span>
      </div>
      <textarea
        id={id}
        value={about}
        onChange={(e) => onChange(e.target.value.slice(0, SHOP_ABOUT_MAX))}
        maxLength={SHOP_ABOUT_MAX}
        rows={5}
        disabled={disabled}
        placeholder="Tell customers what makes your shop great."
        className="min-h-[140px] resize-y rounded-tile bg-canvas px-4 py-3 text-[14px] font-medium leading-relaxed text-ink outline-none transition-shadow placeholder:text-subtle focus:bg-surface focus:ring-2 focus:ring-ink disabled:opacity-60"
      />
      <p className="mt-1.5 text-[12px] font-semibold text-muted">
        {starter ? "A starter from your shop details. Edit it, or save as is." : "Shown on your shop listing."}
      </p>
    </div>
  );
}
