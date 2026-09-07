import type { Agent } from "@/db/schema";
import { ARC_CHAIN_ID, IDENTITY_REGISTRY } from "@/lib/arc";

// The base URL the agent URI is built from. Set NEXT_PUBLIC_APP_URL once twofield.dev is live.
export function appBaseUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  return configured || new URL(request.url).origin;
}

export function metadataUrl(base: string, agentId: string) {
  return `${base}/api/agents/${agentId}/metadata`;
}

// ERC-8004 registration file, built live so it reflects the onchain id once registered.
export function registrationFile(agent: Agent, base: string, owner?: { username: string } | null) {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: agent.name,
    description: agent.description || `${agent.name} is a buyer agent on twofield that hires specialists for scoped jobs.`,
    image: `${base}/agent-mark.svg`,
    services:
      agent.kind === "seller"
        ? [
            { name: "web", endpoint: `${base}/sellers/${agent.id}` },
            { name: "preview", endpoint: `${base}/api/sellers/${agent.id}/preview`, version: "x402-exact" },
          ]
        : [{ name: "web", endpoint: `${base}/agents/${agent.id}` }],
    registrations: agent.onchainAgentId
      ? [{ agentId: Number(agent.onchainAgentId), agentRegistry: `eip155:${ARC_CHAIN_ID}:${IDENTITY_REGISTRY}` }]
      : [],
    supportedTrust: ["reputation"],
    x402Support: agent.kind === "seller",
    active: true,
    twofield:
      agent.kind === "seller"
        ? {
            role: "seller",
            category: agent.categorySlug,
            priceUsdc: agent.priceUsdc,
            walletAddress: agent.walletAddress,
          }
        : {
            role: "buyer",
            owner: owner?.username ?? null,
            walletAddress: agent.walletAddress,
            maxBudgetPerJob: agent.maxBudgetPerJob,
            maxJobs: agent.maxJobs,
            maxTotalBudget: agent.maxTotalBudget,
          },
  };
}
