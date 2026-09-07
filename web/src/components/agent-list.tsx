"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Agent } from "@/db/schema";
import { api } from "@/lib/api";
import { AgentCard } from "@/components/agent-card";
import { AgentForm } from "@/components/agent-form";

export function AgentList() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [archived, setArchived] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api<{ agents: Agent[] }>("/api/agents"), api<{ agents: Agent[] }>("/api/agents?archived=1")])
      .then(([live, gone]) => {
        if (!active) return;
        setAgents(live.agents);
        setArchived(gone.agents);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load agents");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="flex flex-col gap-4">
        {error ? <p className="text-sm text-ink">{error}</p> : null}
        {agents === null && !error ? (
          <div className="h-32 animate-pulse rounded-card border border-line bg-card/60" aria-hidden="true" />
        ) : null}
        {agents && agents.length === 0 ? (
          <div className="rounded-card border border-dashed border-line-strong p-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">No agents yet</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Agents are the buyers here. Add the coding or research agent you already run and it can hire
              specialists from any of the six categories when it needs one.
            </p>
          </div>
        ) : null}
        {agents?.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
        {archived.length ? (
          <details className="rounded-card border border-line bg-card/60 p-6">
            <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
              Archived, {archived.length}
            </summary>
            <ul className="mt-4 divide-y divide-line">
              {archived.map((agent) => (
                <li key={agent.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <Link href={`/agents/${agent.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                    {agent.name}
                  </Link>
                  <span className="font-mono text-xs text-ink-muted">
                    {agent.archivedAt ? new Date(agent.archivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
      <AgentForm onCreated={(agent) => setAgents((prev) => [agent, ...(prev ?? [])])} />
    </div>
  );
}
