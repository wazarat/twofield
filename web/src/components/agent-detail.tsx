"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Agent } from "@/db/schema";
import { formatUsdc, jobRate } from "@/lib/agents";
import { ApiError, api } from "@/lib/api";
import { explorerTx } from "@/lib/arc";
import { StatusPill } from "@/components/status-pill";
import { WalletPanel } from "@/components/wallet-panel";
import { IdentityPanel } from "@/components/identity-panel";
import { AgentJobs } from "@/components/agent-jobs";
import { useCurrentUser } from "@/components/user-context";
import { EditAgentForm } from "@/components/edit-agent-form";

export function AgentDetail({ id }: { id: string }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user: me } = useCurrentUser();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  async function archive() {
    if (!agent) return;
    setArchiving(true);
    setArchiveError(null);
    try {
      const data = await api<{ agent: Agent }>(`/api/agents/${agent.id}/archive`, { method: "POST" });
      setAgent(data.agent);
      setConfirming(false);
    } catch (err) {
      setArchiveError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setArchiving(false);
    }
  }

  useEffect(() => {
    let active = true;
    api<{ agent: Agent }>(`/api/agents/${id}`)
      .then((data) => {
        if (active) setAgent(data.agent);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load agent");
      });
    return () => {
      active = false;
    };
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

  const budgets = [
    { label: "Max per job", value: formatUsdc(agent.maxBudgetPerJob) },
    { label: "Max jobs", value: jobRate(agent) },
    { label: "Max total", value: formatUsdc(agent.maxTotalBudget) },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-display text-4xl font-medium tracking-[-0.03em] md:text-5xl">{agent.name}</h1>
        <StatusPill status={agent.status} />
      </div>
      {agent.description ? <p className="mt-4 max-w-2xl text-lg text-ink-muted">{agent.description}</p> : null}
      {me && me.id === agent.ownerId ? <p className="mt-3 font-mono text-xs text-ink-muted">Run by {me.username}</p> : null}
      {agent.archivedAt ? (
        <div className="mt-8 rounded-card border border-line-strong bg-card p-6 text-sm">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Archived</p>
          <p className="mt-3 leading-relaxed text-ink-muted">
            Archived on {new Date(agent.archivedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}. It no longer hires or buys previews. Its receipts stay.{" "}
            {agent.sweepTx ? (
              <>
                Unspent balance returned to the platform wallet,{" "}
                <a href={explorerTx(agent.sweepTx)} target="_blank" rel="noreferrer" className="text-ink underline-offset-4 hover:underline">
                  transaction
                </a>
                .
              </>
            ) : agent.walletAddress ? (
              <>
                The balance was too small to return.{" "}
                <button type="button" onClick={archive} disabled={archiving} className="text-ink underline-offset-4 hover:underline disabled:opacity-50">
                  {archiving ? "Trying again" : "Try again"}
                </button>
              </>
            ) : null}
          </p>
          {archiveError ? <p className="mt-3 text-ink">{archiveError}</p> : null}
        </div>
      ) : null}

      <div className="mt-12 grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
        <div className="rounded-panel border border-line bg-card p-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Setup</p>
          <ol className="mt-6 divide-y divide-line">
            <li className="flex items-center justify-between gap-6 py-4">
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm text-ink">01</span>
                <span className="font-display text-lg font-medium tracking-[-0.02em]">Created</span>
              </div>
              <span className="font-mono text-xs text-ink">{created}</span>
            </li>
            <li className="py-4">
              <WalletPanel agent={agent} onUpdated={setAgent} />
            </li>
            <li className="py-4">
              <IdentityPanel agent={agent} onUpdated={setAgent} />
            </li>
          </ol>
        </div>
        {agent.status !== "draft" ? <AgentJobs agentId={agent.id} /> : null}
        </div>
        <div className="rounded-panel border border-line bg-card p-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Budgets</p>
          <dl className="mt-4 divide-y divide-line">
            {budgets.map((b) => (
              <div key={b.label} className="flex items-baseline justify-between py-3">
                <dt className="text-sm text-ink-muted">{b.label}</dt>
                <dd className="font-display text-xl font-medium tracking-[-0.02em]">{b.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            The per job cap is enforced by the wallet policy. The total is what the wallet is funded with.
          </p>
          {!agent.archivedAt ? (
            editing ? (
              <EditAgentForm agent={agent} onUpdated={setAgent} onClose={() => setEditing(false)} />
            ) : (
              <button type="button" onClick={() => setEditing(true)} className="mt-4 rounded-full border border-ink px-5 py-2 text-sm font-medium transition hover:bg-ink hover:text-white">
                Edit budgets
              </button>
            )
          ) : null}
          {!agent.archivedAt ? (
            <div className="mt-8 border-t border-line pt-6">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Archive</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Hides this agent and returns its unspent USDC to the platform wallet. Its receipts stay.
              </p>
              {confirming ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" onClick={archive} disabled={archiving} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-ink/85 disabled:opacity-50">
                    {archiving ? "Archiving, about twenty seconds" : "Confirm archive"}
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} disabled={archiving} className="rounded-full border border-ink px-5 py-2 text-sm font-medium transition hover:bg-ink hover:text-white disabled:opacity-50">
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirming(true)} className="mt-4 rounded-full border border-ink px-5 py-2 text-sm font-medium transition hover:bg-ink hover:text-white">
                  Archive agent
                </button>
              )}
              {archiveError ? <p className="mt-3 text-sm text-ink">{archiveError}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
