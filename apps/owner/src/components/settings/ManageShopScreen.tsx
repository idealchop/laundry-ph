"use client";

import { Card, Input } from "@river-apps/ui";
import { ChevronRight, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AppLoader } from "@/components/common/AppLoader";
import { Button } from "@/components/common/Button";
import type { ShopLocation } from "@/data";
import { reverseGeocodePin } from "@/lib/geocode";
import { HOME_LOCATION_ID, useShopLocations, type ShopBranch } from "@/lib/shop-locations";
import { PageBack } from "../shell/PageBack";
import { LocationPicker } from "./LocationPicker";
import { StaffSection } from "./StaffSection";

/** Manage Shop (Barbers.ph parity, no commission): one location's details, pin, staff link and price list. */
export function ManageShopScreen() {
  const id = useSearchParams().get("id") ?? HOME_LOCATION_ID;
  const shops = useShopLocations();
  const branch = shops.branches.find((b) => b.id === id);
  if (!shops.ready) return <AppLoader />;
  if (!branch) {
    return (
      <div className="mx-auto max-w-[402px] px-4 pt-6">
        <div className="flex items-center gap-1"><PageBack fallback="/settings/shops" /><h1 className="text-[26px] font-extrabold">Manage Shop</h1></div>
        <p className="mt-3 text-[14px] font-semibold text-muted">This shop isn’t in your locations.</p>
      </div>
    );
  }
  return <Editor key={branch.id} branch={branch} />;
}

function Editor({ branch }: { branch: ShopBranch }) {
  const router = useRouter();
  const { updateBranch, removeBranch } = useShopLocations();
  const [name, setName] = useState(branch.name);
  const [phone, setPhone] = useState(branch.phone ?? "");
  const [about, setAbout] = useState(branch.about ?? "");
  const [address, setAddress] = useState(branch.address ?? "");
  const [pin, setPin] = useState<ShopLocation | null>(branch.location);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const pinMoved = (pin?.lat ?? 0) !== (branch.location?.lat ?? 0) || (pin?.lng ?? 0) !== (branch.location?.lng ?? 0);
  const dirty = name.trim() !== branch.name || phone !== (branch.phone ?? "") || about !== (branch.about ?? "") || address !== (branch.address ?? "") || pinMoved;

  async function save() {
    setBusy(true); setNote("");
    try {
      let area = branch.area, addr = address.trim(), loc = pin;
      if (pin && pinMoved) {
        const geo = await reverseGeocodePin(pin.lat, pin.lng).catch(() => null);
        if (geo?.area) area = geo.area;
        const f = pin.formattedAddress || geo?.formatted || "";
        if (f) { loc = { ...pin, formattedAddress: f }; if (addr === (branch.address ?? "")) addr = f; }
      }
      updateBranch(branch.id, { name: name.trim() || branch.name, phone: phone.trim(), about: about.trim(), address: addr, area, location: loc });
      setAddress(addr);
      setNote("Saved.");
      setEditOpen(false);
    } finally { setBusy(false); }
  }

  function remove() {
    const err = removeBranch(branch.id);
    if (err) { setNote(err); setConfirm(false); return; }
    router.push("/settings/shops");
  }

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-10 pt-4 lg:max-w-[720px] lg:px-[30px] lg:pt-6">
      <div className="flex items-center gap-1">
        <PageBack fallback="/settings/shops" />
        <div className="min-w-0">
          <h1 className="truncate text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]">Manage Shop</h1>
          <p className="truncate text-[13.5px] font-semibold text-muted">{branch.name}</p>
        </div>
      </div>
      {note ? <p className="mt-3 rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold" role="status">{note}</p> : null}

      <Link href="/profile/services" className="mt-4 flex items-center gap-3 rounded-card bg-surface px-4 py-3.5 shadow-card">
        <span className="min-w-0 flex-1"><b className="block text-[15px]">Services &amp; prices</b><small className="block text-[13px] font-medium text-muted">Wash, dry, fold, add-ons and clothes types</small></span>
        <ChevronRight size={18} className="flex-none text-subtle" aria-hidden />
      </Link>

      <StaffSection branch={branch} />

      <section className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card" aria-label="Shop details">
        <div className="flex items-start justify-between gap-3">
          <b className="text-[16px]">Shop details</b>
          <button type="button" onClick={() => setEditOpen(true)} aria-label="Update shop details"
            className="inline-flex h-9 flex-none items-center gap-1.5 rounded-pill bg-grey-100 px-3 text-[13px] font-bold"><Pencil size={15} strokeWidth={2} />Update</button>
        </div>
        <dl className="mt-2 grid gap-2.5 text-[14px]">
          {([["Shop name", branch.name], ["Address", branch.address || branch.area], ["Shop phone", branch.phone], ["About", branch.about]] as const).map(([k, v]) => (
            <div key={k}><dt className="text-[12px] font-semibold text-muted">{k}</dt><dd className="font-semibold">{v || <span className="text-muted">Not set</span>}</dd></div>
          ))}
          <div><dt className="text-[12px] font-semibold text-muted">Map pin</dt><dd className="font-semibold">{branch.location ? (branch.location.formattedAddress || "Pinned") : <span className="text-muted">No pin yet</span>}</dd></div>
        </dl>
      </section>

      {branch.id === HOME_LOCATION_ID ? null : (
        <Card className="mt-6 px-4 py-4">
          <b className="block text-[15px]">Remove this shop</b>
          <p className="mt-1 text-[13px] font-medium text-muted">Past orders stay.</p>
          {confirm ? (
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setConfirm(false)}>Keep it</Button>
              <button type="button" onClick={remove} className="h-10 flex-1 rounded-pill bg-[#D92D20] px-4 text-[14px] font-bold text-white">Yes, remove {branch.name}</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="mt-3 h-10 w-full rounded-pill border-2 border-[#D92D20] text-[14px] font-bold text-[#D92D20]">Remove shop</button>
          )}
        </Card>
      )}

      {editOpen ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-canvas" role="dialog" aria-modal="true" aria-label="Edit shop details">
          <div className="mx-auto w-full max-w-[402px] px-4 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-4">
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Close" onClick={() => setEditOpen(false)} className="inline-flex size-11 items-center justify-center rounded-full bg-grey-100"><X size={20} /></button>
              <div className="min-w-0"><b className="block text-[22px] font-extrabold tracking-[-0.02em]">Edit shop</b><p className="truncate text-[13.5px] font-semibold text-muted">{branch.name}</p></div>
            </div>
            <div className="mt-4 grid gap-3">
              <Input label="Shop name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} disabled={busy} />
              <Input label="Address" value={address} maxLength={300} onChange={(e) => setAddress(e.target.value)} disabled={busy} placeholder="Street, barangay, city" />
              <Input label="Shop phone" inputMode="tel" value={phone} maxLength={20} placeholder="09XX XXX XXXX" onChange={(e) => setPhone(e.target.value)} disabled={busy} />
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-bold">About this shop <span className="font-semibold text-muted">(optional)</span></span>
                <textarea value={about} maxLength={300} rows={3} onChange={(e) => setAbout(e.target.value)} disabled={busy} className="rounded-[14px] bg-grey-100 px-3 py-2.5 text-[16px] font-medium outline-none" />
              </label>
              <LocationPicker value={pin} onChange={setPin} disabled={busy} />
              <p className="text-[12.5px] font-semibold text-muted">Brand name, logo, hours and photos are in <a href="/profile/edit" className="font-bold underline underline-offset-[3px]">Shop profile</a>.</p>
            </div>
            <Button className="mt-6" fullWidth loading={busy} disabled={busy || !dirty || name.trim().length < 2} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
