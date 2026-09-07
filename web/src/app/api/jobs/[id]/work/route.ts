import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { loadOwnedJob } from "@/lib/owned-job";
import { publicJob } from "@/lib/public-job";
import { submitWork } from "@/lib/settlement";

export const maxDuration = 300;

// Starts or resumes the specialist's work on a funded job.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedJob(request, id);
  if (result.response) return result.response;
  try {
    const job = await submitWork(result.job);
    return NextResponse.json({ job: publicJob(job, result.buyer, result.seller, result.files, result.owner) });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    const message = err instanceof Error ? err.message : "Work failed";
    console.error("work failed", { jobId: id, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
