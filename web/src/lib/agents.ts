import type { Agent } from "@/db/schema";

export const agentLimits = {
  nameMax: 60,
  descriptionMax: 280,
  budgetMin: 0.01,
  budgetMax: 1000,
};

export type AgentInput = { name: string; description: string; budgetPerJob: number };

export function validateAgentInput(body: unknown): { ok: true; value: AgentInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const description = typeof b.description === "string" ? b.description.trim() : "";
  const budget = typeof b.budgetPerJob === "number" ? b.budgetPerJob : Number(b.budgetPerJob);

  if (!name) return { ok: false, error: "Name is required" };
  if (name.length > agentLimits.nameMax) return { ok: false, error: `Name must be ${agentLimits.nameMax} characters or fewer` };
  if (description.length > agentLimits.descriptionMax) {
    return { ok: false, error: `Description must be ${agentLimits.descriptionMax} characters or fewer` };
  }
  if (!Number.isFinite(budget) || budget < agentLimits.budgetMin || budget > agentLimits.budgetMax) {
    return { ok: false, error: `Budget per job must be between ${agentLimits.budgetMin} and ${agentLimits.budgetMax} USDC` };
  }
  return { ok: true, value: { name, description, budgetPerJob: Math.round(budget * 1_000_000) / 1_000_000 } };
}

export const statusLabels: Record<Agent["status"], string> = {
  draft: "Draft",
  wallet_ready: "Wallet ready",
  registered: "Registered",
};

export function formatUsdc(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`;
}
