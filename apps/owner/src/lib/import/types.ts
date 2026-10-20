/** AI import: shapes shared by the upload/review screen and the /api/import routes. */

export const IMPORT_MAX_FILES = 8;
export const IMPORT_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const IMPORT_MAX_TOTAL_BYTES = 18 * 1024 * 1024;
export const IMPORT_MAX_RECORDS = 400;
export const IMPORT_ACCEPT = "image/*,application/pdf,.pdf,.csv,text/csv,.txt,text/plain,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.tsv";

export interface ImportCustomer {
  key: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  /** Field names the AI was unsure about. */
  unsure: string[];
}

export interface ImportWalkIn {
  key: string;
  /** YYYY-MM-DD (Manila). */
  date: string;
  customer: string;
  service: string;
  quantity: number;
  unit: "kg" | "pc";
  /** Whole pesos. */
  amount: number;
  paid: boolean;
  unsure: string[];
}

export interface ImportExtractResult {
  customers: ImportCustomer[];
  walkIns: ImportWalkIn[];
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
}

export interface ImportSaveResult {
  customers: number;
  walkIns: number;
  skipped: number;
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : typeof v === "number" ? String(v).slice(0, max) : "");
const n = (v: unknown, max: number) => {
  const x = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(x) && x >= 0 ? Math.min(Math.round(x * 100) / 100, max) : 0;
};
const unsureOf = (v: unknown, allowed: readonly string[]) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && allowed.includes(x)).slice(0, 8) : []);
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00+08:00`));

export const CUSTOMER_FIELDS = ["name", "phone", "address", "notes"] as const;
export const WALKIN_FIELDS = ["date", "customer", "service", "quantity", "amount", "paid"] as const;

/** PH mobile → 09XXXXXXXXX when it looks like one; otherwise the digits as written. */
export function normPhone(v: unknown): string {
  const raw = s(v, 30);
  const d = raw.replace(/\D/g, "");
  if (/^639\d{9}$/.test(d)) return `0${d.slice(2)}`;
  if (/^9\d{9}$/.test(d)) return `0${d}`;
  return d.length >= 7 ? d.slice(0, 13) : "";
}

export function cleanCustomer(v: unknown, key: string): ImportCustomer | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const name = s(o.name, 60);
  if (!name) return null;
  return { key, name, phone: normPhone(o.phone), address: s(o.address, 160), notes: s(o.notes, 200), unsure: unsureOf(o.unsure, CUSTOMER_FIELDS) };
}

export function cleanWalkIn(v: unknown, key: string): ImportWalkIn | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const date = s(o.date, 10);
  const amount = n(o.amount, 1_000_000);
  const quantity = n(o.quantity, 1000);
  const customer = s(o.customer, 60);
  if (!customer && !amount && !quantity) return null;
  const unsure = unsureOf(o.unsure, WALKIN_FIELDS);
  const okDate = isDate(date);
  return {
    key,
    date: okDate ? date : "",
    customer,
    service: s(o.service, 60),
    quantity,
    unit: o.unit === "pc" ? "pc" : "kg",
    amount,
    paid: o.paid !== false,
    unsure: okDate ? unsure : Array.from(new Set([...unsure, "date"])),
  };
}
