import { NextResponse } from "next/server";

/**
 * PayMongo webhook stub.
 *
 * Expected production flow:
 * 1. Verify `Paymongo-Signature` HMAC with PAYMONGO_WEBHOOK_SECRET.
 * 2. On checkout_session.payment.paid / payment.paid, read metadata.shopId + planOptionId.
 * 3. Admin SDK update shops/{shopId}:
 *      tier: "paid"
 *      planSource: "subscription" | "lifetime"
 *      planExpiresAt: null (lifetime) or now+30d (monthly)
 *      planUpdatedAt: serverTimestamp()
 * 4. Append shops/{shopId}/billing/{eventId} for idempotency.
 *
 * Money in the event payload is integer centavos (49900 = ₱499, 1000000 = ₱10,000).
 */
export async function POST(req: Request) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  const raw = await req.text();
  const signature = req.headers.get("paymongo-signature") ?? req.headers.get("Paymongo-Signature");

  if (!secret) {
    return NextResponse.json({
      ok: false,
      mode: "stub",
      message: "PAYMONGO_WEBHOOK_SECRET not set. Accepting nothing; structure only.",
      receivedBytes: raw.length,
      hasSignature: Boolean(signature),
    }, { status: 501 });
  }

  // Do not process without a real verifier — avoid forging plan upgrades.
  return NextResponse.json({
    ok: false,
    mode: "stub",
    message: "Webhook signature verification + Admin SDK plan write not implemented yet.",
  }, { status: 501 });
}

export async function GET() {
  return NextResponse.json({
    service: "laundry-ph-billing-webhook",
    status: "stub",
    expects: "POST PayMongo events with HMAC signature",
  });
}
