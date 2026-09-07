import { and, eq, gte, ne } from "drizzle-orm";
import { db } from "@/db";
import { agents, jobFiles, jobs, type Agent, type Job, type JobPeriod } from "@/db/schema";
import { fileBytes, type ContextFile } from "@/lib/context";
import { jobRate } from "@/lib/agents";
import { JOB_GAS_RESERVE_USDC, fromWei, publicClient, toUsdc6, toWei } from "@/lib/arc";
import { AppError } from "@/lib/errors";
import { escrowApprove, escrowCreateJob, escrowFund, escrowSetBudget, type WalletRef } from "@/lib/escrow";
import { ensureBuyerPolicy } from "@/lib/policies";
import { evaluatorWallet } from "@/lib/privy";

export class JobError extends AppError {}

export const briefLimits = { min: 40, max: 2000 };
export const activeJobStatuses = ["pending", "created", "budgeted", "funded", "generating", "submitted", "approved"] as const;

const JOB_TTL_SECONDS = 24 * 60 * 60;

async function save(id: string, patch: Partial<Job>) {
  const [row] = await db()
    .update(jobs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(jobs.id, id))
    .returning();
  return row;
}

function walletRef(agent: Agent, label: string): WalletRef {
  if (!agent.walletId || !agent.walletAddress) throw new JobError(`${label} has no wallet`, 409);
  return { id: agent.walletId, address: agent.walletAddress as `0x${string}` };
}

const periodMs: Record<JobPeriod, number> = { hour: 60 * 60 * 1000, day: 24 * 60 * 60 * 1000, week: 7 * 24 * 60 * 60 * 1000 };

// Jobs opened inside the agent's trailing window. Failed jobs do not count.
export async function countJobsInWindow(buyerAgentId: string, period: JobPeriod) {
  const since = new Date(Date.now() - periodMs[period]);
  const rows = await db()
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.buyerAgentId, buyerAgentId), gte(jobs.createdAt, since), ne(jobs.status, "failed")));
  return rows.length;
}

// Validates the hire and inserts the pending row. No chain calls here.
export async function openJob(ownerId: string, buyer: Agent, seller: Agent, brief: string, context = "", files: ContextFile[] = []) {
  if (buyer.ownerId !== ownerId || buyer.kind !== "buyer") throw new JobError("Buyer agent not found", 404);
  if (seller.kind !== "seller" || seller.status !== "registered" || !seller.priceUsdc) {
    throw new JobError("This specialist is not available", 409);
  }
  if (buyer.status === "draft") throw new JobError("Create the buyer agent's wallet first", 409);
  if (buyer.archivedAt) throw new JobError("This agent is archived and cannot hire", 409);
  const text = brief.trim();
  if (text.length < briefLimits.min) throw new JobError(`The brief needs at least ${briefLimits.min} characters`, 400);
  if (text.length > briefLimits.max) throw new JobError(`The brief must be ${briefLimits.max} characters or fewer`, 400);
  if (Number(seller.priceUsdc) > Number(buyer.maxBudgetPerJob)) {
    throw new JobError(`This specialist costs more than the agent's max budget per job of ${buyer.maxBudgetPerJob} USDC`, 400);
  }
  const opened = await countJobsInWindow(buyer.id, buyer.jobsPeriod);
  if (opened >= buyer.maxJobs) throw new JobError(`This agent already opened its ${jobRate(buyer)}`, 400);

  const balance = await publicClient.getBalance({ address: buyer.walletAddress as `0x${string}` });
  const needed = toWei(seller.priceUsdc) + toWei(JOB_GAS_RESERVE_USDC);
  if (balance < needed) {
    throw new JobError("The buyer agent's wallet cannot cover this job", 400, {
      balance: fromWei(balance),
      needed: fromWei(needed),
    });
  }

  const [row] = await db()
    .insert(jobs)
    .values({ ownerId, buyerAgentId: buyer.id, sellerAgentId: seller.id, brief: text, context: context || null, priceUsdc: seller.priceUsdc })
    .returning();
  // The http driver has no transactions. A failed file insert leaves a pending job
  // with no escrow, which the owner sees as a stalled job and can retry.
  if (files.length) {
    await db()
      .insert(jobFiles)
      .values(files.map((f) => ({ jobId: row.id, name: f.name, bytes: fileBytes(f.content), content: f.content })));
  }
  return row;
}

// Runs the escrow steps up to funded. Safe to call again after a failure, it
// resumes from the last saved step.
export async function fundJob(job: Job) {
  if (!["pending", "created", "budgeted", "failed"].includes(job.status)) return job;
  const [buyer] = await db().select().from(agents).where(eq(agents.id, job.buyerAgentId)).limit(1);
  const [seller] = await db().select().from(agents).where(eq(agents.id, job.sellerAgentId)).limit(1);
  const buyerWallet = walletRef(buyer, "Buyer agent");
  const sellerWallet = walletRef(seller, "Specialist");
  const amount6 = toUsdc6(job.priceUsdc);
  let current = job;

  try {
    await ensureBuyerPolicy(buyer);

    if (!current.onchainJobId) {
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + JOB_TTL_SECONDS);
      const { hash, jobId } = await escrowCreateJob(
        buyerWallet,
        sellerWallet.address,
        evaluatorWallet().address,
        expiresAt,
        `twofield job ${job.id}`,
      );
      current = await save(job.id, {
        onchainJobId: jobId.toString(),
        createTx: hash,
        expiresAt: new Date(Number(expiresAt) * 1000),
        status: "created",
        lastError: null,
      });
    }
    const onchainId = BigInt(current.onchainJobId!);

    if (!current.budgetTx) {
      const hash = await escrowSetBudget(sellerWallet, onchainId, amount6);
      current = await save(job.id, { budgetTx: hash, status: "budgeted", lastError: null });
    }
    if (!current.approveTx) {
      const hash = await escrowApprove(buyerWallet, amount6);
      current = await save(job.id, { approveTx: hash, lastError: null });
    }
    if (!current.fundTx) {
      const hash = await escrowFund(buyerWallet, onchainId);
      current = await save(job.id, { fundTx: hash, status: "funded", lastError: null });
    }
    return current;
  } catch (err) {
    const message = err instanceof Error ? err.message.split("\n")[0].slice(0, 300) : "Escrow step failed";
    return save(job.id, { lastError: message });
  }
}

export async function loadJobFiles(jobId: string) {
  return db().select().from(jobFiles).where(eq(jobFiles.jobId, jobId)).orderBy(jobFiles.createdAt);
}
