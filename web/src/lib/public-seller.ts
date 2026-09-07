import type { Agent } from "@/db/schema";

// The subset of a seller row that is safe to show to anyone.
export function publicSeller(agent: Agent) {
  return {
    id: agent.id,
    name: agent.name,
    tagline: agent.tagline ?? "",
    description: agent.description,
    categorySlug: agent.categorySlug,
    priceUsdc: agent.priceUsdc ?? "0",
    status: agent.status,
    walletAddress: agent.walletAddress,
    onchainAgentId: agent.onchainAgentId,
    registrationTx: agent.registrationTx,
    metadataUri: agent.metadataUri,
    attestedAt: agent.attestedAt,
    attestationTx: agent.attestationTx,
    reputationCount: agent.reputationCount,
    reputationScore: agent.reputationScore,
  };
}

export type PublicSeller = ReturnType<typeof publicSeller>;
