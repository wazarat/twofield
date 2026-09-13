import { McpServer, createMcpHandler, type AuthInfo } from "@modelcontextprotocol/server";
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { db } from "@/db";
import { agents, jobs, type Agent } from "@/db/schema";
import { assertNameFree } from "@/lib/agent-updates";
import { agentLimits, validateAgentInput } from "@/lib/agents";
import { contextLimits, validateContext } from "@/lib/context";
import { AppError } from "@/lib/errors";
import { briefLimits, fundJob, loadJobFiles, openJob } from "@/lib/jobs";
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

// Discovery and hiring share this query so a specialist cannot be hired unless
// it would also appear in list_specialists at that moment.
async function availableSpecialists(category?: string) {
  return db()
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.kind, "seller"),
        eq(agents.status, "registered"),
        isNotNull(agents.priceUsdc),
        isNull(agents.archivedAt),
        category ? eq(agents.categorySlug, category) : undefined,
      ),
    )
    .orderBy(asc(agents.priceUsdc), asc(agents.name));
}

const ignoredMatchWords = new Set(["a", "an", "and", "for", "in", "of", "on", "or", "the", "to", "with"]);

function matchWords(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((word) => word.length > 1 && !ignoredMatchWords.has(word)),
  );
}

function specialistMatchScore(seller: Agent, intent: string) {
  const wanted = matchWords(intent);
  if (!wanted.size) return 0;
  const fields: Array<[string, number]> = [
    [seller.name, 8],
    [seller.categorySlug ?? "", 5],
    [seller.tagline ?? "", 3],
    [seller.description, 2],
    [seller.persona ?? "", 1],
  ];
  let score = 0;
  for (const [text, weight] of fields) {
    const words = matchWords(text);
    for (const word of wanted) {
      const matches = [...words].some((candidate) => candidate === word || (candidate.length >= 5 && word.length >= 5 && candidate.slice(0, 5) === word.slice(0, 5)));
      if (matches) score += weight;
    }
  }
  return score;
}

