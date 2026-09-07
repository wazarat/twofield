import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { appBaseUrl } from "@/lib/metadata";
import { loadOwnedJob } from "@/lib/owned-job";
import { publicJob } from "@/lib/public-job";
import { recordFeedback } from "@/lib/reputation";

export const maxDuration = 120;

// Records the buyer's onchain feedback for a settled job.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedJob(request, id);
  if (result.response) return result.response;
  try {
    const job = await recordFeedback(result.job, appBaseUrl(request));
    return NextResponse.json({ job: publicJob(job, result.buyer, result.seller, result.files, result.owner) });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    const message = err instanceof Error ? err.message.split("\n")[0] : "Feedback failed";
    console.error("feedback failed", { jobId: id, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
