"use client";

import { Check, QrCode, RotateCcw, Share2, Trash2, UserPlus } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/common/Button";
import { useShop } from "@/lib/shop";
import { addStaff, readLocationStore, removeStaff, resetStaffToken, staffLinkPath, useShopLocations, type ShopBranch, type StaffMember } from "@/lib/shop-locations";
import { publishStaffMember, revokeStaffMember } from "@/lib/staff-links";
import { Sheet } from "./ShopsScreen";

/** Initial in a grey circle (Barbers portrait without a photo). */
export function StaffAvatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full bg-grey-100 font-bold text-ink"
      style={{ width: size, height: size, fontSize: Math.max(13, Math.round(size * 0.4)) }}>{name.slice(0, 1).toUpperCase()}</span>
  );
}

/** Publish (signed-in owner, live data) then return the full URL. Guests/sample stay local. */
function useStaffLink(branch: ShopBranch) {
  const { shop, source, isGuest } = useShop();
  return async (m: StaffMember, revoke?: string) => {
    if (source.mode === "firebase" && !isGuest) await publishStaffMember(shop, branch, m, revoke);
    return `${window.location.origin}${staffLinkPath(m.linkToken)}`;
  };
}

/** Share to staff: native share sheet, else copy. */
export function ShareStaffLink({ branch, member, compact = false }: { branch: ShopBranch; member: StaffMember; compact?: boolean }) {
  const publish = useStaffLink(branch);
  const { shop } = useShop();
  const [state, setState] = useState<"" | "busy" | "copied" | string>("");
  return (
    <button type="button" disabled={state === "busy"} aria-busy={state === "busy"}
      className={compact ? "inline-flex h-7 flex-none items-center gap-1 rounded-pill px-3 text-[12px] font-bold ring-1 ring-ink" : "inline-flex h-9 items-center gap-1.5 rounded-pill bg-ink px-3.5 text-[13px] font-bold text-on-ink"}
      onClick={async () => {
        setState("busy");
        try {
          const url = await publish(member);
          if (navigator.share) { await navigator.share({ title: `${member.name} · ${shop.name}`, text: `Your staff link, ${member.name}`, url }).catch(() => undefined); setState(""); }
          else { await navigator.clipboard.writeText(url); setState("copied"); window.setTimeout(() => setState(""), 1500); }
        } catch (e) { setState((e as Error).message); }
      }}>
      {state === "copied" ? <><Check size={13} strokeWidth={3} />Copied</> : <>{compact ? null : <Share2 size={14} strokeWidth={2.2} />}Share{compact ? "" : " to staff"}</>}
    </button>
  );
}

/** Staff QR: the staff member scans it once on their phone and keeps the page. */
function StaffQr({ branch, member, onClose }: { branch: ShopBranch; member: StaffMember; onClose: () => void }) {
  const publish = useStaffLink(branch);
  const [src, setSrc] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    void publish(member).then(async (u) => {
      const d = await QRCode.toDataURL(u, { margin: 1, width: 440, color: { dark: "#0A0A0A", light: "#FFFFFF" } });
      if (live) { setUrl(u); setSrc(d); }
    }).catch((e) => live && setErr((e as Error).message));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per member token
  }, [member.linkToken]);
  return (
    <Sheet title={`${member.name}’s staff QR`} subtitle={`${branch.name} · scan once on their phone`} onClose={onClose}>
      <div className="flex flex-col items-center">
        <div className="rounded-[18px] bg-white p-2 ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
          {src ? <img src={src} alt={`Staff QR for ${member.name}`} width={220} height={220} className="block size-[220px]" /> : <span className="skeleton-shimmer block size-[220px] rounded-[12px] bg-grey-200" />}
        </div>
        {err ? <p className="mt-2 text-[13px] font-semibold" role="alert">{err}</p> : null}
        <p className="mt-2 max-w-[280px] break-all text-center text-[11.5px] font-semibold text-muted">{url}</p>
      </div>
      <Button className="mt-4" fullWidth variant="secondary" onClick={onClose}>Done</Button>
    </Sheet>
  );
}

