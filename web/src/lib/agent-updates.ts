import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, type Agent } from "@/db/schema";
import { validateAgentInput } from "@/lib/agents";
import { AppError } from "@/lib/errors";
import { syncBuyerPolicy } from "@/lib/policies";
import { topUp } from "@/lib/wallets";

export class UpdateError extends AppError {}

export type UpdateOutcome = { agent: Agent; topUpUsdc: string | null; policyRewritten: boolean };

// Applies a partial edit. The per job cap lives in the wallet policy, so a change there
// rewrites the policy. A higher total moves the difference from the master wallet. A
// lower total only changes the cap.
export async function updateAgent(agent: Agent, body: unknown): Promise<UpdateOutcome> {
  if (agent.kind !== "buyer") throw new UpdateError("Only buyer agents can be edited", 409);
  if (agent.archivedAt) throw new UpdateError("This agent is archived", 409);
  const patch = (body ?? {}) as Record<string, unknown>;
  const parsed = validateAgentInput({
    name: patch.name ?? agent.name,
    description: patch.description ?? agent.description,
    maxBudgetPerJob: patch.maxBudgetPerJob ?? agent.maxBudgetPerJob,
    maxJobs: patch.maxJobs ?? agent.maxJobs,
    jobsPeriod: patch.jobsPeriod ?? agent.jobsPeriod,
    maxTotalBudget: patch.maxTotalBudget ?? agent.maxTotalBudget,
  });
  if (!parsed.ok) throw new UpdateError(parsed.error, 400);
  const next = parsed.value;

  const capChanged = next.maxBudgetPerJob !== Number(agent.maxBudgetPerJob);
  const raise = next.maxTotalBudget - Number(agent.maxTotalBudget);

  let [current] = await db()
    .update(agents)
    .set({
      name: next.name,
      description: next.description,
      maxBudgetPerJob: next.maxBudgetPerJob.toString(),
      maxJobs: next.maxJobs,
      jobsPeriod: next.jobsPeriod,
      maxTotalBudget: next.maxTotalBudget.toString(),
    })
    .where(eq(agents.id, agent.id))
    .returning();

  let policyRewritten = false;
  if (capChanged && current.policyId) {
    current = await syncBuyerPolicy(current, { force: true });
    policyRewritten = true;
  }

  let topUpUsdc: string | null = null;
  if (raise > 0 && current.walletAddress && current.status !== "draft") {
    topUpUsdc = raise.toFixed(6);
    current = await topUp(current, topUpUsdc);
  }
  return { agent: current, topUpUsdc, policyRewritten };
}
