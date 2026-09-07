import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { generatePitch, previewBriefLimits } from "@/lib/preview";
import { PaymentError, paymentRequired, verifyAndSettle } from "@/lib/x402";

export const maxDuration = 120;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public and metered. Returns 402 with x402 payment requirements until the caller
// pays 0.01 USDC to the seller wallet, then answers with the seller's pitch.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  const [seller] = await db()
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.kind, "seller")))
    .limit(1);
  if (!seller || seller.status !== "registered" || !seller.walletAddress) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const brief = (url.searchParams.get("brief") ?? "").trim();
  if (brief.length < previewBriefLimits.min || brief.length > previewBriefLimits.max) {
    return NextResponse.json({ error: `The brief must be ${previewBriefLimits.min} to ${previewBriefLimits.max} characters` }, { status: 400 });
  }

  const signature = request.headers.get("payment-signature");
  if (!signature) {
    const required = paymentRequired(url.toString(), seller);
    return NextResponse.json(required.body, { status: 402, headers: { "PAYMENT-REQUIRED": required.header } });
  }

  try {
    const settlement = await verifyAndSettle(signature, seller);
    const pitch = await generatePitch(seller, brief);
    return NextResponse.json(
      { seller: { id: seller.id, name: seller.name }, pitch, payment: { transaction: settlement.transaction, payer: settlement.payer, amount: settlement.amount } },
      { headers: { "PAYMENT-RESPONSE": settlement.header } },
    );
  } catch (err) {
    if (err instanceof PaymentError) {
      const required = paymentRequired(url.toString(), seller);
      return NextResponse.json({ ...required.body, error: err.message }, { status: err.status, headers: { "PAYMENT-REQUIRED": required.header } });
    }
    const message = err instanceof Error ? err.message.split("\n")[0] : "Preview failed";
    console.error("preview failed", { sellerId: id, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
