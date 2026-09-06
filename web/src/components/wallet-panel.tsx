"use client";

import { useEffect, useState } from "react";
import type { Agent } from "@/db/schema";
import { formatUsdc } from "@/lib/agents";
import { api } from "@/lib/api";
import { GAS_BUFFER_USDC, explorerAddress, explorerTx } from "@/lib/arc";

type WalletFailure = { error: string; details?: Record<string, string> };

function shorten(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletPanel({ agent, onUpdated }: { agent: Agent; onUpdated: (agent: Agent) => void }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<WalletFailure | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  const hasWallet = Boolean(agent.walletAddress) && agent.status !== "draft";

  useEffect(() => {
    if (!hasWallet) return;
    let active = true;
    api<{ balance: string }>(`/api/agents/${agent.id}/balance`)
      .then((data) => {
        if (active) setBalance(data.balance);
      })
      .catch(() => {
        if (active) setBalance(null);
      });
    return () => {
      active = false;
    };
  }, [agent.id, hasWallet]);

  async function create() {
    setBusy(true);
    setFailure(null);
    try {
      const res = await fetch(`/api/agents/${agent.id}/wallet`, {
        method: "POST",
        headers: { authorization: `Bearer ${await (await import("@privy-io/react-auth")).getAccessToken()}` },
      });
      const data = (await res.json()) as { agent?: Agent } & WalletFailure;
      if (!res.ok || !data.agent) {
        setFailure({ error: data.error ?? `Request failed with ${res.status}`, details: data.details });
        return;
      }
      onUpdated(data.agent);
    } catch (err) {
      setFailure({ error: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setBusy(false);
    }
  }

  const total = Number(agent.maxTotalBudget);
  const moves = `${formatUsdc(total)} plus ${GAS_BUFFER_USDC} USDC for gas`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <span className={`font-mono text-sm ${hasWallet ? "text-ink" : "text-ink-faint"}`}>02</span>
          <span className="font-display text-lg font-medium tracking-[-0.02em]">Wallet</span>
        </div>
        {hasWallet && agent.walletAddress ? (
          <a
            href={explorerAddress(agent.walletAddress)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-ink underline-offset-4 hover:underline"
          >
            {shorten(agent.walletAddress)}
          </a>
        ) : (
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-ink/85 disabled:opacity-50"
          >
            {busy ? "Creating" : "Create wallet"}
          </button>
        )}
      </div>

      {hasWallet ? (
        <div className="ml-10 flex flex-wrap gap-x-8 gap-y-2 font-mono text-xs text-ink-muted">
          <span>Balance {balance === null ? "loading" : formatUsdc(balance)}</span>
          {agent.fundingTx ? (
            <a href={explorerTx(agent.fundingTx)} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
              Funding transaction
            </a>
          ) : null}
        </div>
      ) : (
        <p className="ml-10 text-sm text-ink-muted">Moves {moves} from the platform wallet into a wallet only this agent controls.</p>
      )}

      {failure ? (
        <div className="ml-10 rounded-card border border-line-strong p-4 text-sm">
          <p>{failure.error}</p>
          {failure.details?.masterAddress ? (
            <p className="mt-2 font-mono text-xs text-ink-muted">
              Platform wallet {failure.details.masterAddress} holds {formatUsdc(failure.details.masterBalance)} and needs{" "}
              {formatUsdc(failure.details.needed)}. Top it up at {failure.details.faucet} and try again.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
