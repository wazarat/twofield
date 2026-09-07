import type { Agent, Job, JobFile } from "@/db/schema";

export function publicJob(job: Job, buyer?: Agent, seller?: Agent, files: JobFile[] = [], owner?: { username: string } | null) {
  return {
    ...job,
    files: files.map((f) => ({ id: f.id, name: f.name, bytes: f.bytes, content: f.content })),
    buyer: buyer ? { id: buyer.id, name: buyer.name, walletAddress: buyer.walletAddress, ownerUsername: owner?.username ?? null } : undefined,
    seller: seller
      ? { id: seller.id, name: seller.name, tagline: seller.tagline, walletAddress: seller.walletAddress, onchainAgentId: seller.onchainAgentId }
      : undefined,
  };
}

export type PublicJob = ReturnType<typeof publicJob>;

// "Fintech Research (waz)" when the owner has a username, the agent name otherwise.
export function buyerLabel(buyer: { name: string; ownerUsername?: string | null } | undefined, fallback = "your agent") {
  if (!buyer) return fallback;
  return buyer.ownerUsername ? `${buyer.name} (${buyer.ownerUsername})` : buyer.name;
}
