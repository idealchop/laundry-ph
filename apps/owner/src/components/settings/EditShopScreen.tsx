"use client";

import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, Input } from "@river-apps/ui";
import type { Shop, ShopAddress, ShopLocation } from "@/data";
import { FocusHeader } from "@/components/FocusHeader";
import { useAction, useShop } from "@/lib/shop";
import { ErrorNote } from "../ui";
import { LocationPicker } from "./LocationPicker";
import { ShopPhotos } from "./ShopPhotos";

function profileKey(shop: Shop): string {
  const a = shop.address;
  const L = shop.location;
  return [
    shop.name, shop.area, shop.ownerName,
    a?.line1, a?.line2, a?.barangay, a?.city, a?.province, a?.postalCode,
    L?.lat, L?.lng, L?.formattedAddress,
  ].join("|");
}

/** Full-screen shop profile editor (address, map pin, photos). */
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
  const [area, setArea] = useState(shop.area);
  const [ownerName, setOwnerName] = useState(shop.ownerName);
  const [line1, setLine1] = useState(shop.address?.line1 ?? "");
  const [line2, setLine2] = useState(shop.address?.line2 ?? "");
  const [barangay, setBarangay] = useState(shop.address?.barangay ?? "");
  const [city, setCity] = useState(shop.address?.city ?? "");
  const [province, setProvince] = useState(shop.address?.province ?? "");
  const [postalCode, setPostalCode] = useState(shop.address?.postalCode ?? "");
  const [location, setLocation] = useState<ShopLocation | null>(shop.location ?? null);
  const readOnly = shop.sample === true && source.mode === "firebase";

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    const address: ShopAddress | null =
      line1.trim() || city.trim()
        ? {
            line1: line1.trim(),
            ...(line2.trim() ? { line2: line2.trim() } : {}),
            ...(barangay.trim() ? { barangay: barangay.trim() } : {}),
            city: city.trim() || area.trim(),
            ...(province.trim() ? { province: province.trim() } : {}),
            ...(postalCode.trim() ? { postalCode: postalCode.trim() } : {}),
          }
        : null;
    const ok = await run(async (s) => {
      await s.updateShopProfile({ name, area, ownerName, address, location });
      return true;
    }, "Sign in to save your shop address and map pin.");
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
            Address and map pin help River Mobile find your shop.
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
          This is the shared demo shop — create your own shop to edit the address and map pin.
        </p>
      ) : null}

      <form id="edit-shop-form" onSubmit={onSave} className="mt-3 grid gap-3 sm:grid-cols-2">
        <Input size="md" label="Shop name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} disabled={readOnly || busy} />
        <Input size="md" label="Area / neighbourhood" value={area} onChange={(e) => setArea(e.target.value)} maxLength={80} disabled={readOnly || busy} placeholder="e.g. Kapitolyo, Pasig" />
        <Input size="md" label="Owner first name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} maxLength={40} disabled={readOnly || busy} />
        <Input size="md" label="Street address" value={line1} onChange={(e) => setLine1(e.target.value)} maxLength={120} disabled={readOnly || busy} placeholder="Building / street" />
        <Input size="md" label="Address line 2" value={line2} onChange={(e) => setLine2(e.target.value)} maxLength={120} disabled={readOnly || busy} placeholder="Floor, unit (optional)" />
        <Input size="md" label="Barangay" value={barangay} onChange={(e) => setBarangay(e.target.value)} maxLength={80} disabled={readOnly || busy} />
        <Input size="md" label="City / municipality" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} disabled={readOnly || busy} />
        <Input size="md" label="Province" value={province} onChange={(e) => setProvince(e.target.value)} maxLength={80} disabled={readOnly || busy} placeholder="e.g. Metro Manila" />
        <Input size="md" label="Postal code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} maxLength={12} disabled={readOnly || busy} />

        <div className="sm:col-span-2">
          <LocationPicker value={location} onChange={setLocation} disabled={readOnly || busy} />
        </div>

        {error ? <ErrorNote className="sm:col-span-2">{error}</ErrorNote> : null}
        {saved ? (
          <p className="sm:col-span-2 text-[13.5px] font-semibold text-ink">
            Saved. River Mobile can use this pin once the Partner API ships.
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
