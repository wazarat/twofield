import type { Agent } from "@/db/schema";

export const agentLimits = {
  nameMax: 60,
  descriptionMax: 280,
  budgetMin: 0.01,
  budgetMax: 20,
  jobsMin: 1,
  jobsMax: 10,
};

export type AgentInput = {
  name: string;
  description: string;
  maxBudgetPerJob: number;
  maxJobs: number;
  maxTotalBudget: number;
};

function round6(n: number) {
  return Math.round(n * 1_000_000) / 1_000_000;
}

export function validateAgentInput(body: unknown): { ok: true; value: AgentInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const description = typeof b.description === "string" ? b.description.trim() : "";
  const perJob = Number(b.maxBudgetPerJob);
  const jobs = Number(b.maxJobs);
  const total = Number(b.maxTotalBudget);
  const { budgetMin, budgetMax, jobsMin, jobsMax } = agentLimits;

  if (!name) return { ok: false, error: "Name is required" };
  if (name.length > agentLimits.nameMax) return { ok: false, error: `Name must be ${agentLimits.nameMax} characters or fewer` };
  if (description.length > agentLimits.descriptionMax) {
    return { ok: false, error: `Description must be ${agentLimits.descriptionMax} characters or fewer` };
  }
  if (!Number.isFinite(perJob) || perJob < budgetMin || perJob > budgetMax) {
    return { ok: false, error: `Max budget per job must be between ${budgetMin} and ${budgetMax} USDC` };
  }
  if (!Number.isInteger(jobs) || jobs < jobsMin || jobs > jobsMax) {
    return { ok: false, error: `Max number of jobs must be a whole number between ${jobsMin} and ${jobsMax}` };
  }
  if (!Number.isFinite(total) || total < budgetMin || total > budgetMax) {
    return { ok: false, error: `Max total budget must be between ${budgetMin} and ${budgetMax} USDC` };
  }
  if (total < perJob) return { ok: false, error: "Max total budget must be at least the max budget per job" };

  return {
    ok: true,
    value: { name, description, maxBudgetPerJob: round6(perJob), maxJobs: jobs, maxTotalBudget: round6(total) },
  };
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

export function budgetSummary(agent: Pick<Agent, "maxBudgetPerJob" | "maxJobs" | "maxTotalBudget">) {
  const jobs = agent.maxJobs === 1 ? "1 job" : `${agent.maxJobs} jobs`;
  return `Up to ${formatUsdc(agent.maxBudgetPerJob)} per job, ${jobs}, ${formatUsdc(agent.maxTotalBudget)} total`;
}
