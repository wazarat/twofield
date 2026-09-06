import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { registerAgent } from "@/lib/identity";
import { appBaseUrl } from "@/lib/metadata";
import { loadOwnedAgent } from "@/lib/owned-agent";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedAgent(request, id);
  if (result.response) return result.response;

  try {
    const agent = await registerAgent(result.agent, appBaseUrl(request));
    return NextResponse.json({ agent });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Registration failed";
    console.error("registration failed", { agentId: id, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
