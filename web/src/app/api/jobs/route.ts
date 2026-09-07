import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, jobs } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { fundJob, openJob } from "@/lib/jobs";
import { publicJob } from "@/lib/public-job";

export const maxDuration = 120;

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const agentId = new URL(request.url).searchParams.get("agent");
  const where = agentId ? and(eq(jobs.ownerId, auth.userId), eq(jobs.buyerAgentId, agentId)) : eq(jobs.ownerId, auth.userId);
  const rows = await db().select().from(jobs).where(where).orderBy(desc(jobs.createdAt));
  const sellerIds = [...new Set(rows.map((r) => r.sellerAgentId))];
  const sellers = sellerIds.length ? await db().select().from(agents).where(eq(agents.kind, "seller")) : [];
  const byId = new Map(sellers.map((s) => [s.id, s]));
  return NextResponse.json({ jobs: rows.map((r) => publicJob(r, undefined, byId.get(r.sellerAgentId))) });
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => ({}))) as { buyerAgentId?: string; sellerAgentId?: string; brief?: string };
  if (!body.buyerAgentId || !body.sellerAgentId || typeof body.brief !== "string") {
    return NextResponse.json({ error: "Buyer agent, specialist and brief are required" }, { status: 400 });
  }
  try {
    const [buyer] = await db().select().from(agents).where(eq(agents.id, body.buyerAgentId)).limit(1);
    const [seller] = await db().select().from(agents).where(eq(agents.id, body.sellerAgentId)).limit(1);
    if (!buyer) throw new AppError("Buyer agent not found", 404);
    if (!seller) throw new AppError("Specialist not found", 404);
    const pending = await openJob(auth.userId, buyer, seller, body.brief);
    const job = await fundJob(pending);
    return NextResponse.json({ job: publicJob(job, buyer, seller) }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    const message = err instanceof Error ? err.message : "Could not open the job";
    console.error("job open failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