function rankedSpecialists(rows: Agent[], intent?: string) {
  if (!intent?.trim()) return rows.map((specialist) => ({ specialist, matchScore: 0 }));
  return rows
    .map((specialist) => ({ specialist, matchScore: specialistMatchScore(specialist, intent) }))
    .sort((a, b) => b.matchScore - a.matchScore || Number(a.specialist.priceUsdc) - Number(b.specialist.priceUsdc) || a.specialist.name.localeCompare(b.specialist.name));
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
    "create_agent",
    {
      description:
        "Create a new twofield buyer agent for this account. The agent starts as a draft; create its wallet from the agent page when it is ready.",
      inputSchema: z.object({
        name: z.string().trim().min(1, "Name is required").max(agentLimits.nameMax).describe("The agent name"),
        description: z
          .string()
          .trim()
          .min(1, "What it works on is required")
          .max(agentLimits.descriptionMax)
          .describe("What the agent works on"),
        maxBudgetPerJob: z
          .number()
          .min(agentLimits.budgetMin)
          .max(agentLimits.budgetMax)
          .default(2)
          .describe("Maximum budget per job in USDC"),
        maxJobs: z
          .number()
          .int()
          .min(agentLimits.jobsMin)
          .max(agentLimits.jobsMax)
          .default(3)
          .describe("Maximum jobs allowed during each period"),
        jobsPeriod: z.enum(["hour", "day", "week"]).default("week").describe("Window used for the maximum job count"),
        maxTotalBudget: z
          .number()
          .min(agentLimits.budgetMin)
          .max(agentLimits.budgetMax)
          .default(5)
          .describe("Maximum total budget in USDC"),
      }),
    },
    async (input) => {
      try {
        const parsed = validateAgentInput(input);
        if (!parsed.ok) throw new AppError(parsed.error, 400);
        await assertNameFree(identity.ownerId, parsed.value.name);

        const [created] = await db()
          .insert(agents)
          .values({
            ownerId: identity.ownerId,
            name: parsed.value.name,
            description: parsed.value.description,
            maxBudgetPerJob: parsed.value.maxBudgetPerJob.toString(),
            maxJobs: parsed.value.maxJobs,
            jobsPeriod: parsed.value.jobsPeriod,
            maxTotalBudget: parsed.value.maxTotalBudget.toString(),
          })
          .returning();

        return ok({ agent: { ...created, url: `${base}/agents/${created.id}` } });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "list_specialists",
    {
      description:
        "List specialists that are currently available to hire and this account's agents that can hire them. Optionally rank specialists by the work the user needs. Call this before hire_specialist.",
      inputSchema: z.object({
        intent: z.string().trim().optional().describe("What the user needs help with; used to rank the closest specialist first"),
        category: z.string().trim().optional().describe("Optional category slug, for example personal-brand"),
      }),
    },
    async ({ intent, category }) => {
      try {
        const [specialistRows, buyerRows] = await Promise.all([
          availableSpecialists(category),
          db()
            .select()
            .from(agents)
            .where(
              and(
                eq(agents.ownerId, identity.ownerId),
                eq(agents.kind, "buyer"),
                isNull(agents.archivedAt),
                isNotNull(agents.walletAddress),
              ),
            )
            .orderBy(desc(agents.createdAt)),
        ]);
        const ranked = rankedSpecialists(specialistRows, intent);
        return ok({
          hiringAgents: buyerRows.map((buyer) => ({
            id: buyer.id,
            name: buyer.name,
            description: buyer.description,
            maxBudgetPerJob: buyer.maxBudgetPerJob,
            maxJobs: buyer.maxJobs,
            jobsPeriod: buyer.jobsPeriod,
            status: buyer.status,
            url: `${base}/agents/${buyer.id}`,
          })),
          specialists: ranked.map(({ specialist, matchScore }) => ({
            ...publicSeller(specialist),
            ...(intent ? { matchScore } : {}),
            url: `${base}/sellers/${specialist.id}`,
          })),
        });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "hire_specialist",
    {
      description:
        "Hire and fund an available twofield specialist. Choose an exact specialist by id or name, or provide an intent so the closest affordable available specialist is selected. Uses the same validation and escrow flow as the web hire form.",
      inputSchema: z.object({
        buyerAgentId: z.string().uuid().describe("Which of the user's configured agents is hiring; use an id from list_specialists"),
        brief: z
          .string()
          .trim()
          .min(briefLimits.min)
          .max(briefLimits.max)
          .describe("Brief for the specialist"),
        context: z.string().max(contextLimits.contextMax).default("").describe("Optional context for the specialist"),
        files: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(contextLimits.nameMax),
              content: z.string().min(1),
            }),
          )
          .max(contextLimits.maxFiles)
          .default([])
          .describe("Optional text files, each supplied as a file name and text content"),
        specialistId: z.string().uuid().optional().describe("Exact available specialist id from list_specialists"),
        specialistName: z.string().trim().min(1).optional().describe("Exact specialist name, matched case-insensitively"),
        intent: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe("The kind of specialist needed; when no exact specialist is chosen, the closest match is selected"),
      }),
    },
    async ({ buyerAgentId, brief, context, files, specialistId, specialistName, intent }) => {
      try {
        if (specialistId && specialistName) throw new AppError("Choose a specialist by id or by name, not both", 400);

        const [buyer] = await db()
          .select()
          .from(agents)
          .where(and(eq(agents.id, buyerAgentId), eq(agents.ownerId, identity.ownerId), eq(agents.kind, "buyer")))
          .limit(1);
        if (!buyer) throw new AppError("Buyer agent not found", 404);

        const available = await availableSpecialists();
        let selected: Agent | undefined;
        let selectedBy: "id" | "name" | "intent" = "intent";

        if (specialistId) {
          selected = available.find((candidate) => candidate.id === specialistId);
          selectedBy = "id";
          if (!selected) throw new AppError("The requested specialist is not currently available", 409);
        } else if (specialistName) {
          const exactName = specialistName.toLocaleLowerCase();
          selected = available.find((candidate) => candidate.name.toLocaleLowerCase() === exactName);
          selectedBy = "name";
          if (!selected) throw new AppError(`No available specialist is named ${specialistName}`, 409);
        } else {
          const affordable = available.filter((candidate) => Number(candidate.priceUsdc) <= Number(buyer.maxBudgetPerJob));
          if (!affordable.length) throw new AppError("No available specialist is within this agent's per-job budget", 409);
          const matchIntent = intent ?? brief;
          const [closest] = rankedSpecialists(affordable, matchIntent);
          if (!closest || (affordable.length > 1 && closest.matchScore === 0)) {
            throw new AppError("Could not confidently match the request to an available specialist. Use list_specialists, then provide specialistId or specialistName.", 400);
          }
          selected = closest.specialist;
        }
        if (!selected) throw new AppError("No available specialist matched this request", 409);

        // Revalidate optional context and files exactly as the web form/API do.
        const attached = validateContext({ context, files });
        if (!attached.ok) throw new AppError(attached.error, 400);

        // openJob repeats the availability check immediately before inserting the job,
        // then enforces ownership, wallet, budget, rate and balance constraints.
        const pending = await openJob(identity.ownerId, buyer, selected, brief, attached.context, attached.files);
        const funded = await fundJob(pending);
        const savedFiles = await loadJobFiles(funded.id);
        return ok({
          selectedBy,
          specialist: { ...publicSeller(selected), url: `${base}/sellers/${selected.id}` },
          job: { ...publicJob(funded, buyer, selected, savedFiles, username ? { username } : null), url: `${base}/jobs/${funded.id}` },
        });
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
