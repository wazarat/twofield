import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agents, jobs, type Agent } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { sweepToMaster } from "@/lib/wallets";

export class ArchiveError extends AppError {}

// Jobs that still hold or expect escrow. An agent with one of these cannot be archived.
const openJobStatuses = ["pending", "created", "budgeted", "funded", "generating", "submitted"] as const;

// Hides the agent and returns its unspent balance to the master wallet. Safe to call
// again, an archived agent whose sweep failed retries the sweep only.
export async function archiveAgent(agent: Agent) {
  if (agent.kind !== "buyer") throw new ArchiveError("Only buyer agents can be archived", 409);
  const open = await db()
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.buyerAgentId, agent.id), inArray(jobs.status, [...openJobStatuses])))
    .limit(1);
  if (open.length && !agent.archivedAt) throw new ArchiveError("This agent has an open job. Settle it first", 409);

  let current = agent;
  if (!current.archivedAt) {
    [current] = await db().update(agents).set({ archivedAt: new Date() }).where(eq(agents.id, agent.id)).returning();
  }
  if (current.walletId && !current.sweepTx) {
    await sweepToMaster(current);
    [current] = await db().select().from(agents).where(eq(agents.id, agent.id)).limit(1);
  }
  return current;
}
