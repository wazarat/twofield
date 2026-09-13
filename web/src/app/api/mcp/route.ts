import { McpServer, createMcpHandler, type AuthInfo } from "@modelcontextprotocol/server";
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { db } from "@/db";
import { agents, jobs, jobStatuses, previews, type Agent, type Job } from "@/db/schema";
import { assertNameFree, updateAgent } from "@/lib/agent-updates";
import { agentLimits, validateAgentInput } from "@/lib/agents";
import { archiveAgent } from "@/lib/archive";
import { explorerTx } from "@/lib/arc";
import { buyPreview } from "@/lib/buyer-preview";
import { categories, getCategory } from "@/lib/categories";
import { contextLimits, validateContext } from "@/lib/context";
import { AppError } from "@/lib/errors";
import { registerAgent } from "@/lib/identity";
import { briefLimits, fundJob, loadJobFiles, openJob } from "@/lib/jobs";
import { introspectMcpToken, type McpIdentity } from "@/lib/mcp-auth";
import { appBaseUrl } from "@/lib/metadata";
import { publicJob } from "@/lib/public-job";
import { publicSeller } from "@/lib/public-seller";
import { previewBriefLimits } from "@/lib/preview";
import { recordFeedback } from "@/lib/reputation";
import { approveJob, rateJob, submitWork } from "@/lib/settlement";
import { getUser } from "@/lib/users";
import { agentBalance, createAgentWallet, walletOptionsFor } from "@/lib/wallets";
import { PREVIEW_PRICE_USDC } from "@/lib/x402";

export const runtime = "nodejs";
export const maxDuration = 300;
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
  const details = err instanceof AppError ? { error: message, status: err.status, details: err.details } : { error: message };
  return { content: [{ type: "text" as const, text: JSON.stringify(details, null, 2) }], isError: true };
}

function transactionReceipt(hash: string | null) {
  return hash ? { hash, explorerUrl: explorerTx(hash) } : null;
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

async function ownedBuyer(ownerId: string, id: string) {
  if (!uuidPattern.test(id)) throw new AppError("Agent not found", 404);
  const [row] = await db()
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.ownerId, ownerId), eq(agents.kind, "buyer")))
    .limit(1);
  if (!row) throw new AppError("Agent not found", 404);
  return row;
}

async function ownedJob(ownerId: string, id: string) {
  if (!uuidPattern.test(id)) throw new AppError("Job not found", 404);
  const [job] = await db()
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.ownerId, ownerId)))
    .limit(1);
  if (!job) throw new AppError("Job not found", 404);
  const [[buyer], [seller], files] = await Promise.all([
    db().select().from(agents).where(eq(agents.id, job.buyerAgentId)).limit(1),
    db().select().from(agents).where(eq(agents.id, job.sellerAgentId)).limit(1),
    loadJobFiles(job.id),
  ]);
  if (!buyer || !seller) throw new AppError("A job participant is no longer available", 409);
  return { job, buyer, seller, files };
}

function mcpAgent(row: Agent, base: string) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    maxBudgetPerJob: row.maxBudgetPerJob,
    maxJobs: row.maxJobs,
    jobsPeriod: row.jobsPeriod,
    maxTotalBudget: row.maxTotalBudget,
    status: row.status,
    walletAddress: row.walletAddress,
    onchainAgentId: row.onchainAgentId,
    metadataUri: row.metadataUri,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    transactions: {
      initialFunding: transactionReceipt(row.fundingTx),
      identityRegistration: transactionReceipt(row.registrationTx),
      latestTopUp: transactionReceipt(row.topUpTx),
      archiveSweep: transactionReceipt(row.sweepTx),
    },
    url: `${base}/agents/${row.id}`,
  };
}

function mcpJob(result: Awaited<ReturnType<typeof ownedJob>>, base: string, username: string | null) {
  return {
    ...publicJob(result.job, result.buyer, result.seller, result.files, username ? { username } : null),
    url: `${base}/jobs/${result.job.id}`,
  };
}

