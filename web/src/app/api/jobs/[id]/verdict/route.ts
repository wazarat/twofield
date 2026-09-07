import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, jobs } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { appBaseUrl } from "@/lib/metadata";
import { requirePlatformOwner } from "@/lib/platform";
import { publicJob } from "@/lib/public-job";
import { recordVerdict } from "@/lib/reputation";
import { getUser } from "@/lib/users";

export const maxDuration = 120;

// Retries the Validation Registry record for a settled dispute.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformOwner(request);
  if (auth.response) return auth.response;
  const { id } = await params;
  const [job] = await db().select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.rating === null) return NextResponse.json({ error: "Only disputed jobs carry a verdict" }, { status: 409 });
  try {
    const updated = await recordVerdict(job, appBaseUrl(request));
    const [buyer] = await db().select().from(agents).where(eq(agents.id, job.buyerAgentId)).limit(1);
    const [seller] = await db().select().from(agents).where(eq(agents.id, job.sellerAgentId)).limit(1);
    const owner = await getUser(job.ownerId);
    return NextResponse.json({ job: publicJob(updated, buyer, seller, [], owner) });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    const message = err instanceof Error ? err.message.split("\n")[0] : "Verdict failed";
    console.error("verdict failed", { jobId: id, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
