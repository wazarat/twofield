"use client";

import { useState } from "react";
import type { Agent } from "@/db/schema";
import { api } from "@/lib/api";
import { IDENTITY_REGISTRY, explorerAddress, explorerTx } from "@/lib/arc";

export function IdentityPanel({ agent, onUpdated }: { agent: Agent; onUpdated: (agent: Agent) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registered = agent.status === "registered" && Boolean(agent.onchainAgentId);
  const canRegister = agent.status === "wallet_ready";

  async function register() {
    setBusy(true);
    setError(null);
    try {
      const { agent: updated } = await api<{ agent: Agent }>(`/api/agents/${agent.id}/register`, { method: "POST" });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <span className={`font-mono text-sm ${registered ? "text-ink" : "text-ink-faint"}`}>03</span>
          <span className="font-display text-lg font-medium tracking-[-0.02em]">Identity</span>
        </div>
        {registered ? (
          <a
            href={`${explorerAddress(IDENTITY_REGISTRY)}?tab=read_contract`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-ink underline-offset-4 hover:underline"
          >
            ERC-8004 id {agent.onchainAgentId}
          </a>
        ) : canRegister ? (
          <button
            type="button"
            onClick={register}
            disabled={busy}
            className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-ink/85 disabled:opacity-50"
          >
            {busy ? "Registering" : "Register identity"}
          </button>
        ) : (
          <span className="font-mono text-xs text-ink-faint">Needs a wallet first</span>
        )}
      </div>

      {registered ? (
        <div className="ml-10 flex flex-wrap gap-x-8 gap-y-2 font-mono text-xs text-ink-muted">
          {agent.registrationTx ? (
            <a href={explorerTx(agent.registrationTx)} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
              Registration transaction
            </a>
          ) : null}
          {agent.metadataUri ? (
            <a href={agent.metadataUri} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
              Agent URI
            </a>
          ) : null}
        </div>
      ) : canRegister ? (
        <p className="ml-10 text-sm text-ink-muted">
          Mints the agent&apos;s ERC-8004 identity on Arc from its own wallet. Costs a fraction of a cent in gas.
        </p>
      ) : null}

      {error ? <p className="ml-10 rounded-card border border-line-strong p-4 text-sm">{error}</p> : null}
    </div>
  );
}
