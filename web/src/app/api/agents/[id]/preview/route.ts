import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { buyPreview } from "@/lib/buyer-preview";
import { AppError } from "@/lib/errors";
import { appBaseUrl } from "@/lib/metadata";
import { loadOwnedAgent } from "@/lib/owned-agent";
import { previewBriefLimits } from "@/lib/preview";

export const maxDuration = 120;

// The signed in user's buyer agent pays a seller 0.01 USDC for a pitch.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedAgent(request, id);
  if (result.response) return result.response;
  const body = (await request.json().catch(() => ({}))) as { sellerId?: string; brief?: string };
  const brief = (body.brief ?? "").trim();
  if (!body.sellerId || brief.length < previewBriefLimits.min || brief.length > previewBriefLimits.max) {
    return NextResponse.json({ error: `Pick a specialist and write a brief of ${previewBriefLimits.min} to ${previewBriefLimits.max} characters` }, { status: 400 });
  }
  const [seller] = await db()
    .select()
    .from(agents)
    .where(and(eq(agents.id, body.sellerId), eq(agents.kind, "seller")))
    .limit(1);
  if (!seller) return NextResponse.json({ error: "Specialist not found" }, { status: 404 });
  try {
    const preview = await buyPreview(result.agent, seller, brief, appBaseUrl(request));
    return NextResponse.json({ preview });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    const message = err instanceof Error ? err.message.split("\n")[0] : "Preview failed";
    console.error("buyer preview failed", { agentId: id, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
