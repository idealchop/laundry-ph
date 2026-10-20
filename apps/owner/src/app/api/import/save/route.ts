import { NextResponse } from "next/server";
import { rateLimit, readJson } from "@/lib/server/api";
import { ImportError, requireOwner } from "@/lib/server/import-ai";
import { parseSaveBody, saveImport } from "@/lib/server/import-save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const err = (status: number, code: string, error: string) => NextResponse.json({ error, code }, { status, headers: { "Cache-Control": "no-store" } });

/** POST /api/import/save { shopId, branchId?, customers[], walkIns[] } (reviewed rows). Bearer ID token; owner only. */
export async function POST(req: Request) {
  const body = await readJson(req, 400_000);
  if (!body.ok) return err(413, "payload_too_large", "Too many records at once.");
  const b = (body.body ?? {}) as { shopId?: unknown; branchId?: unknown };
  const shopId = String(b.shopId ?? "");
  let uid: string;
  try { uid = await requireOwner(req, shopId); } catch (e) {
    if (e instanceof ImportError) return err(e.status, e.code, e.message);
    return err(500, "internal", "Could not check your shop.");
  }
  if (rateLimit(`import-save:${uid}`, 10, 10 * 60_000)) return err(429, "rate_limited", "Slow down a little and try again.");
  let input;
  try { input = parseSaveBody(body.body); } catch (e) { return err(400, "invalid_request", (e as Error).message); }
  if (input.customers.length + input.walkIns.length === 0) return err(400, "invalid_request", "Nothing to save.");
  const branchId = typeof b.branchId === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(b.branchId) && b.branchId !== "home" ? b.branchId : undefined;
  try {
    return NextResponse.json(await saveImport(shopId, uid, input, branchId), { status: 201 });
  } catch (e) {
    console.error("[import-save]", (e as Error).message);
    return err(500, "internal", "Could not save your records. Try again.");
  }
}