function nextJobAction(job: Job) {
  if (!job.fundTx && ["pending", "created", "budgeted", "failed"].includes(job.status)) {
    return { tool: "retry_job_funding", arguments: { jobId: job.id }, description: "Resume the escrow funding flow." };
  }
  if (["funded", "generating"].includes(job.status)) {
    return { tool: "start_job_work", arguments: { jobId: job.id }, description: "Start or resume the specialist's work." };
  }
  if (job.status === "submitted" && job.rating === null) {
    return { tool: "review_job", arguments: { jobId: job.id }, description: "Inspect the deliverable, then add a score from 1 to 5." };
  }
  if (job.rating !== null && !job.feedbackTx) {
    return { tool: "retry_job_feedback", arguments: { jobId: job.id }, description: "Record the existing rating onchain." };
  }
  return null;
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
        isNotNull(agents.walletId),
        isNotNull(agents.walletAddress),
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
    "list_my_agents",
    {
      description: "List all buyer agents owned by the authenticated user, separated into active and archived agents.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const rows = await db()
          .select()
          .from(agents)
          .where(and(eq(agents.ownerId, identity.ownerId), eq(agents.kind, "buyer")))
          .orderBy(desc(agents.createdAt));
        return ok({
          active: rows
            .filter((row) => !row.archivedAt)
            .map((row) => ({ ...mcpAgent(row, base), isConnectionAgent: row.id === identity.agentId })),
          archived: rows
            .filter((row) => Boolean(row.archivedAt))
            .map((row) => ({ ...mcpAgent(row, base), isConnectionAgent: row.id === identity.agentId })),
        });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "get_agent",
    {
      description: "Get the configuration, setup progress, identity and transaction receipts for one buyer agent owned by this user.",
      inputSchema: z.object({ agentId: z.string().uuid() }),
    },
    async ({ agentId }) => {
      try {
        return ok({ agent: mcpAgent(await ownedBuyer(identity.ownerId, agentId), base) });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "get_agent_balance",
    {
      description: "Read the current USDC balance of a wallet-backed buyer agent owned by this user.",
      inputSchema: z.object({ agentId: z.string().uuid() }),
    },
    async ({ agentId }) => {
      try {
        const owned = await ownedBuyer(identity.ownerId, agentId);
        if (!owned.walletAddress) throw new AppError("This agent has no wallet yet", 409);
        return ok({
          agent: { id: owned.id, name: owned.name, walletAddress: owned.walletAddress },
          balanceUsdc: await agentBalance(owned.walletAddress),
        });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "update_agent",
    {
      description:
        "Update an owned buyer agent. Raising maxTotalBudget funds the difference from the platform wallet, and changing maxBudgetPerJob rewrites an existing wallet policy, matching the web form.",
      inputSchema: z.object({
        agentId: z.string().uuid(),
        name: z.string().trim().min(1).max(agentLimits.nameMax).optional(),
        description: z.string().trim().max(agentLimits.descriptionMax).optional(),
        maxBudgetPerJob: z.number().min(agentLimits.budgetMin).max(agentLimits.budgetMax).optional(),
        maxJobs: z.number().int().min(agentLimits.jobsMin).max(agentLimits.jobsMax).optional(),
        jobsPeriod: z.enum(["hour", "day", "week"]).optional(),
        maxTotalBudget: z.number().min(agentLimits.budgetMin).max(agentLimits.budgetMax).optional(),
      }),
    },
    async ({ agentId, ...changes }) => {
      try {
        const owned = await ownedBuyer(identity.ownerId, agentId);
        const outcome = await updateAgent(owned, changes);
        return ok({
          agent: mcpAgent(outcome.agent, base),
          topUpUsdc: outcome.topUpUsdc,
          policyRewritten: outcome.policyRewritten,
        });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "register_agent_identity",
    {
      description: "Register a wallet-ready buyer agent owned by this user on the ERC-8004 Identity Registry.",
      inputSchema: z.object({ agentId: z.string().uuid() }),
    },
    async ({ agentId }) => {
      try {
        const registered = await registerAgent(await ownedBuyer(identity.ownerId, agentId), base);
        return ok({
          agent: mcpAgent(registered, base),
          nextAction: { tool: "list_specialists", arguments: {}, description: "Find an available specialist to hire." },
        });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "archive_agent",
    {
      description:
        "Archive an owned buyer agent and return its remaining wallet balance to the platform wallet. Open jobs prevent archival. This cannot currently be undone and requires confirm=true.",
      inputSchema: z.object({
        agentId: z.string().uuid(),
        confirm: z.literal(true).describe("Must be true to confirm this irreversible archive action"),
      }),
    },
    async ({ agentId }) => {
      try {
        const archived = await archiveAgent(await ownedBuyer(identity.ownerId, agentId));
        return ok({
          agent: mcpAgent(archived, base),
          connectionRevoked: agentId === identity.agentId,
          note: agentId === identity.agentId ? "This MCP credential belonged to the archived agent and cannot be used for another request." : null,
        });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "create_agent",
    {
      description:
        "Create a new twofield buyer agent for this account. The agent starts as a draft and the result offers create_agent_wallet as the follow-up needed before it can hire.",
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

        return ok({
          agent: mcpAgent(created, base),
          nextAction: {
            tool: "create_agent_wallet",
            arguments: { agentId: created.id },
            description: "Create and fund this draft agent's wallet so it can hire specialists.",
          },
        });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "create_agent_wallet",
    {
      description:
        "Create and fund the wallet for one of this account's draft buyer agents. This creates its spending policy and transfers its configured total budget plus the gas buffer from the platform wallet. The operation is resumable if a step fails.",
      inputSchema: z.object({
        agentId: z.string().uuid().describe("The draft agent id returned by create_agent or list_specialists"),
      }),
    },
    async ({ agentId }) => {
      try {
        const [draft] = await db()
          .select()
          .from(agents)
          .where(and(eq(agents.id, agentId), eq(agents.ownerId, identity.ownerId), eq(agents.kind, "buyer")))
          .limit(1);
        if (!draft) throw new AppError("Agent not found", 404);

        const options = walletOptionsFor(draft);
        const ready = await createAgentWallet(draft, options);
        return ok({
          agent: mcpAgent(ready, base),
          wallet: {
            address: ready.walletAddress,
            fundingUsdc: options.fundingUsdc,
            fundingTransaction: ready.fundingTx,
          },
          nextAction: {
            tool: "register_agent_identity",
            arguments: { agentId: ready.id },
            description: "Register this wallet-backed agent's onchain identity.",
          },
        });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "list_specialists",
    {
      description:
        "List specialists that are currently available to hire, the field each belongs to, all six supported fields, and this account's agents that can hire them. Optionally rank specialists by the work the user needs. Call this before hire_specialist.",
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
                inArray(agents.status, ["wallet_ready", "registered"]),
                isNull(agents.archivedAt),
                isNotNull(agents.walletId),
                isNotNull(agents.walletAddress),
              ),
            )
            .orderBy(desc(agents.createdAt)),
        ]);
        const ranked = rankedSpecialists(specialistRows, intent);
        return ok({
          fields: categories.map((field) => ({ slug: field.slug, name: field.name })),
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
          specialists: ranked.map(({ specialist, matchScore }) => {
            const field = specialist.categorySlug ? getCategory(specialist.categorySlug) : undefined;
            return {
              ...publicSeller(specialist),
              field: field ? { slug: field.slug, name: field.name, description: field.blurb } : null,
              ...(intent ? { matchScore } : {}),
              url: `${base}/sellers/${specialist.id}`,
            };
          }),
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
          nextAction:
            funded.status === "funded"
              ? { tool: "start_job_work", arguments: { jobId: funded.id }, description: "Ask the specialist to produce and submit the work." }
              : { tool: "retry_job_funding", arguments: { jobId: funded.id }, description: "Inspect lastError and resume escrow funding." },
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
    "buy_specialist_preview",
    {
      description:
        "Pay 0.01 USDC from an owned buyer agent for an available specialist's short pitch. This uses the same x402 payment flow as the web preview form.",
      inputSchema: z.object({
        buyerAgentId: z.string().uuid(),
        specialistId: z.string().uuid().describe("An available specialist id from list_specialists"),
        brief: z.string().trim().min(previewBriefLimits.min).max(previewBriefLimits.max),
      }),
    },
    async ({ buyerAgentId, specialistId, brief }) => {
      try {
        const buyer = await ownedBuyer(identity.ownerId, buyerAgentId);
        const available = await availableSpecialists();
        const specialist = available.find((candidate) => candidate.id === specialistId);
        if (!specialist) throw new AppError("The requested specialist is not currently available", 409);

        const preview = await buyPreview(buyer, specialist, brief, base);
        const amountUsdc = preview.payment.amount
          ? (Number(preview.payment.amount) / 1_000_000).toFixed(6)
          : PREVIEW_PRICE_USDC;
        const [saved] = await db()
          .insert(previews)
          .values({
            ownerId: identity.ownerId,
            buyerAgentId: buyer.id,
            sellerAgentId: specialist.id,
            brief,
            pitch: preview.pitch,
            amountUsdc,
            paymentTx: preview.payment.transaction || null,
            payer: preview.payment.payer ?? null,
          })
          .returning({ id: previews.id });

        return ok({
          preview: {
            id: saved.id,
            pitch: preview.pitch,
            brief,
            amountUsdc,
            buyerAgent: { id: buyer.id, name: buyer.name, walletAddress: buyer.walletAddress },
            specialist: { ...publicSeller(specialist), url: `${base}/sellers/${specialist.id}` },
            payment: {
              ...preview.payment,
              receipt: transactionReceipt(preview.payment.transaction || null),
            },
          },
        });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "get_transaction_history",
    {
      description:
        "Get this user's account-wide twofield transaction history, including every stored onchain receipt for jobs, paid previews, and agent wallet/identity lifecycle actions. Optionally filter to one of the user's buyer agents.",
      inputSchema: z.object({
        agentId: z.string().uuid().optional().describe("Optional buyer agent id owned by this user"),
        limit: z.number().int().min(1).max(200).default(50).describe("Maximum job and preview history items to return"),
      }),
    },
    async ({ agentId, limit }) => {
      try {
        const ownedAgentRows = await db()
          .select()
          .from(agents)
          .where(and(eq(agents.ownerId, identity.ownerId), eq(agents.kind, "buyer")))
          .orderBy(desc(agents.createdAt));
        if (agentId && !ownedAgentRows.some((candidate) => candidate.id === agentId)) {
          throw new AppError("Agent not found", 404);
        }

        const jobWhere = agentId
          ? and(eq(jobs.ownerId, identity.ownerId), eq(jobs.buyerAgentId, agentId))
          : eq(jobs.ownerId, identity.ownerId);
        const previewWhere = agentId
          ? and(eq(previews.ownerId, identity.ownerId), eq(previews.buyerAgentId, agentId))
          : eq(previews.ownerId, identity.ownerId);
        const [jobRows, previewRows] = await Promise.all([
          db().select().from(jobs).where(jobWhere).orderBy(desc(jobs.createdAt)).limit(limit),
          db().select().from(previews).where(previewWhere).orderBy(desc(previews.createdAt)).limit(limit),
        ]);

        const participantIds = [...new Set([...jobRows, ...previewRows].flatMap((row) => [row.buyerAgentId, row.sellerAgentId]))];
        const participantRows = participantIds.length
          ? await db().select().from(agents).where(inArray(agents.id, participantIds))
          : [];
        const byId = new Map([...ownedAgentRows, ...participantRows].map((participant) => [participant.id, participant]));
        const participant = (id: string) => {
          const row = byId.get(id);
          return row
            ? { id: row.id, name: row.name, walletAddress: row.walletAddress }
            : { id, name: "Unknown", walletAddress: null };
        };

        const activity = [
          ...jobRows.map((job) => ({
            kind: "job" as const,
            id: job.id,
            createdAt: job.createdAt.toISOString(),
            updatedAt: job.updatedAt.toISOString(),
            status: job.status,
            amountUsdc: job.priceUsdc,
            buyerAgent: participant(job.buyerAgentId),
            specialist: participant(job.sellerAgentId),
            brief: job.brief,
            hasContext: Boolean(job.context),
            onchainJobId: job.onchainJobId,
            expiresAt: job.expiresAt?.toISOString() ?? null,
            rating: job.rating,
            ratedAt: job.ratedAt?.toISOString() ?? null,
            reviewNote: job.reviewNote,
            hasDeliverable: Boolean(job.deliverable),
            deliverableHash: job.deliverableHash,
            validationRequestHash: job.validationRequestHash,
            lastError: job.lastError,
            transactions: {
              createJob: transactionReceipt(job.createTx),
              setBudget: transactionReceipt(job.budgetTx),
              approveEscrow: transactionReceipt(job.approveTx),
              fundEscrow: transactionReceipt(job.fundTx),
              submitWork: transactionReceipt(job.submitTx),
              settlePayment: transactionReceipt(job.settleTx),
              refundBuyer: transactionReceipt(job.refundTx),
              leaveFeedback: transactionReceipt(job.feedbackTx),
              validationVerdict: transactionReceipt(job.validationTx),
            },
            url: `${base}/jobs/${job.id}`,
          })),
          ...previewRows.map((preview) => ({
            kind: "preview" as const,
            id: preview.id,
            createdAt: preview.createdAt.toISOString(),
            status: "paid" as const,
            amountUsdc: preview.amountUsdc,
            buyerAgent: participant(preview.buyerAgentId),
            specialist: participant(preview.sellerAgentId),
            payerAddress: preview.payer,
            brief: preview.brief,
            pitch: preview.pitch,
            transactions: { payment: transactionReceipt(preview.paymentTx) },
            url: `${base}/sellers/${preview.sellerAgentId}`,
          })),
        ]
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .slice(0, limit);

        const lifecycle = ownedAgentRows
          .filter((owned) => !agentId || owned.id === agentId)
          .map((owned) => ({
            agent: {
              id: owned.id,
              name: owned.name,
              status: owned.status,
              walletAddress: owned.walletAddress,
              onchainAgentId: owned.onchainAgentId,
              archivedAt: owned.archivedAt?.toISOString() ?? null,
            },
            transactions: {
              initialFunding: transactionReceipt(owned.fundingTx),
              identityRegistration: transactionReceipt(owned.registrationTx),
              latestTopUp: transactionReceipt(owned.topUpTx),
              archiveSweep: transactionReceipt(owned.sweepTx),
            },
            url: `${base}/agents/${owned.id}`,
          }))
          .filter((entry) => Object.values(entry.transactions).some(Boolean));

        return ok({
          user: { id: identity.ownerId, username },
          filter: { agentId: agentId ?? null, limit },
          returnedItems: activity.length,
          activity,
          agentLifecycle: lifecycle,
        });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "list_jobs",
    {
      description:
        "List jobs across the authenticated user's buyer agents, newest first. Filter by buyer agent or status. Deliverable text is omitted; use get_job for the full output.",
      inputSchema: z.object({
        buyerAgentId: z.string().uuid().optional(),
        status: z.enum(jobStatuses).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    },
    async ({ buyerAgentId, status, limit }) => {
      try {
        if (buyerAgentId) await ownedBuyer(identity.ownerId, buyerAgentId);
        const rows = await db()
          .select()
          .from(jobs)
          .where(
            and(
              eq(jobs.ownerId, identity.ownerId),
              buyerAgentId ? eq(jobs.buyerAgentId, buyerAgentId) : undefined,
              status ? eq(jobs.status, status) : undefined,
            ),
          )
          .orderBy(desc(jobs.createdAt))
          .limit(limit);
        const ids = [...new Set(rows.flatMap((row) => [row.buyerAgentId, row.sellerAgentId]))];
        const participants = ids.length ? await db().select().from(agents).where(inArray(agents.id, ids)) : [];
        const byId = new Map(participants.map((participant) => [participant.id, participant]));
        const list = rows.map((row) => {
          const { deliverable, files, ...rest } = publicJob(
            row,
            byId.get(row.buyerAgentId),
            byId.get(row.sellerAgentId),
            [],
            username ? { username } : null,
          );
          void deliverable;
          void files;
          return {
            ...rest,
            hasDeliverable: Boolean(row.deliverable),
            nextAction: nextJobAction(row),
            url: `${base}/jobs/${row.id}`,
          };
        });
        return ok({ filters: { buyerAgentId: buyerAgentId ?? null, status: status ?? null, limit }, jobs: list });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "start_job_work",
    {
      description:
        "Start or resume the specialist's work on an owned funded job. This generates the deliverable and submits its hash onchain; it can be safely called again after a work-step failure.",
      inputSchema: z.object({ jobId: z.string().uuid() }),
    },
    async ({ jobId }) => {
      try {
        const result = await ownedJob(identity.ownerId, jobId);
        const updated = await submitWork(result.job);
        return ok({
          job: mcpJob({ ...result, job: updated }, base, username),
          nextAction:
            updated.status === "submitted"
              ? { tool: "review_job", arguments: { jobId }, description: "Review the deliverable and rate it from 1 to 5." }
              : { tool: "start_job_work", arguments: { jobId }, description: "Retry the work step after inspecting lastError." },
        });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "retry_job_funding",
    {
      description: "Resume interrupted escrow creation or funding for an owned job without creating a duplicate job.",
      inputSchema: z.object({ jobId: z.string().uuid() }),
    },
    async ({ jobId }) => {
      try {
        const result = await ownedJob(identity.ownerId, jobId);
        if (result.job.fundTx) throw new AppError("This job's escrow is already funded", 409);
        const updated = await fundJob(result.job);
        return ok({
          job: mcpJob({ ...result, job: updated }, base, username),
          nextAction:
            updated.status === "funded"
              ? { tool: "start_job_work", arguments: { jobId }, description: "Ask the specialist to produce and submit the work." }
              : { tool: "retry_job_funding", arguments: { jobId }, description: "Inspect lastError and retry the resumable escrow flow." },
        });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "review_job",
    {
      description:
        "Rate submitted work for an owned job from 1 to 5. A score of 3 to 5 releases escrow to the specialist; 1 or 2 holds escrow for platform dispute review.",
      inputSchema: z.object({
        jobId: z.string().uuid(),
        score: z.number().int().min(1).max(5),
      }),
    },
    async ({ jobId, score }) => {
      try {
        const result = await ownedJob(identity.ownerId, jobId);
        let updated = result.job;
        if (updated.rating === null) {
          updated = await rateJob(updated, score);
        } else {
          if (updated.rating !== score) throw new AppError(`This job is already rated ${updated.rating} of 5`, 409);
          // rateJob saves the score before settlement. Resume payment if a previous
          // settlement attempt stopped after that save.
          if (updated.status === "submitted" && score >= 3) updated = await approveJob(updated, `rated ${score} of 5`);
        }
        let feedbackError: string | null = null;
        try {
          updated = await recordFeedback(updated, base);
        } catch (err) {
          feedbackError = err instanceof Error ? err.message : "Onchain feedback recording failed";
        }
        return ok({
          job: mcpJob({ ...result, job: updated }, base, username),
          outcome: updated.status === "disputed" ? "Escrow is held for platform review" : "Payment released to the specialist",
          feedbackError,
          nextAction: feedbackError
            ? { tool: "retry_job_feedback", arguments: { jobId }, description: "Retry recording the rating onchain." }
            : null,
        });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "retry_job_feedback",
    {
      description: "Retry recording an owned job's existing buyer rating onchain after settlement or feedback submission failed.",
      inputSchema: z.object({ jobId: z.string().uuid() }),
    },
    async ({ jobId }) => {
      try {
        const result = await ownedJob(identity.ownerId, jobId);
        const updated = await recordFeedback(result.job, base);
        return ok({ job: mcpJob({ ...result, job: updated }, base, username) });
      } catch (err) {
        return failed(err);
      }
    },
  );

  server.registerTool(
    "get_job",
    {
      description:
        "Get any job owned by the authenticated user in full, including progress, brief, context files, deliverable, review state and every transaction receipt.",
      inputSchema: z.object({ id: z.string().uuid() }),
    },
    async ({ id }) => {
      try {
        const result = await ownedJob(identity.ownerId, id);
        return ok({ job: mcpJob(result, base, username), nextAction: nextJobAction(result.job) });
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
