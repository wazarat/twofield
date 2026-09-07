import { eq } from "drizzle-orm";
import { keccak256, parseEventLogs, toHex, type Hex } from "viem";
import { db } from "@/db";
import { agents, jobs, type Job } from "@/db/schema";
import { AGENTIC_COMMERCE, publicClient } from "@/lib/arc";
import { AppError } from "@/lib/errors";
import { escrowAbi, walletClientFor, type WalletRef } from "@/lib/escrow";
import { evaluatorWallet } from "@/lib/privy";
import { loadJobFiles } from "@/lib/jobs";
import { generateDeliverable } from "@/lib/work";

export class SettlementError extends AppError {}

async function save(id: string, patch: Partial<Job>) {
  const [row] = await db()
    .update(jobs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(jobs.id, id))
    .returning();
  return row;
}

async function confirmed(hash: Hex, label: string) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new SettlementError(`${label} transaction reverted`, 502, { tx: hash });
  return receipt;
}

function sellerWallet(sellerAgentId: string) {
  return db()
    .select()
    .from(agents)
    .where(eq(agents.id, sellerAgentId))
    .limit(1)
    .then(([seller]) => {
      if (!seller?.walletId || !seller.walletAddress) throw new SettlementError("Specialist has no wallet", 409);
      return { seller, wallet: { id: seller.walletId, address: seller.walletAddress as `0x${string}` } as WalletRef };
    });
}

// Generates the deliverable if needed, then the seller wallet submits its hash.
// Resumes from whatever is already saved.
export async function submitWork(job: Job) {
  if (!["funded", "generating"].includes(job.status)) {
    throw new SettlementError(`Work can only start on a funded job, this one is ${job.status}`, 409);
  }
  const { seller, wallet } = await sellerWallet(job.sellerAgentId);
  const [buyer] = await db().select().from(agents).where(eq(agents.id, job.buyerAgentId)).limit(1);
  let current = job;

  try {
    if (!current.deliverable) {
      current = await save(job.id, { status: "generating", lastError: null });
      const files = await loadJobFiles(job.id);
      const text = await generateDeliverable(current, seller, buyer, files);
      current = await save(job.id, { deliverable: text, deliverableHash: keccak256(toHex(text)) });
    }
    const hash = await walletClientFor(wallet).writeContract({
      address: AGENTIC_COMMERCE,
      abi: escrowAbi,
      functionName: "submit",
      args: [BigInt(current.onchainJobId!), current.deliverableHash as Hex, "0x"],
    });
    await confirmed(hash, "submit");
    return save(job.id, { submitTx: hash, status: "submitted", lastError: null });
  } catch (err) {
    const message = err instanceof Error ? err.message.split("\n")[0].slice(0, 300) : "Work step failed";
    return save(job.id, { status: current.deliverable ? "generating" : "funded", lastError: message });
  }
}

export const ratingRange = { min: 1, max: 5, payFrom: 3 };

// The buyer's verdict. Three and up pays the specialist now. One or two holds escrow and
// hands the job to the platform review queue.
export async function rateJob(job: Job, score: number) {
  if (job.status !== "submitted") throw new SettlementError(`Only submitted work can be rated, this job is ${job.status}`, 409);
  if (job.rating !== null) throw new SettlementError("This job is already rated", 409);
  if (!Number.isInteger(score) || score < ratingRange.min || score > ratingRange.max) {
    throw new SettlementError(`The rating must be a whole number from ${ratingRange.min} to ${ratingRange.max}`, 400);
  }
  const rated = await save(job.id, { rating: score, ratedAt: new Date() });
  if (score >= ratingRange.payFrom) return approveJob(rated, `rated ${score} of 5`);
  return save(job.id, { status: "disputed", lastError: null });
}

// The evaluator wallet completes the job, releasing escrow to the seller.
export async function approveJob(job: Job, note: string) {
  if (job.status !== "submitted" && job.status !== "disputed") {
    throw new SettlementError(`Only submitted or disputed jobs can be approved, this one is ${job.status}`, 409);
  }
  const hash = await walletClientFor(evaluatorWallet()).writeContract({
    address: AGENTIC_COMMERCE,
    abi: escrowAbi,
    functionName: "complete",
    args: [BigInt(job.onchainJobId!), keccak256(toHex(note || "approved")), "0x"],
  });
  const receipt = await confirmed(hash, "complete");
  const [released] = parseEventLogs({ abi: escrowAbi, eventName: "PaymentReleased", logs: receipt.logs });
  if (!released) throw new SettlementError("complete confirmed but no PaymentReleased event was found", 502, { tx: hash });
  return save(job.id, { settleTx: hash, status: "approved", reviewNote: note || null, lastError: null });
}

// The evaluator wallet rejects the job. The contract refunds the buyer in the same call.
export async function rejectJob(job: Job, note: string) {
  if (!["submitted", "disputed", "funded", "generating"].includes(job.status)) {
    throw new SettlementError(`This job cannot be rejected, it is ${job.status}`, 409);
  }
  const hash = await walletClientFor(evaluatorWallet()).writeContract({
    address: AGENTIC_COMMERCE,
    abi: escrowAbi,
    functionName: "reject",
    args: [BigInt(job.onchainJobId!), keccak256(toHex(note || "rejected")), "0x"],
  });
  const receipt = await confirmed(hash, "reject");
  const [refunded] = parseEventLogs({ abi: escrowAbi, eventName: "Refunded", logs: receipt.logs });
  if (!refunded) throw new SettlementError("reject confirmed but no Refunded event was found", 502, { tx: hash });
  return save(job.id, { refundTx: hash, status: "refunded", reviewNote: note || null, lastError: null });
}
