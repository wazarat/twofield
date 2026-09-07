import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, jobs } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { requirePlatformOwner } from "@/lib/platform";
import { publicJob } from "@/lib/public-job";
import { rejectJob } from "@/lib/settlement";
import { appBaseUrl } from "@/lib/metadata";
import { recordFeedback, recordVerdict } from "@/lib/reputation";
import { getUser } from "@/lib/users";

export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformOwner(request);
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { note?: string };
  const [job] = await db().select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  try {
    let updated = await rejectJob(job, (body.note ?? "").trim().slice(0, 500));
    try {
      updated = await recordFeedback(updated, appBaseUrl(request));
    } catch (err) {
      console.error("feedback after reject failed", { jobId: id, message: err instanceof Error ? err.message.split("\n")[0] : String(err) });
    }
    if (job.status === "disputed") {
      // Best effort, the queue offers a retry through the verdict route.
      try {
        updated = await recordVerdict(updated, appBaseUrl(request));
      } catch (err) {
        console.error("verdict after reject failed", { jobId: id, message: err instanceof Error ? err.message.split("\n")[0] : String(err) });
      }
    }
    const [buyer] = await db().select().from(agents).where(eq(agents.id, job.buyerAgentId)).limit(1);
    const [seller] = await db().select().from(agents).where(eq(agents.id, job.sellerAgentId)).limit(1);
    const owner = await getUser(job.ownerId);
    return NextResponse.json({ job: publicJob(updated, buyer, seller, [], owner) });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    const message = err instanceof Error ? err.message.split("\n")[0] : "Rejection failed";
    console.error("reject failed", { jobId: id, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
