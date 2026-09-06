"use client";

import { useEffect, useState } from "react";
import type { Agent } from "@/db/schema";
import { api } from "@/lib/api";
import { AgentCard } from "@/components/agent-card";
import { AgentForm } from "@/components/agent-form";

export function AgentList() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<{ agents: Agent[] }>("/api/agents")
      .then((data) => {
        if (active) setAgents(data.agents);
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
      </div>
      <AgentForm onCreated={(agent) => setAgents((prev) => [agent, ...(prev ?? [])])} />
    </div>
  );
}
