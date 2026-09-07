import { NextResponse } from "next/server";
import { loadJobFiles } from "@/lib/jobs";
import { loadOwnedJob } from "@/lib/owned-job";
import { publicJob } from "@/lib/public-job";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedJob(request, id);
  if (result.response) return result.response;
  const files = await loadJobFiles(result.job.id);
  return NextResponse.json({ job: publicJob(result.job, result.buyer, result.seller, files) });
}
