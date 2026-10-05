"use client";

import { CreditCard, LogOut, MapPin } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Avatar, Badge, Button, Card, Input, ListItem, Topbar } from "@river-apps/ui";
import type { Shop, ShopAddress, ShopLocation } from "@/data";
import { firestoreDatabaseId } from "@/lib/firebase/config";
import { useAuthGate } from "@/components/auth/AuthGateProvider";
import { planLabel } from "@/lib/plans";
import { signOut, useAuth } from "@/lib/auth";
import { useAction, useShop } from "@/lib/shop";
import { SampleNote } from "../SampleNote";
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

/** Shop profile (address + map pin), plan link, role and sign out. */
export function SettingsScreen() {
  const { shop, member, source, reload, isGuest } = useShop();
  const { user } = useAuth();
  const { openAuthCta, isAuthenticated } = useAuthGate();
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" title="Settings" subtitle={<>Shop profile, photos, address and plan <SampleNote className="ml-1 align-middle" /></>} />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="px-4 py-3.5">
          <b className="text-[16px]">Shop</b>
          <ListItem
            variant="row"
            className="mt-2"
            leading={<Avatar name={shop.ownerName || shop.name} preset={shop.ownerAvatar} size={44} />}
            title={shop.name}
            subtitle={`${shop.area || "No area set"} · ${planLabel(shop.tier, shop.planSource)}`}
            trailing={shop.sample ? <Badge variant="soft" size="sm">Demo shop</Badge> : undefined}
          />
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
            <dt className="font-semibold text-muted">Shop ID</dt>
            <dd className="font-mono">{shop.id}</dd>
            <dt className="font-semibold text-muted">Data</dt>
            <dd className="font-mono">{source.mode === "firebase" ? `Firestore · ${firestoreDatabaseId}` : "In-memory sample"}</dd>
            {shop.location ? (
              <>
                <dt className="font-semibold text-muted">Pin</dt>
                <dd className="font-mono">{shop.location.lat.toFixed(5)}, {shop.location.lng.toFixed(5)}</dd>
              </>
            ) : null}
          </dl>
        </Card>

        <Card className="px-4 py-3.5">
          <b className="text-[16px]">You</b>
          <p className="mt-2 text-[14px] font-semibold">{user?.phoneNumber ?? user?.email ?? user?.displayName ?? "Signed in"}</p>
          <p className="text-[13px] font-medium text-muted">Role: {member.role === "owner" ? "Owner" : "Staff"}</p>
          <Button className="mt-3" variant="secondary" size="md" href="/settings/billing" leadingIcon={<CreditCard size={18} />}>
            Plan & billing
          </Button>
          {isGuest || !isAuthenticated ? (
            <Button className="mt-2" size="md" onClick={() => openAuthCta("Sign in to sync your shop and save changes.")}>
              Sign up or log in
            </Button>
          ) : (
            <Button className="mt-2" variant="ghost" size="md" onClick={() => void signOut()} leadingIcon={<LogOut size={18} />}>
              Sign out
            </Button>
          )}
        </Card>

        <ProfileEditor key={profileKey(shop)} shop={shop} source={source} reload={reload} />
        <ShopPhotos shop={shop} />
      </div>
    </div>
  );
}

function ProfileEditor({
  shop,
  source,
  reload,
}: {
  shop: Shop;
  source: ReturnType<typeof useShop>["source"];
  reload: () => void;
}) {
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
    }
  }

  return (
    <Card className="px-4 py-3.5 lg:col-span-2">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <b className="text-[16px]">Shop profile</b>
          <p className="mt-0.5 text-[13px] font-medium text-muted">
            Address and map pin help River Mobile find your shop.
          </p>
        </div>
        {shop.location ? <Badge variant="soft" size="sm" className="shrink-0"><MapPin size={12} className="mr-1 inline" />Pinned</Badge> : null}
      </div>

      {readOnly ? (
        <p className="rounded-tile bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">
          This is the shared demo shop — create your own shop to edit the address and map pin.
        </p>
      ) : null}

      <form onSubmit={onSave} className="mt-3 grid gap-3 sm:grid-cols-2">
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
        {saved ? <p className="sm:col-span-2 text-[13.5px] font-semibold text-ink">Saved. River Mobile can use this pin once the Partner API ships.</p> : null}

        <div className="sm:col-span-2">
          <Button type="submit" size="md" disabled={readOnly || busy || name.trim().length < 2}>
            {busy ? "Saving…" : "Save shop profile"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
