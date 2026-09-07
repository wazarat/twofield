import { NextResponse } from "next/server";
import { fundJob } from "@/lib/jobs";
import { loadOwnedJob } from "@/lib/owned-job";
import { publicJob } from "@/lib/public-job";

export const maxDuration = 120;

// Resumes the escrow steps after a failure.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedJob(request, id);
  if (result.response) return result.response;
  const job = await fundJob(result.job);
  return NextResponse.json({ job: publicJob(job, result.buyer, result.seller) });
}
