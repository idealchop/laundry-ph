/**
 * AI import (server only): owner check, file → Gemini parts, Vertex AI call with structured JSON
 * output, and per-shop token cost logging. Uses the backend's service account (ADC); needs
 * roles/aiplatform.user on it. Only the uploaded files and a fixed prompt are sent to the model.
 */
import { applicationDefault } from "firebase-admin/app";
import { FieldValue } from "firebase-admin/firestore";
import { strFromU8, unzipSync } from "fflate";
import { adminAuth, adminDb } from "./admin";
import { cleanCustomer, cleanWalkIn, type ImportExtractResult } from "@/lib/import/types";

export const VERTEX_LOCATION = "asia-southeast1";
export const VERTEX_MODEL = "gemini-2.5-flash";
/** USD per 1M tokens (Gemini 2.5 Flash, Vertex standard). Output includes thinking tokens. */
const PRICE_IN = 0.3;
const PRICE_OUT = 2.5;

export class ImportError extends Error {
  constructor(public status: number, message: string, public code = "internal") { super(message); }
}

/** Firebase ID token → uid that owns (or is an active owner member of) the shop. */
export async function requireOwner(req: Request, shopId: string): Promise<string> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) throw new ImportError(401, "Sign in first.", "unauthorized");
  let uid: string;
  try { uid = (await adminAuth().verifyIdToken(token)).uid; } catch { throw new ImportError(401, "Your session expired. Sign in again.", "unauthorized"); }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(shopId)) throw new ImportError(400, "shopId is required.", "invalid_request");
  const ref = adminDb().collection("shops").doc(shopId);
  const [shop, member] = await Promise.all([ref.get(), ref.collection("members").doc(uid).get()]);
  if (!shop.exists) throw new ImportError(404, "Shop not found.", "not_found");
  const m = member.data();
  const isOwner = shop.get("ownerUid") === uid || (m?.status === "active" && m?.role === "owner");
  if (!isOwner) throw new ImportError(403, "Only the shop owner can import records.", "unauthorized");
  return uid;
}

export type InFile = { name: string; type: string; bytes: Uint8Array };
type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

const IMAGE = /^image\/(png|jpe?g|webp|heic|heif)$/;

/** Minimal .xlsx → CSV (all sheets, shared + inline strings). */
export function xlsxToCsv(bytes: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes, { filter: (f) => f.name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name) }); } catch { throw new ImportError(400, "That Excel file couldn’t be opened.", "invalid_request"); }
  const unxml = (t: string) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const shared = files["xl/sharedStrings.xml"] ? Array.from(strFromU8(files["xl/sharedStrings.xml"]).matchAll(/<si>([\s\S]*?)<\/si>/g), (m) => unxml(Array.from(m[1]!.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g), (t) => t[1]).join(""))) : [];
  const out: string[] = [];
  for (const name of Object.keys(files).filter((k) => k.includes("worksheets")).sort()) {
    out.push(`# ${name.split("/").pop()}`);
    for (const row of strFromU8(files[name]!).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = Array.from(row[1]!.matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g), (c) => {
        const attrs = c[1] ?? ""; const inner = c[2] ?? "";
        const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? inner.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
        const val = /t="s"/.test(attrs) ? shared[Number(v)] ?? "" : unxml(v);
        return /[",\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;
      });
      out.push(cells.join(","));
    }
  }
  return out.join("\n").slice(0, 400_000);
}

export function toParts(files: InFile[]): Part[] {
  return files.map((f): Part => {
    const lower = f.name.toLowerCase();
    if (IMAGE.test(f.type)) return { inlineData: { mimeType: f.type === "image/jpg" ? "image/jpeg" : f.type, data: Buffer.from(f.bytes).toString("base64") } };
    if (f.type === "application/pdf" || lower.endsWith(".pdf")) return { inlineData: { mimeType: "application/pdf", data: Buffer.from(f.bytes).toString("base64") } };
    if (lower.endsWith(".xlsx")) return { text: `File "${f.name.slice(0, 80)}" (spreadsheet as CSV):\n${xlsxToCsv(f.bytes)}` };
    if (f.type.startsWith("text/") || /\.(csv|tsv|txt)$/.test(lower) || f.type === "") return { text: `File "${f.name.slice(0, 80)}":\n${Buffer.from(f.bytes).toString("utf8").slice(0, 400_000)}` };
    throw new ImportError(415, `“${f.name.slice(0, 40)}” isn’t a photo, PDF, Excel, CSV or text file.`, "invalid_request");
  });
}

