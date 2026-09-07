import { NextResponse } from "next/server";
import { archiveAgent } from "@/lib/archive";
import { AppError } from "@/lib/errors";
import { loadOwnedAgent } from "@/lib/owned-agent";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedAgent(request, id);
  if (result.response) return result.response;
  try {
    const agent = await archiveAgent(result.agent);
    return NextResponse.json({ agent });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    const message = err instanceof Error ? err.message.split("\n")[0].slice(0, 300) : "Could not archive the agent";
    console.error("archive failed", { agentId: id, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
