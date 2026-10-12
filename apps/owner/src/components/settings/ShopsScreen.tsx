"use client";

import { useState } from "react";
import { Button, Input } from "@river-apps/ui";
import { reverseGeocodePin } from "@/lib/geocode";
import {
  HOME_LOCATION_ID, branchLinkExpired, ensureBranchLink, linkExpiryLabel, useShopLocations,
  type ShopBranch,
} from "@/lib/shop-locations";
import { useShop } from "@/lib/shop";
import type { ShopLocation } from "@/data";
import { PageBack } from "../shell/PageBack";
import { LocationPicker } from "./LocationPicker";

function CopyShopLink({ id }: { id: string }) {
  const [label, setLabel] = useState("Copy link");
  return (
    <Button size="sm" variant="secondary" onClick={() => {
      const path = ensureBranchLink(id);
      if (!path) return;
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

/** Turn shops on, add a place, and keep a shareable link with each shop. */
export function ShopsScreen() {
  const { shop } = useShop();
  const { enabled, ready, branches, enable, disable, addBranch, updateBranch, removeBranch } = useShopLocations();
  const [name, setName] = useState("");
  const [pin, setPin] = useState<ShopLocation | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editPin, setEditPin] = useState<ShopLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function onAdd() {
    setError("");
    if (!pin) {
      setError("Drop a pin so this shop has an address.");
      return;
    }
    setBusy(true);
    try {
      const geo = await reverseGeocodePin(pin.lat, pin.lng);
      const address = geo?.formatted || pin.formattedAddress;
      const area = geo?.area || address;
      const result = addBranch(shop.name, { name, address, area, location: { ...pin, formattedAddress: address } });
      if (result.error || !result.branch) {
        setError(result.error || "Couldn’t add that shop.");
        return;
      }
      setName("");
      setPin(null);
      setNote(`${result.branch.name} is ready. Copy its link and send it to that shop. Orders and the QR stay on this shop.`);
    } catch {
      setError("Couldn’t look up that pin. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function savePin(branch: ShopBranch) {
    if (!editPin) return;
    setBusy(true);
    setError("");
    try {
      const geo = await reverseGeocodePin(editPin.lat, editPin.lng);
      const address = geo?.formatted || editPin.formattedAddress;
      const area = geo?.area || branch.area;
      updateBranch(branch.id, { location: { ...editPin, formattedAddress: address }, address, area });
      setEditing(null);
      setNote(`Saved the pin for ${branch.name}.`);
    } catch {
      setError("Couldn’t look up that pin. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onRemove(branch: ShopBranch) {
    const message = removeBranch(branch.id);
    setError(message);
    if (!message) setNote(`${branch.name} is removed. Its link stops working.`);
  }

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-8 pt-4 lg:max-w-[720px] lg:px-[30px] lg:pt-6">
      <header className="mt-1 px-1">
        <div className="flex items-center gap-1">
          <PageBack fallback="/profile" />
          <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Shops</h1>
        </div>
        <p className="mt-0.5 pl-11 text-[14px] font-semibold text-muted">{enabled ? "Add a shop, move its pin, or copy the link you send that shop." : "Turn this on when you run more than one shop."}</p>
      </header>
      {note ? <p className="mt-3 rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold">{note}</p> : null}
      {error ? <p className="mt-3 text-[13.5px] font-semibold">{error}</p> : null}

      {!ready ? null : enabled ? (
        <>
          <ul className="mt-4 flex flex-col gap-3">
            {branches.map((branch) => (
              <li key={branch.id} className="rounded-card bg-surface px-3.5 py-3 shadow-card">
                <b className="block text-[16px]">{branch.name}</b>
                <p className="mt-0.5 text-[13px] font-medium text-muted">{branch.area || branch.address || "No pin yet"}</p>
                {branch.linkExpiresAt ? (
                  <p className="mt-1 text-[12.5px] font-semibold text-muted">
                    {branchLinkExpired(branch) ? `Link expired ${linkExpiryLabel(branch.linkExpiresAt)}` : `Link expires ${linkExpiryLabel(branch.linkExpiresAt)}`}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <CopyShopLink id={branch.id} />
                  <Button size="sm" variant="secondary" onClick={() => { setEditing(editing === branch.id ? null : branch.id); setEditPin(branch.location); }}>
                    {editing === branch.id ? "Close" : "Edit pin"}
                  </Button>
                  {branch.id === HOME_LOCATION_ID ? null : (
                    <Button size="sm" variant="secondary" onClick={() => onRemove(branch)}>Remove</Button>
                  )}
                </div>
                <p className="mt-2 text-[12.5px] font-semibold text-muted">They open this link to see bookings for {branch.name}. No account. It expires each month.{branchLinkExpired(branch) ? " This one has expired. Copy link sends a new one." : ""}</p>
                {editing === branch.id ? (
                  <div className="mt-3">
                    <LocationPicker value={editPin} onChange={setEditPin} disabled={busy} />
                    <Button className="mt-3" size="sm" disabled={busy || !editPin} onClick={() => void savePin(branch)}>Save pin</Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          <section className="mt-6">
            <h2 className="px-1 text-[13px] font-bold uppercase tracking-[0.04em] text-muted">Add a shop</h2>
            <div className="mt-2 flex flex-col gap-3 rounded-card bg-surface px-3.5 py-3.5 shadow-card">
              <Input label="Shop name" placeholder="Shaw" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
              <LocationPicker value={pin} onChange={setPin} disabled={busy} />
              <Button fullWidth disabled={busy || name.trim().length < 2} onClick={() => void onAdd()}>{busy ? "Saving…" : "Add shop"}</Button>
            </div>
          </section>

          <button
            type="button"
            className="mt-6 w-full rounded-card bg-surface px-4 py-3 text-left shadow-card"
            onClick={() => { disable(); setNote("Multiple shops is off. This phone is back on the first shop."); }}
          >
            <b className="block text-[15px]">Turn off multiple shops</b>
            <small className="text-[13px] font-medium text-muted">The other shops stay saved. Home, Orders, and links go back to the first shop.</small>
          </button>
        </>
      ) : (
        <div className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card">
          <b className="block text-[16px]">One shop</b>
          <p className="mt-1 text-[13.5px] font-medium text-muted">Turn this on when you run more than one shop. The shop you have now becomes the first one, with its own link.</p>
          <Button className="mt-4" fullWidth onClick={() => { enable(shop); setNote("Multiple shops is on. This shop is the first one."); }}>Turn on</Button>
        </div>
      )}
    </div>
  );
}
