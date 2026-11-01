import type { Expense, ExpenseCategory, ExpenseKind, ExpenseTypeConfig } from "@/data/types";

/** Category colours owners can pick (dot + label tint only; surfaces stay white). */
export const CATEGORY_COLORS = ["#1B6B63", "#B05C1C", "#2F6FDB", "#8A4FD8", "#D6336C", "#5F6B7A"] as const;

/** Starter setup: editable and deletable like anything the owner adds. */
export const DEFAULT_EXPENSE_TYPES: ExpenseTypeConfig = {
  categories: [
    { id: "utilities", name: "Utilities", color: "#2F6FDB" },
    { id: "labor", name: "Labor", color: "#B05C1C" },
  ],
  types: [
    { id: "gas", name: "Gas", emoji: "🔥", categoryId: "utilities" },
    { id: "electricity", name: "Electricity", emoji: "⚡", categoryId: "utilities" },
    { id: "water", name: "Water", emoji: "💧", categoryId: "utilities" },
    { id: "labor", name: "Labor", emoji: "👷", categoryId: "labor" },
  ],
};

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Validates and trims a config from the client or Firestore. Returns null if it's not usable. */
export function sanitizeExpenseTypes(raw: unknown): ExpenseTypeConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { categories?: unknown; types?: unknown };
  if (!Array.isArray(r.categories) || !Array.isArray(r.types)) return null;
  const categories: ExpenseCategory[] = [];
  for (const c of r.categories.slice(0, 30)) {
    const o = (c ?? {}) as Record<string, unknown>;
    const id = String(o.id ?? ""); const name = clean(o.name, 30);
    if (!ID.test(id) || !name || categories.some((x) => x.id === id)) continue;
    const color = typeof o.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(o.color) ? o.color : CATEGORY_COLORS[0];
    categories.push({ id, name, color });
  }
  const types: ExpenseKind[] = [];
  for (const t of r.types.slice(0, 80)) {
    const o = (t ?? {}) as Record<string, unknown>;
    const id = String(o.id ?? ""); const name = clean(o.name, 30);
    if (!ID.test(id) || !name || types.some((x) => x.id === id)) continue;
    const emoji = clean(o.emoji, 8) || "🧾";
    const cat = typeof o.categoryId === "string" && categories.some((c) => c.id === o.categoryId) ? o.categoryId : null;
    types.push({ id, name, emoji, categoryId: cat });
  }
  return { categories, types };
}

export const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Resolve an expense to its type (by id, then by legacy name). */
export function kindOf(cfg: ExpenseTypeConfig, x: Pick<Expense, "type" | "typeId">): ExpenseKind | undefined {
  return cfg.types.find((t) => t.id === x.typeId) ?? cfg.types.find((t) => t.name.toLowerCase() === String(x.type).toLowerCase());
}
