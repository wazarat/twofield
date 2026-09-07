import type { Agent, Job } from "@/db/schema";

export function publicJob(job: Job, buyer?: Agent, seller?: Agent) {
  return {
    ...job,
    buyer: buyer ? { id: buyer.id, name: buyer.name, walletAddress: buyer.walletAddress } : undefined,
    seller: seller
      ? { id: seller.id, name: seller.name, tagline: seller.tagline, walletAddress: seller.walletAddress, onchainAgentId: seller.onchainAgentId }
      : undefined,
  };
}

export type PublicJob = ReturnType<typeof publicJob>;
