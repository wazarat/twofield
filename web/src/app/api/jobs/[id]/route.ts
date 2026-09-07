import { NextResponse } from "next/server";
import { loadOwnedJob } from "@/lib/owned-job";
import { publicJob } from "@/lib/public-job";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedJob(request, id);
  if (result.response) return result.response;
  return NextResponse.json({ job: publicJob(result.job, result.buyer, result.seller, result.files, result.owner) });
}
