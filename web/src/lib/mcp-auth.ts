import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { mcpCredentials } from "@/db/schema";

export const MCP_SCOPE = "mcp:identity";
export const MCP_TOKEN_PREFIX = "twf_mcp_";
const MCP_TOKEN_DAYS = 30;

export type McpIdentity = {
  credentialId: string;
  ownerId: string;
  agentId: string;
  scopes: string[];
  expiresAt: Date;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function makeToken() {
  return `${MCP_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export async function issueMcpCredential(ownerId: string, agentId: string) {
  const token = makeToken();
  const expiresAt = new Date(Date.now() + MCP_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  const [credential] = await db()
    .insert(mcpCredentials)
    .values({
      tokenHash: hashToken(token),
      tokenPrefix: token.slice(0, MCP_TOKEN_PREFIX.length + 8),
      ownerId,
      agentId,
      scopes: MCP_SCOPE,
      expiresAt,
    })
    .returning({ id: mcpCredentials.id, expiresAt: mcpCredentials.expiresAt, scopes: mcpCredentials.scopes });

  if (!credential) throw new Error("Could not create MCP credential");

  return {
    id: credential.id,
    token,
    expiresAt: credential.expiresAt,
    scopes: credential.scopes.split(" ").filter(Boolean),
  };
}

export async function introspectMcpToken(token: string): Promise<McpIdentity | null> {
  if (!token.startsWith(MCP_TOKEN_PREFIX)) return null;

  const [credential] = await db()
    .select({
      id: mcpCredentials.id,
      ownerId: mcpCredentials.ownerId,
      agentId: mcpCredentials.agentId,
      scopes: mcpCredentials.scopes,
      expiresAt: mcpCredentials.expiresAt,
    })
    .from(mcpCredentials)
    .where(and(eq(mcpCredentials.tokenHash, hashToken(token)), isNull(mcpCredentials.revokedAt)))
    .limit(1);

  if (!credential || credential.expiresAt.getTime() <= Date.now()) return null;

  await db().update(mcpCredentials).set({ lastUsedAt: new Date() }).where(eq(mcpCredentials.id, credential.id));

  return {
    credentialId: credential.id,
    ownerId: credential.ownerId,
    agentId: credential.agentId,
    scopes: credential.scopes.split(" ").filter(Boolean),
    expiresAt: credential.expiresAt,
  };
}

export async function revokeMcpCredentials(ownerId: string, agentId: string) {
  const result = await db()
    .update(mcpCredentials)
    .set({ revokedAt: new Date() })
    .where(and(eq(mcpCredentials.ownerId, ownerId), eq(mcpCredentials.agentId, agentId), isNull(mcpCredentials.revokedAt)))
    .returning({ id: mcpCredentials.id });
  return result.length;
}

export function isMcpIntrospectionAuthorized(request: Request) {
  const expected = process.env.MCP_INTROSPECTION_SECRET ?? "";
  const received = request.headers.get("x-mcp-introspection-secret") ?? "";
  if (!expected || !received) return false;

  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}
