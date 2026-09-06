import { NextResponse } from "next/server";
import { loadOwnedAgent } from "@/lib/owned-agent";
import { agentBalance } from "@/lib/wallets";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedAgent(request, id);
  if (result.response) return result.response;
  if (!result.agent.walletAddress) return NextResponse.json({ error: "This agent has no wallet yet" }, { status: 409 });

  const balance = await agentBalance(result.agent.walletAddress);
  return NextResponse.json({ balance });
}
