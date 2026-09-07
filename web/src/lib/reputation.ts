import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { keccak256, parseAbi, toHex, zeroHash, type Hex } from "viem";
import { db } from "@/db";
import { agents, jobs, type Agent, type Job } from "@/db/schema";
import { REPUTATION_REGISTRY, VALIDATION_REGISTRY, publicClient } from "@/lib/arc";
import { AppError } from "@/lib/errors";
import { walletClientFor, type WalletRef } from "@/lib/escrow";
import { evaluatorWallet } from "@/lib/privy";

export class ReputationError extends AppError {}

export const FEEDBACK_TAG1 = "personal-brand";
// Ratings are 1 to 5 under this tag. Earlier 100 and 0 entries sat under niche-pack and
// are left out of summaries on purpose.
export const FEEDBACK_TAG2 = "rating-5";
export const ATTEST_TAG = "human-reviewed";

export const reputationAbi = parseAbi([
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
  "function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
  "function readAllFeedback(uint256 agentId, address[] clientAddresses, string tag1, string tag2, bool includeRevoked) view returns (address[] clients, uint64[] feedbackIndexes, int128[] values, uint8[] valueDecimals, string[] tag1s, string[] tag2s, bool[] revokedStatuses)",
]);

export const validationAbi = parseAbi([
  "function validationRequest(address validatorAddress, uint256 agentId, string requestURI, bytes32 requestHash)",
  "function validationResponse(bytes32 requestHash, uint8 response, string responseURI, bytes32 responseHash, string tag)",
  "function getValidationStatus(bytes32 requestHash) view returns (address validatorAddress, uint256 agentId, uint8 response, bytes32 responseHash, string tag, uint256 lastUpdate)",
]);

async function confirmed(hash: Hex, label: string) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new ReputationError(`${label} transaction reverted`, 502, { tx: hash });
  return receipt;
}

function wallet(agent: Agent, label: string): WalletRef {
  if (!agent.walletId || !agent.walletAddress) throw new ReputationError(`${label} has no wallet`, 409);
  return { id: agent.walletId, address: agent.walletAddress as `0x${string}` };
}

// Reads the feedback left by every buyer that has rated the seller under our tags
// and caches count and average. The registry needs the client addresses spelled out.
export async function refreshReputation(seller: Agent) {
  if (!seller.onchainAgentId) return seller;
  const rated = await db()
    .select({ buyerAgentId: jobs.buyerAgentId })
    .from(jobs)
    .where(and(eq(jobs.sellerAgentId, seller.id), isNotNull(jobs.feedbackTx)));
  const buyerIds = [...new Set(rated.map((r) => r.buyerAgentId))];
  const buyers = buyerIds.length ? await db().select().from(agents).where(inArray(agents.id, buyerIds)) : [];
  const clients = buyers.map((b) => b.walletAddress).filter((a): a is string => Boolean(a)) as `0x${string}`[];
  const [, , values, decimals, , , revoked] = clients.length
    ? await publicClient.readContract({
        address: REPUTATION_REGISTRY,
        abi: reputationAbi,
        functionName: "readAllFeedback",
        args: [BigInt(seller.onchainAgentId), clients, FEEDBACK_TAG1, FEEDBACK_TAG2, false],
      })
    : [[], [], [], [], [], [], []];
  const live = values.map((v, i) => Number(v) / 10 ** Number(decimals[i])).filter((_, i) => !revoked[i]);
  const count = live.length;
  const score = count ? live.reduce((a, b) => a + b, 0) / count : null;
  const [row] = await db()
    .update(agents)
    .set({ reputationCount: count, reputationScore: score === null ? null : score.toFixed(2) })
    .where(eq(agents.id, seller.id))
    .returning();
  return row;
}

// The buyer wallet writes the buyer's 1 to 5 rating for the seller. Idempotent per job.
export async function recordFeedback(job: Job, base: string) {
  if (job.feedbackTx) return job;
  if (job.rating === null) throw new ReputationError("Rate the work first", 409);
  const [buyer] = await db().select().from(agents).where(eq(agents.id, job.buyerAgentId)).limit(1);
  const [seller] = await db().select().from(agents).where(eq(agents.id, job.sellerAgentId)).limit(1);
  if (!seller.onchainAgentId) throw new ReputationError("Specialist has no onchain identity", 409);

  const value = BigInt(job.rating);
  const hash = await walletClientFor(wallet(buyer, "Buyer agent")).writeContract({
    address: REPUTATION_REGISTRY,
    abi: reputationAbi,
    functionName: "giveFeedback",
    args: [
      BigInt(seller.onchainAgentId),
      value,
      0,
      FEEDBACK_TAG1,
      FEEDBACK_TAG2,
      "",
      `${base}/jobs/${job.id}`,
      (job.deliverableHash as Hex | null) ?? keccak256(toHex(job.id)),
    ],
  });
  await confirmed(hash, "giveFeedback");
  const [row] = await db().update(jobs).set({ feedbackTx: hash, updatedAt: new Date() }).where(eq(jobs.id, job.id)).returning();
  await refreshReputation(seller);
  return row;
}

// Human attestation. The seller asks the platform evaluator to validate it, and the
// evaluator answers 100 because a person reviewed the seller. Two transactions.
export async function attestSeller(seller: Agent) {
  if (seller.kind !== "seller" || !seller.onchainAgentId) throw new ReputationError("Only registered specialists can be attested", 409);
  if (seller.attestationTx) return seller;
  const evaluator = evaluatorWallet();
  const requestHash = (seller.validationRequestHash as Hex | null) ?? keccak256(toHex(`twofield attest ${seller.id}`));
  let current = seller;

  if (!current.validationRequestHash) {
    const hash = await walletClientFor(wallet(seller, "Specialist")).writeContract({
      address: VALIDATION_REGISTRY,
      abi: validationAbi,
      functionName: "validationRequest",
      args: [evaluator.address, BigInt(seller.onchainAgentId), seller.metadataUri ?? "", requestHash],
    });
    await confirmed(hash, "validationRequest");
    [current] = await db().update(agents).set({ validationRequestHash: requestHash }).where(eq(agents.id, seller.id)).returning();
  }

  const hash = await walletClientFor(evaluator).writeContract({
    address: VALIDATION_REGISTRY,
    abi: validationAbi,
    functionName: "validationResponse",
    args: [requestHash, 100, "", zeroHash, ATTEST_TAG],
  });
  await confirmed(hash, "validationResponse");
  [current] = await db().update(agents).set({ attestedAt: new Date(), attestationTx: hash }).where(eq(agents.id, seller.id)).returning();
  return current;
}
