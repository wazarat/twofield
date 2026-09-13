import { NextResponse } from "next/server";
import { issueMcpCredential, revokeMcpCredentials } from "@/lib/mcp-auth";
import { loadOwnedAgent } from "@/lib/owned-agent";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedAgent(request, id);
  if (result.response) return result.response;

  if (result.agent.kind !== "buyer") {
    return NextResponse.json({ error: "Only buyer agents can connect to MCP" }, { status: 400 });
  }
  if (result.agent.archivedAt) {
    return NextResponse.json({ error: "Archived agents cannot create MCP credentials" }, { status: 400 });
  }

  try {
    const credential = await issueMcpCredential(result.agent.ownerId, result.agent.id);
    return NextResponse.json(
      {
        credential: {
          ...credential,
          expiresAt: credential.expiresAt.toISOString(),
        },
        warning: "Store this token now. It will not be shown again.",
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create MCP credential";
    console.error("MCP credential creation failed", { agentId: id, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedAgent(request, id);
  if (result.response) return result.response;

  const revoked = await revokeMcpCredentials(result.agent.ownerId, result.agent.id);
  return NextResponse.json({ revoked });
}

export const runtime = "nodejs";
