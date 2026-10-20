import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/api";
import { extractRecords, ImportError, logUsage, requireOwner, type InFile } from "@/lib/server/import-ai";
import { IMPORT_MAX_FILE_BYTES, IMPORT_MAX_FILES, IMPORT_MAX_TOTAL_BYTES } from "@/lib/import/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const err = (status: number, code: string, error: string) => NextResponse.json({ error, code }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * POST /api/import/extract (multipart: shopId, files[]). Authorization: Bearer <Firebase ID token>.
 * The shop owner's uploaded records → { customers, walkIns, usage } for review. Nothing is saved here.
 */
export async function POST(req: Request) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > IMPORT_MAX_TOTAL_BYTES + 64_000) return err(413, "payload_too_large", "Those files are too big together. Try fewer pages at a time.");
  let form: FormData;
  try { form = await req.formData(); } catch { return err(400, "invalid_request", "Upload your files again."); }
  const shopId = String(form.get("shopId") ?? "");
  let uid: string;
  try { uid = await requireOwner(req, shopId); } catch (e) {
    if (e instanceof ImportError) return err(e.status, e.code, e.message);
    return err(500, "internal", "Could not check your shop.");
  }
  const retry = rateLimit(`import-extract:${uid}`, 6, 10 * 60_000) ?? rateLimit(`import-extract-shop:${shopId}`, 20, 24 * 60 * 60_000);
  if (retry) return err(429, "rate_limited", `You’ve read a lot of records just now. Try again in ${Math.ceil(retry / 60)} min.`);

  const blobs = form.getAll("files").filter((f): f is File => typeof f !== "string");
  if (blobs.length === 0) return err(400, "invalid_request", "Add at least one photo or file.");
  if (blobs.length > IMPORT_MAX_FILES) return err(400, "invalid_request", `Up to ${IMPORT_MAX_FILES} files at a time.`);
  let total = 0;
  const files: InFile[] = [];
  for (const f of blobs) {
    if (f.size > IMPORT_MAX_FILE_BYTES) return err(413, "payload_too_large", `“${f.name.slice(0, 40)}” is over ${IMPORT_MAX_FILE_BYTES / 1024 / 1024} MB.`);
    total += f.size;
    files.push({ name: f.name || "file", type: (f.type || "").toLowerCase(), bytes: new Uint8Array(await f.arrayBuffer()) });
  }
  if (total > IMPORT_MAX_TOTAL_BYTES) return err(413, "payload_too_large", "Those files are too big together. Try fewer pages at a time.");

  const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
  try {
    const out = await extractRecords(files, today);
    await logUsage(shopId, uid, { ...out.usage, files: files.length, bytes: total, ok: true, found: out.customers.length + out.walkIns.length });
    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ImportError) {
      await logUsage(shopId, uid, { inputTokens: 0, outputTokens: 0, costUsd: 0, files: files.length, bytes: total, ok: false });
      return err(e.status, e.code, e.message);
    }
    console.error("[import-ai] extract:", (e as Error).message);
    return err(500, "internal", "Could not read your records. Try again.");
  }
}
