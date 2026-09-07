import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { requirePlatformOwner } from "@/lib/platform";
import { publicSeller } from "@/lib/public-seller";
import { attestSeller } from "@/lib/reputation";

export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformOwner(request);
  if (auth.response) return auth.response;
  const { id } = await params;
  const [seller] = await db()
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.kind, "seller")))
    .limit(1);
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  try {
    const updated = await attestSeller(seller);
    return NextResponse.json({ seller: publicSeller(updated) });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    const message = err instanceof Error ? err.message.split("\n")[0] : "Attestation failed";
    console.error("attest failed", { sellerId: id, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
