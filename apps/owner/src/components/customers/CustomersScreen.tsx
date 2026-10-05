"use client";

import { Plus, X } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, Input, ListItem, SearchInput, Topbar } from "@river-apps/ui";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import type { Customer } from "@/data";
import { money, whenLabel } from "@/lib/format";
import { customerTag, normalizePhone } from "@/lib/orders";
import { useAction, useCustomers, useOrders, useShop } from "@/lib/shop";
import { SampleNote } from "../SampleNote";
import { ErrorNote, PaymentBadge, Spinner, StatusBadge } from "../ui";

/** Customers from Firestore: search, add, and each customer's recent orders. */
export function CustomersScreen() {
  const { source } = useShop();
  const { customers, error, loading } = useCustomers();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => {
    const t = search.trim().toLowerCase();
    const digits = t.replace(/\D/g, "");
    const rows = t
      ? customers.filter((c) => c.name.toLowerCase().includes(t) || (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits)))
      : customers;
    return [...rows].sort((a, b) => (b.lastVisitAt ?? b.createdAt ?? 0) - (a.lastVisitAt ?? a.createdAt ?? 0));
  }, [customers, search]);

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar
        className="px-1"
        title="Customers"
        subtitle={<>{customers.length} customers · walk-in and River Mobile <SampleNote className="ml-1 align-middle" /></>}
        actions={<Button size="md" onClick={() => setAdding((v) => !v)} leadingIcon={adding ? <X size={18} /> : <Plus size={18} strokeWidth={2} />}>{adding ? "Close" : "Add customer"}</Button>}
      />
      {adding ? <AddCustomerForm existing={customers} onSaved={() => setAdding(false)} create={(c) => source.createCustomer(c)} /> : null}
      <SearchInput className="mt-4" placeholder="Search name or mobile" label="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} />
      {error ? <ErrorNote className="mt-3">{error}</ErrorNote> : null}
      {loading && customers.length === 0 ? <Spinner label="Loading customers" /> : null}
      {!loading && list.length === 0 ? (
        <EmptyState className="mt-4" title={search ? "No matching customers" : "No customers yet"}
          description="Customers are added here or automatically when you type a name on a walk-in order." />
      ) : null}
      {list.length ? (
        <Card padding="none" className="mt-4 px-4 py-1.5">
          <ul aria-label="Customers">
            {list.map((c) => (
              <li key={c.id} className="border-b border-line last:border-b-0">
                <button type="button" className="block w-full text-left" aria-expanded={openId === c.id} onClick={() => setOpenId((v) => (v === c.id ? null : c.id))}>
                  <CustomerRow c={c} />
                </button>
                {openId === c.id ? <CustomerOrders customer={c} /> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function CustomerRow({ c }: { c: Customer }) {
  const tag = customerTag(c);
  return (
    <ListItem
      variant="row"
      className="py-2.5"
      leading={<Avatar name={c.name} preset={c.avatar} size={40} />}
      title={<>{c.name} <Badge variant={tag === "Member" ? "solid" : "soft"} size="sm" className="ml-1 align-[1px]">{tag}</Badge></>}
      subtitle={`${c.phone ?? "No mobile"} · ${c.source} · ${c.visits === 1 ? "1 visit" : `${c.visits} visits`}${c.lastVisitAt ? ` · last ${whenLabel(c.lastVisitAt)}` : ""}`}
      trailing={<span className="flex flex-col items-end leading-[1.3]"><b className="text-[14px] font-extrabold">{money(c.spentCentavos)}</b><small className="text-[12px] font-medium text-muted">all time</small></span>}
    />
  );
}

/** Recent orders for one customer (from the last 90 days of shop orders). */
function CustomerOrders({ customer }: { customer: Customer }) {
  const [now] = useState(() => Date.now());
  const since = useMemo(() => now - 90 * 86400_000, [now]);
  const { orders, loading } = useOrders({ sinceMs: since });
  const mine = orders.filter((o) => o.customerId === customer.id).slice(0, 8);
  return (
    <div className="mb-3 rounded-tile bg-grey-50 px-3 py-2">
      {customer.notes ? <p className="mb-1 text-[13px] font-medium text-ink-2">{customer.notes}</p> : null}
      {loading ? <p className="py-2 text-[13px] font-semibold text-muted">Loading orders…</p> : null}
      {!loading && mine.length === 0 ? <p className="py-2 text-[13px] font-semibold text-muted">No orders in the last 90 days.</p> : null}
      <ul>
        {mine.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-2 py-1.5 text-[13px]">
            <Link href={`/orders/view?id=${o.id}`} className="min-w-0 truncate font-semibold hover:underline">
              <span className="font-mono">{o.ref}</span> · {o.detail} · {whenLabel(o.createdAt)}
            </Link>
            <span className="flex flex-none items-center gap-1"><StatusBadge status={o.status} className="text-[11px]" /><PaymentBadge order={o} /><b>{money(o.totalCentavos)}</b></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddCustomerForm({ existing, onSaved, create }: { existing: Customer[]; onSaved: () => void; create: (c: { name: string; phone?: string; notes?: string }) => Promise<Customer> }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const { busy, error, run, setError } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const p = phone.trim() ? normalizePhone(phone) : "";
    if (p && !/^09\d{9}$/.test(p)) return setError("Enter a PH mobile like 0917 123 4567, or leave it blank.");
    if (p && existing.some((c) => c.phone === p)) return setError("A customer with this mobile already exists.");
    const saved = await run(() => create({ name, ...(p ? { phone: p } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) }));
    if (saved) onSaved();
  }

  return (
    <Card className="mt-4 px-4 py-4">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <b className="text-[16px]">New customer</b>
        <Input size="md" label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Joy Pascual" required maxLength={80} autoFocus />
        <Input size="md" label="Mobile (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0917 123 4567" inputMode="tel" maxLength={16} />
        <Input size="md" label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Prefers hypoallergenic detergent" maxLength={200} />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button type="submit" disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save customer"}</Button>
      </form>
    </Card>
  );
}