/** Staff at one location (Barbers "Barbers" section, no commission): add, share link, QR, reset, remove. */
export function StaffSection({ branch }: { branch: ShopBranch }) {
  useShopLocations(); // re-render on store changes
  const live = readLocationStore().branches.find((b) => b.id === branch.id) ?? branch;
  const staff = live.staff ?? [];
  const publish = useStaffLink(live);
  const { shop, source, isGuest } = useShop();
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [qr, setQr] = useState<StaffMember | null>(null);
  const [open, setOpen] = useState<StaffMember | null>(null);
  const [note, setNote] = useState("");

  return (
    <section className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card" aria-label="Staff">
      <div className="flex items-center justify-between gap-3">
        <b className="text-[16px]">Staff</b>
        <button type="button" onClick={() => { setNote(""); setAdding(true); }} className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-grey-100 px-3 text-[13px] font-bold"><UserPlus size={15} strokeWidth={2} />Add</button>
      </div>
      {note ? <p className="mt-2 text-[13px] font-semibold" role="status">{note}</p> : null}
      {staff.length ? (
        <ul className="mt-3 divide-y divide-line">
          {staff.map((m) => (
            <li key={m.id} className="flex items-center gap-2.5 py-2.5">
              <button type="button" onClick={() => setOpen(m)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" aria-label={`Manage ${m.name}`}>
                <StaffAvatar name={m.name} />
                <b className="min-w-0 truncate text-[14.5px]">{m.name}</b>
              </button>
              <button type="button" aria-label={`QR for ${m.name}`} onClick={() => setQr(m)} className="inline-flex size-9 flex-none items-center justify-center rounded-full bg-grey-100"><QrCode size={17} strokeWidth={2} /></button>
              <ShareStaffLink compact branch={live} member={m} />
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 rounded-[14px] bg-grey-50 px-3 py-3 text-[13px] font-semibold text-muted ring-1 ring-line">No staff yet.</p>}

      {adding ? (
        <Sheet title="Add staff" subtitle={live.name} onClose={() => setAdding(false)}>
          <form onSubmit={(e) => {
            e.preventDefault();
            const r = addStaff(live.id, name);
            if (r.error || !r.member) { setNote(r.error ?? ""); return; }
            setName(""); setAdding(false); setQr(r.member);
          }}>
            <label className="block">
              <span className="text-[13px] font-bold">Name</span>
              <input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Liza" className="mt-1.5 h-12 w-full rounded-[14px] bg-grey-100 px-3 text-[16px] font-semibold outline-none" />
            </label>
            {note ? <p className="mt-2 text-[13px] font-semibold" role="alert">{note}</p> : null}
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setAdding(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={name.trim().length < 2}>Add</Button>
            </div>
          </form>
        </Sheet>
      ) : null}
      {qr ? <StaffQr branch={live} member={qr} onClose={() => setQr(null)} /> : null}
      {open ? (
        <Sheet title={open.name} subtitle={`Staff · ${live.name}`} onClose={() => setOpen(null)}>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" fullWidth leadingIcon={<QrCode size={16} />} onClick={() => { setQr(open); setOpen(null); }}>Show QR</Button>
            <Button variant="secondary" fullWidth leadingIcon={<RotateCcw size={16} />} onClick={async () => {
              const old = open.linkToken;
              const linkToken = resetStaffToken(live.id, open.id);
              try { await publish({ ...open, linkToken }, old); setNote(`New link for ${open.name}. The old one stopped working.`); } catch (e) { setNote((e as Error).message); }
              setOpen(null);
            }}>Reset link</Button>
            <Button variant="ghost" fullWidth className="!text-[#DC2626]" leadingIcon={<Trash2 size={16} />} onClick={() => { if (source.mode === "firebase" && !isGuest) void revokeStaffMember(shop, live.id, open); removeStaff(live.id, open.id); setNote(`${open.name} is removed. Past orders keep their name in Sales.`); setOpen(null); }}>Remove</Button>
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}
