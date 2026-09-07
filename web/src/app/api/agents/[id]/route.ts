import { NextResponse } from "next/server";
import { updateAgent } from "@/lib/agent-updates";
import { AppError } from "@/lib/errors";
import { loadOwnedAgent } from "@/lib/owned-agent";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedAgent(request, id);
  if (result.response) return result.response;
  return NextResponse.json({ agent: result.agent });
}

export const maxDuration = 60;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedAgent(request, id);
  if (result.response) return result.response;
  const body = await request.json().catch(() => null);
  try {
    const outcome = await updateAgent(result.agent, body);
    return NextResponse.json(outcome);
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    const message = err instanceof Error ? err.message.split("\n")[0].slice(0, 300) : "Could not update the agent";
    console.error("agent update failed", { agentId: id, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