const PROMPT = (today: string) => `You read a Philippine laundry shop's existing records (photos of handwritten logbooks or notebooks, PDFs, spreadsheets, CSV or plain text; English, Filipino or Taglish) and extract them.
Return two lists:
- customers: every distinct customer (name, phone, address, notes). Merge duplicates of the same person. Use "" for missing fields. Phone as written (PH mobiles usually 09XX XXX XXXX).
- walkIns: every past laundry order / log line: date (YYYY-MM-DD; today is ${today}; logbooks often omit the year, assume the most recent past date), customer name, service (e.g. "Wash-Dry-Fold", "Wash only", "Dry clean", "Comforter"), quantity, unit ("kg" or "pc"), amount in whole pesos (the total for that line), paid (true unless marked unpaid / utang / balance / "UP" / not yet paid).
For each row add "unsure": the field names you could not read confidently (smudged, guessed, ambiguous). Leave it empty when you are confident.
Do not invent rows. Ignore totals, headers and doodles. If nothing is found, return empty lists.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    customers: { type: "ARRAY", items: { type: "OBJECT", properties: {
      name: { type: "STRING" }, phone: { type: "STRING" }, address: { type: "STRING" }, notes: { type: "STRING" },
      unsure: { type: "ARRAY", items: { type: "STRING", enum: ["name", "phone", "address", "notes"] } },
    }, required: ["name", "phone", "address", "notes", "unsure"] } },
    walkIns: { type: "ARRAY", items: { type: "OBJECT", properties: {
      date: { type: "STRING" }, customer: { type: "STRING" }, service: { type: "STRING" }, quantity: { type: "NUMBER" },
      unit: { type: "STRING", enum: ["kg", "pc"] }, amount: { type: "NUMBER" }, paid: { type: "BOOLEAN" },
      unsure: { type: "ARRAY", items: { type: "STRING", enum: ["date", "customer", "service", "quantity", "amount", "paid"] } },
    }, required: ["date", "customer", "service", "quantity", "unit", "amount", "paid", "unsure"] } },
  },
  required: ["customers", "walkIns"],
} as const;

function projectId() {
  return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mylaundryph";
}

/** Call Gemini on Vertex AI and clean the result. */
export async function extractRecords(files: InFile[], today: string): Promise<ImportExtractResult> {
  const parts = toParts(files);
  let token: string;
  try { token = (await applicationDefault().getAccessToken()).access_token; } catch { throw new ImportError(503, "The AI reader isn’t set up on this server yet.", "not_configured"); }
  const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId()}/locations/${VERTEX_LOCATION}/publishers/google/models/${VERTEX_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [...parts, { text: PROMPT(today) }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0, maxOutputTokens: 32768, thinkingConfig: { thinkingBudget: 1024 } },
    }),
    signal: AbortSignal.timeout(110_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { status?: string; message?: string };
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  };
  if (!res.ok) {
    const status = json.error?.status ?? String(res.status);
    console.error(`[import-ai] vertex ${res.status} ${status}: ${(json.error?.message ?? "").slice(0, 300)}`);
    if (res.status === 403 || status === "PERMISSION_DENIED") throw new ImportError(503, "The AI reader isn’t allowed on this server yet (needs roles/aiplatform.user).", "permission_denied");
    if (res.status === 429) throw new ImportError(429, "The AI reader is busy. Try again in a minute.", "rate_limited");
    throw new ImportError(502, "The AI reader couldn’t read these files. Try again.", "internal");
  }
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  let parsed: { customers?: unknown[]; walkIns?: unknown[] } = {};
  try { parsed = JSON.parse(text); } catch { throw new ImportError(502, "The AI reader returned an incomplete answer. Try fewer pages at a time.", "internal"); }
  const u = json.usageMetadata ?? {};
  const inputTokens = u.promptTokenCount ?? 0;
  const outputTokens = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
  const costUsd = Math.round(((inputTokens * PRICE_IN + outputTokens * PRICE_OUT) / 1e6) * 1e6) / 1e6;
  return {
    customers: (parsed.customers ?? []).slice(0, 400).map((c, i) => cleanCustomer(c, `c${i}`)).filter((c) => c != null),
    walkIns: (parsed.walkIns ?? []).slice(0, 400).map((w, i) => cleanWalkIn(w, `w${i}`)).filter((w) => w != null),
    usage: { inputTokens, outputTokens, costUsd },
  };
}

/** shops/{shopId}/ai_usage/{auto}: one row per AI import call (tokens + USD estimate). */
export async function logUsage(shopId: string, uid: string, row: { inputTokens: number; outputTokens: number; costUsd: number; files: number; bytes: number; ok: boolean; found?: number }) {
  console.log(`[import-ai] shop=${shopId} in=${row.inputTokens} out=${row.outputTokens} usd=${row.costUsd} files=${row.files} ok=${row.ok}`);
  const ref = adminDb().collection("shops").doc(shopId);
  await Promise.all([
    ref.collection("ai_usage").add({ kind: "import", model: VERTEX_MODEL, uid, ...row, createdAt: FieldValue.serverTimestamp() }),
    ref.collection("meta").doc("ai_usage").set({ importCalls: FieldValue.increment(1), inputTokens: FieldValue.increment(row.inputTokens), outputTokens: FieldValue.increment(row.outputTokens), costUsd: FieldValue.increment(row.costUsd), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
  ]).catch((e) => console.error("[import-ai] usage log failed:", (e as Error).message));
}
