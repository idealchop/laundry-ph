"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Plus } from "lucide-react";
import { AppLoader } from "@/components/common/AppLoader";
import { bookingUrl } from "@/lib/shop-qr";
import { Input } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { reverseGeocodePin } from "@/lib/geocode";
import { HOME_LOCATION_ID, ensureBranchLink, readLocationStore, useShopLocations } from "@/lib/shop-locations";
import { useShop } from "@/lib/shop";
import { publishStaffLink } from "@/lib/staff-links";
import type { ShopLocation } from "@/data";
import { PageBack } from "../shell/PageBack";
import { LocationPicker } from "./LocationPicker";

export function CopyShopLink({ id }: { id: string }) {
  const [label, setLabel] = useState("Copy link");
  const { shop, source, isGuest } = useShop();
  return (
    <Button size="sm" variant="secondary" onClick={async () => {
      const path = ensureBranchLink(id);
      if (!path) return;
      // Publish the token so the staff page (server) can find this shop. Guests/fixtures stay local.
      const branch = readLocationStore().branches.find((b) => b.id === id);
      if (branch && source.mode === "firebase" && !isGuest) {
        try { await publishStaffLink(shop, branch); } catch (e) { setLabel((e as Error).message); return; }
      }
      const url = `${window.location.origin}${path}`;
      navigator.clipboard?.writeText(url).then(
        () => {
          setLabel("Copied");
          window.setTimeout(() => setLabel("Copy link"), 1500);
        },
        () => setLabel(path),
      );
    }}>{label}</Button>
  );
}

