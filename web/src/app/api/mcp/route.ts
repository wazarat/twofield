import { McpServer, createMcpHandler, type AuthInfo } from "@modelcontextprotocol/server";
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { db } from "@/db";
import { agents, jobs, type Agent } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { loadJobFiles } from "@/lib/jobs";
import { introspectMcpToken, type McpIdentity } from "@/lib/mcp-auth";
import { appBaseUrl } from "@/lib/metadata";
import { publicJob } from "@/lib/public-job";
import { publicSeller } from "@/lib/public-seller";
import { getUser } from "@/lib/users";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// What the route hands to the MCP handler for one request. The SDK passes it through
// untouched, every tool below closes over it.
type Session = { agent: Agent; identity: McpIdentity; base: string; username: string | null };

function ok(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
}

function failed(err: unknown) {
  const message = err instanceof Error ? err.message : "Request failed";
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

async function sellerById(id: string) {
  if (!uuidPattern.test(id)) throw new AppError("Specialist not found", 404);
  const [row] = await db()
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.kind, "seller")))
    .limit(1);
  if (!row) throw new AppError("Specialist not found", 404);
  return row;
}

// A fresh server per request, bound to the agent the token belongs to.
const handler = createMcpHandler(async (ctx) => {
  const session = ctx.authInfo?.extra?.session as Session | undefined;
  if (!session) throw new AppError("Sign in required", 401);
  const { agent, identity, base, username } = session;
  const server = new McpServer({ name: "twofield", version: "1.0.0" });

  server.registerTool(
    "whoami",
    {
      description: "The twofield buyer agent this connection acts as, with its budgets, wallet and onchain identity.",
      inputSchema: z.object({}),
    },
    async () =>
      ok({
        agent: {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          owner: username,
          maxBudgetPerJob: agent.maxBudgetPerJob,
          maxJobs: agent.maxJobs,
          jobsPeriod: agent.jobsPeriod,
          maxTotalBudget: agent.maxTotalBudget,
          walletAddress: agent.walletAddress,
          onchainAgentId: agent.onchainAgentId,
          status: agent.status,
          url: `${base}/agents/${agent.id}`,
        },
        token: { credentialId: identity.credentialId, scopes: identity.scopes, expiresAt: identity.expiresAt },
      }),
  );

  server.registerTool(
    "list_specialists",
    {
      description: "Specialists for hire on twofield, cheapest first. Filter by category slug, for example personal-brand.",
      inputSchema: z.object({ category: z.string().optional() }),
    },
    async ({ category }) => {
      try {
        const where = category ? and(eq(agents.kind, "seller"), eq(agents.categorySlug, category)) : eq(agents.kind, "seller");
        const rows = await db().select().from(agents).where(where).orderBy(asc(agents.priceUsdc), asc(agents.name));
        return ok({ specialists: rows.map((row) => ({ ...publicSeller(row), url: `${base}/sellers/${row.id}` })) });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "get_specialist",
    {
      description: "One specialist by id, with price, reputation, attestation and how many disputes went to the buyer.",
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => {
      try {
        const seller = await sellerById(id);
        const upheld = await db()
          .select({ id: jobs.id })
          .from(jobs)
          .where(and(eq(jobs.sellerAgentId, seller.id), eq(jobs.status, "refunded"), isNotNull(jobs.rating)));
        return ok({ specialist: { ...publicSeller(seller, { disputesUpheld: upheld.length }), url: `${base}/sellers/${seller.id}` } });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "list_jobs",
    {
      description: "Jobs this agent has opened, newest first, without the deliverable text. Use get_job for one job in full.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const rows = await db().select().from(jobs).where(eq(jobs.buyerAgentId, agent.id)).orderBy(desc(jobs.createdAt));
        const sellers = await db().select().from(agents).where(eq(agents.kind, "seller"));
        const byId = new Map(sellers.map((s) => [s.id, s]));
        const list = rows.map((row) => {
          const { deliverable, files, ...rest } = publicJob(row, agent, byId.get(row.sellerAgentId), [], username ? { username } : null);
          void deliverable;
          void files;
          return { ...rest, url: `${base}/jobs/${row.id}` };
        });
        return ok({ jobs: list });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "get_job",
    {
      description: "One of this agent's jobs in full, brief, context files, deliverable, rating and every receipt transaction.",
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => {
      try {
        if (!uuidPattern.test(id)) throw new AppError("Job not found", 404);
        const [row] = await db()
          .select()
          .from(jobs)
          .where(and(eq(jobs.id, id), eq(jobs.buyerAgentId, agent.id)))
          .limit(1);
        if (!row) throw new AppError("Job not found", 404);
        const [seller] = await db().select().from(agents).where(eq(agents.id, row.sellerAgentId)).limit(1);
        const files = await loadJobFiles(row.id);
        return ok({ job: { ...publicJob(row, agent, seller, files, username ? { username } : null), url: `${base}/jobs/${row.id}` } });
      } catch (err) {
        return failed(err);
      }
    },
  );

  return server;
});

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401, headers: { "www-authenticate": 'Bearer realm="twofield"' } });
}

// Streamable HTTP entry point. The token is checked here, the SDK never sees headers.
export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return unauthorized("Send an MCP token as a bearer token. Create one on the agent page.");
  const identity = await introspectMcpToken(token);
  if (!identity) return unauthorized("This MCP token is invalid, expired or revoked");

  const [agent] = await db()
    .select()
    .from(agents)
    .where(and(eq(agents.id, identity.agentId), eq(agents.ownerId, identity.ownerId), eq(agents.kind, "buyer"), isNull(agents.archivedAt)))
    .limit(1);
  if (!agent) return NextResponse.json({ error: "This agent is archived or gone. Create a token for another agent." }, { status: 403 });

  const owner = await getUser(identity.ownerId);
  const session: Session = { agent, identity, base: appBaseUrl(request), username: owner?.username ?? null };
  const authInfo: AuthInfo = {
    token,
    clientId: identity.agentId,
    scopes: identity.scopes,
    expiresAt: Math.floor(identity.expiresAt.getTime() / 1000),
    extra: { session },
  };
  return handler.fetch(request, { authInfo });
}

// The stateless transport has no session stream to open or close.
export function GET() {
  return NextResponse.json({ error: "Method not allowed. Send MCP requests as POST." }, { status: 405, headers: { allow: "POST" } });
}

export function DELETE() {
  return NextResponse.json({ error: "Method not allowed. Send MCP requests as POST." }, { status: 405, headers: { allow: "POST" } });
}
