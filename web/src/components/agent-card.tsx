import Link from "next/link";
import type { Agent } from "@/db/schema";
import { budgetSummary } from "@/lib/agents";
import { StatusPill } from "@/components/status-pill";

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="flex flex-col gap-3 rounded-card border border-line bg-card p-6 transition hover:border-line-strong hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)]"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-display text-xl font-medium tracking-[-0.02em]">{agent.name}</h3>
        <StatusPill status={agent.status} />
      </div>
      {agent.description ? <p className="text-sm leading-relaxed text-ink-muted">{agent.description}</p> : null}
      <p className="font-mono text-xs text-ink-muted">{budgetSummary(agent)}</p>
    </Link>
  );
}