/** Manage locations (Barbers.ph parity): one card per shop with its QR and Edit shop; add in a sheet; on/off with a confirm. */
export function ShopsScreen() {
  const { shop } = useShop();
  const router = useRouter();
  const { enabled, ready, branches, enable, disable, addBranch, setView } = useShopLocations();
  const [name, setName] = useState("");
  const [pin, setPin] = useState<ShopLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmMulti, setConfirmMulti] = useState<"on" | "off" | null>(null);

  async function onAdd() {
    setError("");
    if (!pin) { setError("Drop a pin so this shop has an address."); return; }
    setBusy(true);
    try {
      const geo = await reverseGeocodePin(pin.lat, pin.lng);
      const address = geo?.formatted || pin.formattedAddress;
      const area = geo?.area || address;
      const result = addBranch(shop.name, { name, address, area, location: { ...pin, formattedAddress: address } });
      if (result.error || !result.branch) { setError(result.error || "Couldn’t add that shop."); return; }
      setName(""); setPin(null); setAdding(false);
      setNote(`${result.branch.name} is ready. Open Edit shop to copy its staff link.`);
    } catch {
      setError("Couldn’t look up that pin. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <AppLoader />;
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[720px] lg:px-[30px] lg:pt-6">
      <header className="mt-1 px-1">
        <div className="flex items-center gap-1">
          <PageBack fallback="/profile" />
          <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Manage locations</h1>
        </div>
        <p className="mt-0.5 pl-11 text-[14px] font-semibold text-muted">{enabled ? "Each shop has its own QR. Tap Edit shop for its details, pin and staff link." : "Turn this on when you run more than one shop."}</p>
      </header>
      {note ? <p className="mt-3 rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold" role="status">{note}</p> : null}
      {error && !adding ? <p className="mt-3 text-[13.5px] font-semibold">{error}</p> : null}

      {enabled ? (
        <>
          <ul className="mt-4 flex flex-col gap-3">
            {branches.map((branch) => (
              <li key={branch.id} className="rounded-card bg-surface px-3.5 py-3.5 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <b className="block text-[16px]">{branch.name}{branch.id === HOME_LOCATION_ID ? <span className="ml-1.5 text-[12px] font-semibold text-muted">Main</span> : null}</b>
                    <p className="mt-0.5 text-[13px] font-medium text-muted">{branch.area || branch.address || "No pin yet"}</p>
                    <Link href={`/settings/shops/edit?id=${encodeURIComponent(branch.id)}`} className="mt-3 inline-flex h-8 items-center rounded-pill px-3.5 text-[12.5px] font-bold ring-1 ring-ink">Edit shop</Link>
                  </div>
                  <BranchQr shopId={shop.id} branchId={branch.id} name={branch.name} onOpen={() => { setView(branch.id); router.push("/qr"); }} />
                </div>
              </li>
            ))}
          </ul>
          <Button className="mt-4" fullWidth variant="secondary" leadingIcon={<Plus size={17} strokeWidth={2.2} />} onClick={() => { setError(""); setAdding(true); }}>Add another shop</Button>
          <div className="mt-6 rounded-card bg-surface px-4 py-4 shadow-card">
            <b className="block text-[15px]">Multiple shops is on</b>
            <p className="mt-1 text-[13px] font-medium text-muted">You run {branches.length} location{branches.length === 1 ? "" : "s"} from this account.</p>
            <button type="button" onClick={() => setConfirmMulti("off")} className="mt-3 h-10 w-full rounded-pill border-2 border-[#D92D20] text-[14px] font-bold text-[#D92D20]">Turn off multiple shops</button>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card">
          <b className="block text-[16px]">One shop</b>
          <p className="mt-1 text-[13.5px] font-medium text-muted">Turn this on when you run more than one shop. The shop you have now becomes the first one.</p>
          <Button className="mt-4" fullWidth onClick={() => setConfirmMulti("on")}>Turn on multiple shops</Button>
        </div>
      )}

      {adding ? (
        <Sheet title="Add another shop" subtitle="Name it and drop a pin" onClose={() => { if (!busy) setAdding(false); }}>
          <div className="flex flex-col gap-3 pt-1">
            <Input label="Shop name" placeholder="Shaw" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
            <LocationPicker value={pin} onChange={setPin} disabled={busy} />
            {error ? <p className="text-[13.5px] font-semibold" role="alert">{error}</p> : null}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => setAdding(false)}>Back</Button>
            <Button className="flex-1" loading={busy} disabled={busy || name.trim().length < 2} onClick={() => void onAdd()}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </Sheet>
      ) : null}
      {confirmMulti ? (
        <Sheet title={confirmMulti === "on" ? "Turn on multiple shops?" : "Turn off multiple shops?"} onClose={() => setConfirmMulti(null)}>
          {confirmMulti === "on" ? (
            <ul className="grid gap-1.5 text-[13.5px] font-medium text-ink-2">
              <li>• The shop you have now becomes your first location.</li>
              <li>• You can add more locations, each with its own address, staff link and booking QR.</li>
              <li>• Home, Orders and Sales get a location switcher.</li>
            </ul>
          ) : (
            <ul className="grid gap-1.5 text-[13.5px] font-medium text-ink-2">
              <li>• Your other locations are hidden. Home, Orders, links and Sales go back to the first shop.</li>
              <li>• Nothing is deleted: locations, orders and sales stay saved and come back if you turn it on again.</li>
            </ul>
          )}
          <div className="mt-5 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmMulti(null)}>Cancel</Button>
            {confirmMulti === "on" ? (
              <Button className="flex-1" onClick={() => { enable(shop); setConfirmMulti(null); setNote("Multiple shops is on. This shop is the first one."); }}>Turn on</Button>
            ) : (
              <button type="button" onClick={() => { disable(); setConfirmMulti(null); setNote("Multiple shops is off. This phone is back on the first shop."); }} className="h-11 flex-1 rounded-pill bg-[#D92D20] px-4 text-[14px] font-bold text-white">Turn off</button>
            )}
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

/** Bottom sheet (Barbers BottomSheet look). */
export function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92dvh] w-full max-w-[440px] overflow-y-auto rounded-t-[28px] bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5 shadow-card sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <b className="block text-[19px] tracking-[-0.02em]">{title}</b>
        {subtitle ? <p className="mt-0.5 text-[13px] font-semibold text-muted">{subtitle}</p> : null}
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

/** This shop's booking QR on its card. Tap to open the printable QR page for that shop. */
function BranchQr({ shopId, branchId, name, onOpen }: { shopId: string; branchId: string; name: string; onOpen: () => void }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    const url = bookingUrl(window.location.origin, shopId, branchId);
    void QRCode.toDataURL(url, { margin: 1, width: 184, color: { dark: "#0A0A0A", light: "#FFFFFF" } }).then((d) => { if (live) setSrc(d); });
    return () => { live = false; };
  }, [shopId, branchId]);
  return (
    <button type="button" onClick={onOpen} className="flex-none rounded-[12px] bg-white p-1 ring-1 ring-line" aria-label={`Booking QR for ${name}. Open to print or share.`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
      {src ? <img src={src} alt="" width={92} height={92} className="block size-[92px]" /> : <span className="block size-[92px]" />}
    </button>
  );
}
