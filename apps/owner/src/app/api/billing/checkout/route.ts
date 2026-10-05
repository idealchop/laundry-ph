import { NextResponse } from "next/server";

/**
 * Checkout intent stub.
 * When PAYMONGO_SECRET_KEY is set, this should create a PayMongo Checkout Session
 * (amount in centavos) and return the checkout URL. Until then we acknowledge a
 * demo intent so the client can upgrade the shop via Firestore directly.
 */
export async function POST(req: Request) {
  let body: { shopId?: string; planOptionId?: string; amountCentavos?: number; demo?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const amount = Math.round(Number(body.amountCentavos ?? 0));
  if (!body.shopId || !body.planOptionId || !Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const secret = process.env.PAYMONGO_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({
      mode: "demo",
      message: "PayMongo secret not configured. Client should apply the demo upgrade to shops/{shopId}.",
      shopId: body.shopId,
      planOptionId: body.planOptionId,
      amountCentavos: amount,
      checkoutUrl: null,
    });
  }

  // Placeholder for live PayMongo Checkout Session create.
  // See https://developers.paymongo.com/docs — amount is integer centavos.
  return NextResponse.json({
    mode: "paymongo_stub",
    message: "PAYMONGO_SECRET_KEY is set but live Checkout Session create is not implemented yet.",
    shopId: body.shopId,
    planOptionId: body.planOptionId,
    amountCentavos: amount,
    checkoutUrl: null,
  }, { status: 501 });
}
