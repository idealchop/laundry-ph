"use client";

import { useRef, useState } from "react";
import { Camera, Check, FileText, ImageUp, Pencil, Sparkles, X } from "lucide-react";
import { cn } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { Sk } from "@/components/common/Skeleton";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useShop } from "@/lib/shop";
import { useShopLocations } from "@/lib/shop-locations";
import {
  IMPORT_ACCEPT, IMPORT_MAX_FILE_BYTES, IMPORT_MAX_FILES,
  type ImportCustomer, type ImportExtractResult, type ImportSaveResult, type ImportWalkIn,
} from "@/lib/import/types";
import { PageBack } from "../shell/PageBack";

type Step = "upload" | "reading" | "review" | "done";

/** Phone photos → ≤ 2000px JPEG (smaller upload, fewer tokens). Other files pass through. */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

async function idToken(): Promise<string> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Please sign in again.");
  return user.getIdToken();
}

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
const shortDate = (d: string) => (d ? new Date(`${d}T12:00:00+08:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }) : "No date");
const kb = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Upload old records (photos, PDF, Excel/CSV, text) → AI reads them → review → save. */
export function ImportScreen() {
  const { shop, source, isGuest } = useShop();
  const shops = useShopLocations();
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState<ImportCustomer[]>([]);
  const [walkIns, setWalkIns] = useState<ImportWalkIn[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState<ImportSaveResult | null>(null);
  const live = source.mode === "firebase" && !isGuest;

  function add(list: FileList | null) {
    setError("");
    const next = [...files];
    for (const f of Array.from(list ?? [])) {
      if (f.size > IMPORT_MAX_FILE_BYTES && !f.type.startsWith("image/")) { setError(`“${f.name}” is over ${IMPORT_MAX_FILE_BYTES / 1024 / 1024} MB.`); continue; }
      if (next.length >= IMPORT_MAX_FILES) { setError(`Up to ${IMPORT_MAX_FILES} files at a time.`); break; }
      next.push(f);
    }
    setFiles(next);
  }

  async function read() {
    setError("");
    if (!live) { setError("Sign in to your shop to import records."); return; }
    setStep("reading");
    try {
      const form = new FormData();
      form.set("shopId", shop.id);
      for (const f of await Promise.all(files.map(shrink))) form.append("files", f, f.name);
      const res = await fetch("/api/import/extract", { method: "POST", headers: { Authorization: `Bearer ${await idToken()}` }, body: form });
      const json = (await res.json().catch(() => ({}))) as Partial<ImportExtractResult> & { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not read your records. Try again.");
      setCustomers(json.customers ?? []);
      setWalkIns(json.walkIns ?? []);
      setStep("review");
    } catch (e) {
      setError((e as Error).message);
      setStep("upload");
    }
  }

  async function save() {
    setError("");
    try {
      const res = await fetch("/api/import/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await idToken()}` },
        body: JSON.stringify({ shopId: shop.id, branchId: shops.enabled && !shops.viewingAll ? shops.branch?.id : undefined, customers, walkIns }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<ImportSaveResult> & { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not save. Try again.");
      setSaved(json as ImportSaveResult);
      setStep("done");
      window.scrollTo(0, 0);
    } catch (e) { setError((e as Error).message); }
  }

  const total = customers.length + walkIns.length;

  return (
    <div className={cn("mx-auto w-full max-w-[560px] px-4 pt-4 lg:max-w-[720px] lg:px-[30px] lg:pt-6", step === "review" ? "pb-32" : "pb-8")}>
      <header className="mt-1 px-1">
        <div className="flex items-center gap-1">
          <PageBack fallback="/profile" />
          <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Import records</h1>
        </div>
        <p className="mt-0.5 pl-11 text-[14px] font-semibold text-muted">
          {step === "review" ? "Check what we found, then save." : step === "done" ? "Your records are in." : "Photos of your logbook, PDF, Excel, CSV or text."}
        </p>
      </header>

      {step === "upload" ? <Upload files={files} onAdd={add} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} onRead={read} error={error} /> : null}
      {step === "reading" ? <Reading count={files.length} /> : null}
      {step === "review" ? (
        <>
          <section className="relative mt-4 overflow-hidden rounded-banner bg-ink px-5 py-5 text-on-ink">
            <i aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-[220px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.14),rgba(255,255,255,0)_68%)]" />
            <p className="relative inline-flex items-center gap-1.5 text-[13px] font-semibold text-on-ink-muted"><Sparkles size={14} aria-hidden /> Found in {files.length} {files.length === 1 ? "file" : "files"}</p>
            <p className="relative mt-1 text-[36px] font-extrabold leading-none tracking-[-0.04em]">{total} {total === 1 ? "record" : "records"}</p>
            <p className="relative mt-2 text-[13px] font-semibold text-on-ink-muted">{customers.length} customers · {walkIns.length} walk-ins · tap <Pencil size={12} className="inline align-[-1px]" aria-label="edit" /> to fix a row</p>
          </section>
          {total === 0 ? <p className="mt-4 rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold">We couldn’t find customers or orders in these files. Try a clearer photo.</p> : null}
          <Group title="Customers" count={customers.length}>
            {customers.map((c) => (
              <CustomerRow key={c.key} c={c} editing={editing === c.key} onEdit={() => setEditing(editing === c.key ? null : c.key)}
                onChange={(p) => setCustomers((xs) => xs.map((x) => (x.key === c.key ? { ...x, ...p, unsure: x.unsure.filter((f) => !(f in p)) } : x)))}
                onRemove={() => setCustomers((xs) => xs.filter((x) => x.key !== c.key))} />
            ))}
          </Group>
          <Group title="Walk-ins" count={walkIns.length}>
            {walkIns.map((w) => (
              <WalkInRow key={w.key} w={w} editing={editing === w.key} onEdit={() => setEditing(editing === w.key ? null : w.key)}
                onChange={(p) => setWalkIns((xs) => xs.map((x) => (x.key === w.key ? { ...x, ...p, unsure: x.unsure.filter((f) => !(f in p)) } : x)))}
                onRemove={() => setWalkIns((xs) => xs.filter((x) => x.key !== w.key))} />
            ))}
          </Group>
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:left-auto lg:right-auto lg:mx-auto lg:w-full lg:max-w-[720px]">
            {error ? <p role="alert" className="mb-2 text-[13px] font-semibold">{error}</p> : null}
            <div className="mx-auto flex max-w-[560px] items-center gap-2">
              <Button variant="secondary" onClick={() => { setStep("upload"); setEditing(null); }}>Back</Button>
              <Button fullWidth disabled={total === 0} onClick={save}>{`Save ${total} ${total === 1 ? "record" : "records"}`}</Button>
            </div>
          </div>
        </>
      ) : null}
      {step === "done" && saved ? (
        <section className="mt-6 flex flex-col items-center rounded-card bg-surface px-6 py-8 text-center shadow-card">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-ink text-white"><Check size={28} strokeWidth={2.5} /></span>
          <h2 className="mt-4 text-[22px] font-extrabold tracking-[-0.02em]">Saved {saved.customers + saved.walkIns} records</h2>
          <p className="mt-1 text-[14px] font-semibold text-muted">
            {saved.customers} new {saved.customers === 1 ? "customer" : "customers"} · {saved.walkIns} past walk-ins
            {saved.skipped > 0 ? ` · ${saved.skipped} already in your list` : ""}
          </p>
          <p className="mt-2 text-[12.5px] font-semibold text-muted">Imported walk-ins don’t count toward today’s walk-in limit.</p>
          <div className="mt-6 flex w-full flex-col gap-2">
            <Button href="/history" fullWidth>See history</Button>
            <Button variant="secondary" fullWidth onClick={() => { setFiles([]); setCustomers([]); setWalkIns([]); setSaved(null); setStep("upload"); }}>Import more</Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Upload({ files, onAdd, onRemove, onRead, error }: { files: File[]; onAdd: (l: FileList | null) => void; onRemove: (i: number) => void; onRead: () => void; error: string }) {
  const pick = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onAdd(e.dataTransfer.files); }}
        className={cn("mt-5 flex flex-col items-center rounded-banner border-2 border-dashed px-6 py-9 text-center transition-colors", over ? "border-ink bg-grey-100" : "border-grey-300 bg-surface")}
      >
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-ink text-white"><ImageUp size={26} strokeWidth={1.9} aria-hidden /></span>
        <p className="mt-4 text-[17px] font-extrabold tracking-[-0.01em]">Add your old records</p>
        <p className="mt-1 max-w-[280px] text-[13.5px] font-semibold text-muted">Logbook photos, PDF, Excel, CSV or text. AI finds your customers and past walk-ins.</p>
        <div className="mt-5 flex w-full max-w-[320px] gap-2">
          <Button variant="secondary" fullWidth leadingIcon={<FileText size={16} aria-hidden />} onClick={() => pick.current?.click()}>Choose files</Button>
          <Button variant="secondary" fullWidth leadingIcon={<Camera size={16} aria-hidden />} onClick={() => cam.current?.click()}>Camera</Button>
        </div>
        <input ref={pick} type="file" multiple accept={IMPORT_ACCEPT} className="sr-only" aria-label="Choose files" onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }} />
        <input ref={cam} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Take a photo" onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }} />
      </div>
      {files.length > 0 ? (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-4 py-3">
              <span className="inline-flex size-10 flex-none items-center justify-center rounded-[12px] bg-grey-100">{f.type.startsWith("image/") ? <ImageUp size={18} aria-hidden /> : <FileText size={18} aria-hidden />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-bold">{f.name}</span><span className="text-[12.5px] font-semibold text-muted">{kb(f.size)}</span></span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onRemove(i)} className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-grey-100"><X size={18} /></button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p role="alert" className="mt-3 rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold">{error}</p> : null}
      <Button className="mt-5" fullWidth disabled={files.length === 0} leadingIcon={<Sparkles size={16} aria-hidden />} onClick={onRead}>
        {files.length ? `Read ${files.length} ${files.length === 1 ? "file" : "files"}` : "Read records"}
      </Button>
      <p className="mt-3 text-center text-[12px] font-semibold text-muted">Only the files you add are sent to the AI reader. Up to {IMPORT_MAX_FILES} files.</p>
    </>
  );
}

