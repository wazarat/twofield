import { NextResponse } from "next/server";
import { introspectMcpToken, isMcpIntrospectionAuthorized } from "@/lib/mcp-auth";

export async function POST(request: Request) {
  if (!isMcpIntrospectionAuthorized(request)) {
    return NextResponse.json({ error: "Invalid introspection credentials" }, { status: 401 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const identity = token ? await introspectMcpToken(token) : null;

  if (!identity) {
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({
    active: true,
    token_type: "Bearer",
    client_id: identity.agentId,
    sub: identity.ownerId,
    agent_id: identity.agentId,
    credential_id: identity.credentialId,
    scope: identity.scopes.join(" "),
    exp: Math.floor(identity.expiresAt.getTime() / 1000),
    claims: {
      sub: identity.ownerId,
      agent_id: identity.agentId,
      credential_id: identity.credentialId,
    },
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
