import { NextResponse } from "next/server";
import { loadOwnedAgent } from "@/lib/owned-agent";
import { WalletError, createAgentWallet } from "@/lib/wallets";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedAgent(request, id);
  if (result.response) return result.response;

  try {
    const agent = await createAgentWallet(result.agent);
    return NextResponse.json({ agent });
  } catch (err) {
    if (err instanceof WalletError) {
      return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Wallet creation failed";
    console.error("wallet creation failed", { agentId: id, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
