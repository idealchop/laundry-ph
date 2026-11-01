"use client";
import { cn } from "@river-apps/ui";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { RiverIcon } from "@/components/common/RiverIcon";
import { BottomSheet } from "@/components/common/BottomSheet";
import { Button } from "@/components/common/Button";
import type { Expense, ExpenseKind, ExpenseTypeConfig } from "@/data/types";
import { CATEGORY_COLORS, DEFAULT_EXPENSE_TYPES, kindOf, newId } from "@/lib/expense-types";
import { money } from "@/lib/format";
import { useAction, useShopQuery } from "@/lib/shop";

/** 16px inputs (no iOS zoom), white with a hairline. */
const INPUT = "h-11 w-full rounded-[12px] bg-surface px-3 text-[16px] font-semibold ring-1 ring-line outline-none focus-visible:ring-2 focus-visible:ring-ink";
const CHIP = "h-9 flex-none whitespace-nowrap rounded-full px-3 text-[13px] font-bold";
const todayInput = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const EMOJIS = ["🔥", "⚡", "💧", "👷", "🏠", "🧴", "🧺", "🚚", "🛠️", "📶", "🧾", "💳"];

export interface NewExpense { type: string; typeId: string | null; note: string | null; amountCentavos: number; date: number }

/** Sales › Performance expenses: total, recent list grouped by category, add sheet, type/category editor. */
export function Expenses({ items, canEdit, busy, error, onAdd, onRemove }: {
  items: Expense[]; canEdit: boolean; busy?: boolean; error?: string | null;
  onAdd: (e: NewExpense) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const q = useShopQuery((s) => s.getExpenseTypes());
  const [local, setLocal] = useState<ExpenseTypeConfig | null>(null);
  const cfg = local ?? q.data ?? DEFAULT_EXPENSE_TYPES;
  const [sheet, setSheet] = useState<null | "add" | "manage">(null);
  const total = items.reduce((s, x) => s + x.amountCentavos, 0);

  const groups = (() => {
    const m = new Map<string, { name: string; color: string; total: number; rows: Expense[] }>();
    for (const x of items) {
      const cat = cfg.categories.find((c) => c.id === kindOf(cfg, x)?.categoryId);
      const key = cat?.id ?? "_other";
      const g = m.get(key) ?? { name: cat?.name ?? "Other", color: cat?.color ?? "#5F6B7A", total: 0, rows: [] };
      g.total += x.amountCentavos; g.rows.push(x); m.set(key, g);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  })();

  return (
    <section className="mt-3 rounded-card bg-surface shadow-card">
      <div className="flex items-center gap-2 px-4 pt-3">
        <h2 className="flex flex-1 items-center gap-2 text-[16px] font-bold"><RiverIcon name="expenses" size={24} />Expenses</h2>
        <b className="tabular-nums text-[16px]">{money(total)}</b>
        {canEdit ? (
          <button type="button" aria-label="Add expense" onClick={() => setSheet("add")} className="-mr-2 inline-flex size-11 items-center justify-center rounded-full"><Plus size={19} strokeWidth={2.2} /></button>
        ) : null}
      </div>
      {groups.length ? (
        <div className="mt-1">
          {groups.map((g) => (
            <div key={g.name} className="border-t border-line px-4 py-2">
              <p className="flex items-center gap-2 text-[12.5px] font-bold" style={{ color: g.color }}>
                <span aria-hidden className="size-2 rounded-full" style={{ background: g.color }} />
                <span className="flex-1">{g.name}</span>
                <span className="tabular-nums text-muted">{money(g.total)}</span>
              </p>
              <ul>
                {g.rows.slice(0, 4).map((x) => {
                  const k = kindOf(cfg, x);
                  return (
                    <li key={x.id} className="flex min-h-[44px] items-center gap-3">
                      <span aria-hidden className="w-6 text-center text-[17px]">{k?.emoji ?? "🧾"}</span>
                      <span className="min-w-0 flex-1 truncate text-[14px] font-bold">
                        {k?.name ?? x.type}
                        <small className="ml-1.5 text-[12px] font-semibold text-muted">{new Date(x.date).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}{x.note ? ` · ${x.note}` : ""}</small>
                      </span>
                      <b className="tabular-nums text-[14px]">{money(x.amountCentavos)}</b>
                      {canEdit ? <button type="button" aria-label={`Remove ${k?.name ?? x.type} expense`} onClick={() => onRemove(x.id)} className="-mr-2 inline-flex size-10 items-center justify-center text-subtle"><X size={16} /></button> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : <p className="px-4 pb-1 pt-1 text-[13px] font-semibold text-muted">None yet.</p>}
      {canEdit ? (
        <div className="flex justify-end px-4 pb-3 pt-1">
          <button type="button" onClick={() => setSheet("manage")} className="min-h-11 text-[13.5px] font-bold text-ink underline-offset-2 hover:underline">Manage types</button>
        </div>
      ) : <div className="h-3" />}

      {sheet === "add" ? (
        <AddExpenseSheet cfg={cfg} busy={busy} error={error} onClose={() => setSheet(null)} onManage={() => setSheet("manage")}
          onAdd={async (e) => { if (await onAdd(e)) setSheet(null); }} />
      ) : null}
      {sheet === "manage" ? (
        <ManageTypesSheet cfg={cfg} onClose={() => setSheet(null)} onSaved={(c) => { setLocal(c); setSheet(null); }} />
      ) : null}
    </section>
  );
}

function AddExpenseSheet({ cfg, busy, error, onClose, onManage, onAdd }: {
  cfg: ExpenseTypeConfig; busy?: boolean; error?: string | null; onClose: () => void; onManage: () => void; onAdd: (e: NewExpense) => void;
}) {
  const [typeId, setTypeId] = useState<string | null>(cfg.types[0]?.id ?? null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInput);
  const [note, setNote] = useState("");
  const kind = cfg.types.find((t) => t.id === typeId);
  const cents = Math.round(Number(amount.replace(/,/g, "")) * 100);
  return (
    <BottomSheet title="Add expense" onClose={onClose}>
      <form className="grid gap-3 pb-2 pt-1" onSubmit={(e) => {
        e.preventDefault();
        if (!(cents > 0) || !kind) return;
        const [y, m, d] = date.split("-").map(Number);
        onAdd({ type: kind.name, typeId: kind.id, note: note.trim() || null, amountCentavos: cents, date: new Date(y!, (m ?? 1) - 1, d ?? 1, 12).getTime() });
      }}>
        <div role="radiogroup" aria-label="Type" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cfg.types.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={typeId === t.id} onClick={() => setTypeId(t.id)}
              className={cn(CHIP, typeId === t.id ? "bg-ink text-on-ink" : "bg-surface text-ink ring-1 ring-line")}>{t.emoji} {t.name}</button>
          ))}
          <button type="button" onClick={onManage} className={cn(CHIP, "bg-surface text-ink ring-1 ring-dashed ring-line")}>+ New type</button>
        </div>
        <label className="grid gap-1 text-[12.5px] font-semibold text-muted">Amount
          <input inputMode="decimal" placeholder="₱ 0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} className={cn(INPUT, "tabular-nums text-ink")} />
        </label>
        <label className="grid gap-1 text-[12.5px] font-semibold text-muted">Date
          <input type="date" value={date} max={todayInput()} onChange={(e) => setDate(e.target.value)} className={cn(INPUT, "text-ink")} />
        </label>
        <label className="grid gap-1 text-[12.5px] font-semibold text-muted">Note (optional)
          <input value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Meralco October" className={cn(INPUT, "text-ink")} />
        </label>
        {error ? <p role="alert" className="text-[13px] font-semibold text-[#E5484D]">{error}</p> : null}
        <Button type="submit" size="md" fullWidth disabled={busy || !(cents > 0) || !kind}>{busy ? "Saving…" : "Add"}</Button>
      </form>
    </BottomSheet>
  );
}

function move<T>(list: T[], i: number, d: number): T[] {
  const j = i + d; if (j < 0 || j >= list.length) return list;
  const next = list.slice(); [next[i], next[j]] = [next[j]!, next[i]!]; return next;
}

const ICON_BTN = "inline-flex size-9 flex-none items-center justify-center rounded-full text-muted disabled:opacity-30";

function ManageTypesSheet({ cfg, onClose, onSaved }: { cfg: ExpenseTypeConfig; onClose: () => void; onSaved: (c: ExpenseTypeConfig) => void }) {
  const [draft, setDraft] = useState<ExpenseTypeConfig>(cfg);
  const act = useAction("Sign in to save expense types.");
  const setType = (id: string, p: Partial<ExpenseKind>) => setDraft((d) => ({ ...d, types: d.types.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
  const valid = draft.types.every((t) => t.name.trim()) && draft.categories.every((c) => c.name.trim());
  return (
    <BottomSheet title="Expense types" subtitle="Your types and the categories they roll up into" onClose={onClose} tall>
      <h3 className="mt-2 text-[13px] font-bold text-muted">Categories</h3>
      <ul className="mt-1">
        {draft.categories.map((c, i) => (
          <li key={c.id} className="flex items-center gap-1.5 border-b border-line py-2">
            <button type="button" aria-label={`Colour for ${c.name || "category"}`} className="inline-flex size-9 flex-none items-center justify-center"
              onClick={() => setDraft((d) => ({ ...d, categories: d.categories.map((x) => x.id === c.id ? { ...x, color: CATEGORY_COLORS[(CATEGORY_COLORS.indexOf(x.color as typeof CATEGORY_COLORS[number]) + 1) % CATEGORY_COLORS.length]! } : x) }))}>
              <span className="size-4 rounded-full" style={{ background: c.color }} />
            </button>
            <input aria-label="Category name" value={c.name} maxLength={30} onChange={(e) => setDraft((d) => ({ ...d, categories: d.categories.map((x) => x.id === c.id ? { ...x, name: e.target.value } : x) }))} className={cn(INPUT, "h-10 min-w-0 flex-1")} />
            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => setDraft((d) => ({ ...d, categories: move(d.categories, i, -1) }))} className={ICON_BTN}><ArrowUp size={16} /></button>
            <button type="button" aria-label="Move down" disabled={i === draft.categories.length - 1} onClick={() => setDraft((d) => ({ ...d, categories: move(d.categories, i, 1) }))} className={ICON_BTN}><ArrowDown size={16} /></button>
            <button type="button" aria-label={`Delete ${c.name}`} onClick={() => setDraft((d) => ({ categories: d.categories.filter((x) => x.id !== c.id), types: d.types.map((t) => t.categoryId === c.id ? { ...t, categoryId: null } : t) }))} className={ICON_BTN}><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setDraft((d) => ({ ...d, categories: [...d.categories, { id: newId("c"), name: "New category", color: CATEGORY_COLORS[d.categories.length % CATEGORY_COLORS.length]! }] }))}
        className="mt-1 min-h-11 text-[13.5px] font-bold">+ New category</button>

      <h3 className="mt-4 text-[13px] font-bold text-muted">Types</h3>
      <ul className="mt-1">
        {draft.types.map((t, i) => (
          <li key={t.id} className="border-b border-line py-2">
            <div className="flex items-center gap-1.5">
              <button type="button" aria-label={`Icon for ${t.name || "type"}`} onClick={() => setType(t.id, { emoji: EMOJIS[(EMOJIS.indexOf(t.emoji) + 1) % EMOJIS.length]! })}
                className="inline-flex size-10 flex-none items-center justify-center rounded-[12px] text-[18px] ring-1 ring-line">{t.emoji}</button>
              <input aria-label="Type name" value={t.name} maxLength={30} onChange={(e) => setType(t.id, { name: e.target.value })} className={cn(INPUT, "h-10 min-w-0 flex-1")} />
              <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => setDraft((d) => ({ ...d, types: move(d.types, i, -1) }))} className={ICON_BTN}><ArrowUp size={16} /></button>
              <button type="button" aria-label="Move down" disabled={i === draft.types.length - 1} onClick={() => setDraft((d) => ({ ...d, types: move(d.types, i, 1) }))} className={ICON_BTN}><ArrowDown size={16} /></button>
              <button type="button" aria-label={`Delete ${t.name}`} onClick={() => setDraft((d) => ({ ...d, types: d.types.filter((x) => x.id !== t.id) }))} className={ICON_BTN}><Trash2 size={16} /></button>
            </div>
            <select aria-label={`Category for ${t.name}`} value={t.categoryId ?? ""} onChange={(e) => setType(t.id, { categoryId: e.target.value || null })}
              className="ml-[46px] mt-1.5 h-9 rounded-[10px] bg-surface px-2 text-[16px] font-semibold ring-1 ring-line outline-none">
              <option value="">No category</option>
              {draft.categories.map((c) => <option key={c.id} value={c.id}>{c.name || "Untitled"}</option>)}
            </select>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setDraft((d) => ({ ...d, types: [...d.types, { id: newId("t"), name: "New type", emoji: "🧾", categoryId: d.categories[0]?.id ?? null }] }))}
        className="mt-1 min-h-11 text-[13.5px] font-bold">+ New type</button>

      {act.error ? <p role="alert" className="mt-2 text-[13px] font-semibold text-[#E5484D]">{act.error}</p> : null}
      <div className="sticky bottom-0 mt-3 bg-surface pb-1 pt-2">
        <Button type="button" size="md" fullWidth disabled={act.busy || !valid}
          onClick={async () => { const saved = await act.run((s) => s.saveExpenseTypes(draft)); if (saved) onSaved(saved); }}>{act.busy ? "Saving…" : "Save"}</Button>
      </div>
    </BottomSheet>
  );
}