function Reading({ count }: { count: number }) {
  return (
    <div role="status" aria-busy="true" className="mt-4">
      <section className="relative overflow-hidden rounded-banner bg-ink px-5 py-5 text-on-ink">
        <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-on-ink-muted"><Sparkles size={14} className="motion-safe:animate-pulse" aria-hidden /> AI is reading {count} {count === 1 ? "file" : "files"}</p>
        <p className="mt-1 text-[26px] font-extrabold leading-tight tracking-[-0.03em]">Reading your records…</p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15"><span className="block h-full w-1/3 rounded-full bg-white motion-safe:animate-[importbar_1.4s_ease-in-out_infinite]" /></div>
        <p className="mt-3 text-[12.5px] font-semibold text-on-ink-muted">This takes about 10–40 seconds. Keep this screen open.</p>
      </section>
      <style>{`@keyframes importbar{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
      {["Customers", "Walk-ins"].map((t) => (
        <div key={t} className="mt-5">
          <Sk className="mx-1 h-4 w-28" />
          <div className="mt-2 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5"><span className="flex-1 space-y-1.5"><Sk className="h-4 w-2/3" /><Sk className="h-3 w-1/2" /></span><Sk className="size-8 rounded-full" /></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="mt-5">
      <h2 className="flex items-baseline gap-2 px-1 text-[16px] font-extrabold">{title} <span className="text-[13px] font-bold text-muted">{count}</span></h2>
      <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">{children}</ul>
    </section>
  );
}

/** Low-confidence value: dotted underline + "check" hint for screen readers. */
function V({ unsure, children, className }: { unsure: boolean; children: React.ReactNode; className?: string }) {
  return <span className={cn(unsure && "underline decoration-amber-500 decoration-dotted decoration-2 underline-offset-[3px]", className)} title={unsure ? "Please check" : undefined}>{children}{unsure ? <span className="sr-only"> (please check)</span> : null}</span>;
}

function RowActions({ editing, onEdit, onRemove, label }: { editing: boolean; onEdit: () => void; onRemove: () => void; label: string }) {
  return (
    <span className="flex flex-none items-center">
      <button type="button" aria-label={editing ? `Done editing ${label}` : `Edit ${label}`} aria-pressed={editing} onClick={onEdit} className={cn("inline-flex size-9 items-center justify-center rounded-full", editing ? "bg-ink text-white" : "text-ink hover:bg-grey-100")}>
        {editing ? <Check size={17} /> : <Pencil size={16} />}
      </button>
      <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-grey-100"><X size={18} /></button>
    </span>
  );
}

function Field({ label, value, onChange, unsure, type = "text", inputMode }: { label: string; value: string; onChange: (v: string) => void; unsure?: boolean; type?: string; inputMode?: "decimal" | "tel" }) {
  return (
    <label className="block">
      <span className="text-[12px] font-bold text-muted">{label}{unsure ? <span className="ml-1 text-amber-600">· check</span> : null}</span>
      <input type={type} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)}
        className={cn("mt-1 h-11 w-full rounded-[12px] border bg-surface px-3 text-[15px] font-semibold outline-none focus:border-ink", unsure ? "border-amber-400" : "border-line")} />
    </label>
  );
}

function CustomerRow({ c, editing, onEdit, onChange, onRemove }: { c: ImportCustomer; editing: boolean; onEdit: () => void; onChange: (p: Partial<ImportCustomer>) => void; onRemove: () => void }) {
  const u = (f: string) => c.unsure.includes(f);
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <V unsure={u("name")} className="block truncate text-[15px] font-bold">{c.name}</V>
          <span className="block truncate text-[12.5px] font-semibold text-muted">
            <V unsure={u("phone")}>{c.phone || "No phone"}</V>{c.address ? <> · <V unsure={u("address")}>{c.address}</V></> : null}
          </span>
          {c.notes ? <V unsure={u("notes")} className="block truncate text-[12.5px] font-semibold text-muted">{c.notes}</V> : null}
        </span>
        <RowActions editing={editing} onEdit={onEdit} onRemove={onRemove} label={c.name} />
      </div>
      {editing ? (
        <div className="mt-3 grid gap-2.5 pb-1">
          <Field label="Name" value={c.name} unsure={u("name")} onChange={(name) => onChange({ name })} />
          <Field label="Phone" value={c.phone} unsure={u("phone")} type="tel" inputMode="tel" onChange={(phone) => onChange({ phone })} />
          <Field label="Address" value={c.address} unsure={u("address")} onChange={(address) => onChange({ address })} />
          <Field label="Notes" value={c.notes} unsure={u("notes")} onChange={(notes) => onChange({ notes })} />
        </div>
      ) : null}
    </li>
  );
}

function WalkInRow({ w, editing, onEdit, onChange, onRemove }: { w: ImportWalkIn; editing: boolean; onEdit: () => void; onChange: (p: Partial<ImportWalkIn>) => void; onRemove: () => void }) {
  const u = (f: string) => w.unsure.includes(f);
  const label = `${w.customer || "walk-in"} ${shortDate(w.date)}`;
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <V unsure={u("customer")} className="truncate text-[15px] font-bold">{w.customer || "Walk-in customer"}</V>
            <V unsure={u("amount")} className="flex-none text-[15px] font-extrabold">{peso(w.amount)}</V>
          </span>
          <span className="flex items-baseline justify-between gap-2 text-[12.5px] font-semibold text-muted">
            <span className="truncate">
              <V unsure={u("date")}>{shortDate(w.date)}</V> · {w.quantity > 0 ? <V unsure={u("quantity")}>{w.quantity} {w.unit}</V> : null}{w.quantity > 0 ? " · " : ""}<V unsure={u("service")}>{w.service || "Laundry"}</V>
            </span>
            <V unsure={u("paid")} className={cn("flex-none", w.paid ? "" : "font-bold text-ink")}>{w.paid ? "Paid" : "Unpaid"}</V>
          </span>
        </span>
        <RowActions editing={editing} onEdit={onEdit} onRemove={onRemove} label={label} />
      </div>
      {editing ? (
        <div className="mt-3 grid grid-cols-2 gap-2.5 pb-1">
          <div className="col-span-2"><Field label="Customer" value={w.customer} unsure={u("customer")} onChange={(customer) => onChange({ customer })} /></div>
          <Field label="Date" type="date" value={w.date} unsure={u("date")} onChange={(date) => onChange({ date })} />
          <Field label="Service" value={w.service} unsure={u("service")} onChange={(service) => onChange({ service })} />
          <Field label={w.unit === "kg" ? "Kilos" : "Pieces"} inputMode="decimal" value={String(w.quantity || "")} unsure={u("quantity")} onChange={(v) => onChange({ quantity: Number(v.replace(/[^0-9.]/g, "")) || 0 })} />
          <Field label="Amount (₱)" inputMode="decimal" value={String(w.amount || "")} unsure={u("amount")} onChange={(v) => onChange({ amount: Number(v.replace(/[^0-9.]/g, "")) || 0 })} />
          <div className="col-span-2 flex gap-2">
            {(["kg", "pc"] as const).map((x) => <Chip key={x} on={w.unit === x} onClick={() => onChange({ unit: x })}>{x === "kg" ? "Per kg" : "Per piece"}</Chip>)}
            {[true, false].map((p) => <Chip key={String(p)} on={w.paid === p} onClick={() => onChange({ paid: p })}>{p ? "Paid" : "Unpaid"}</Chip>)}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className={cn("h-9 rounded-pill px-3.5 text-[13px] font-bold", on ? "bg-ink text-white" : "bg-grey-100 text-ink")}>{children}</button>;
}

