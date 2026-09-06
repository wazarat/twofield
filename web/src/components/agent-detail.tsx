"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Agent } from "@/db/schema";
import { formatUsdc } from "@/lib/agents";
import { api } from "@/lib/api";
import { StatusPill } from "@/components/status-pill";

export function AgentDetail({ id }: { id: string }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ agent: Agent }>(`/api/agents/${id}`)
      .then((data) => setAgent(data.agent))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load agent"));
  }, [id]);

  if (error) {
    return (
      <div className="rounded-panel border border-line bg-card p-8">
        <p className="text-sm text-ink">{error}</p>
        <Link href="/agents" className="mt-4 inline-block text-sm font-medium underline">
          Back to agents
        </Link>
      </div>
    );
  }

  if (!agent) {
    return <div className="h-64 animate-pulse rounded-panel border border-line bg-card/60" aria-hidden="true" />;
  }

  const created = new Date(agent.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const steps = [
    { label: "Created", value: created, done: true },
    { label: "Wallet", value: agent.walletAddress ?? "Next milestone", done: Boolean(agent.walletAddress) },
    { label: "Identity", value: agent.onchainAgentId ? `ERC-8004 id ${agent.onchainAgentId}` : "Next milestone", done: Boolean(agent.onchainAgentId) },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-display text-4xl font-medium tracking-[-0.03em] md:text-5xl">{agent.name}</h1>
        <StatusPill status={agent.status} />
      </div>
      {agent.description ? <p className="mt-4 max-w-2xl text-lg text-ink-muted">{agent.description}</p> : null}

      <div className="mt-12 grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="rounded-panel border border-line bg-card p-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Setup</p>
          <ol className="mt-6 divide-y divide-line">
            {steps.map((step, i) => (
              <li key={step.label} className="flex items-center justify-between gap-6 py-4">
                <div className="flex items-center gap-4">
                  <span className={`font-mono text-sm ${step.done ? "text-ink" : "text-ink-faint"}`}>0{i + 1}</span>
                  <span className="font-display text-lg font-medium tracking-[-0.02em]">{step.label}</span>
                </div>
                <span className={`truncate font-mono text-xs ${step.done ? "text-ink" : "text-ink-faint"}`}>{step.value}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-panel border border-line bg-card p-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Budget per job</p>
          <p className="mt-4 font-display text-3xl font-medium tracking-[-0.03em]">{formatUsdc(agent.budgetPerJob)}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            The most this agent may commit to a single specialist job. Enforced by its wallet policy once the wallet exists.
          </p>
        </div>
      </div>
    </>
  );
}
