import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { appBaseUrl } from "@/lib/metadata";
import { loadOwnedJob } from "@/lib/owned-job";
import { publicJob } from "@/lib/public-job";
import { recordFeedback } from "@/lib/reputation";
import { rateJob } from "@/lib/settlement";

export const maxDuration = 120;

// The buyer rates submitted work. The score settles or holds escrow, then goes on chain.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedJob(request, id);
  if (result.response) return result.response;
  const body = (await request.json().catch(() => ({}))) as { score?: unknown };
  try {
    let job = await rateJob(result.job, Number(body.score));
    try {
      job = await recordFeedback(job, appBaseUrl(request));
    } catch (err) {
      // The job page retries feedback on its own. Settlement already happened.
      console.error("feedback after rating failed", { jobId: id, message: err instanceof Error ? err.message.split("\n")[0] : String(err) });
    }
    return NextResponse.json({ job: publicJob(job, result.buyer, result.seller, result.files, result.owner) });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    const message = err instanceof Error ? err.message.split("\n")[0] : "Rating failed";
    console.error("rate failed", { jobId: id, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
