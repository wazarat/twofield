"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import type { Agent } from "@/db/schema";
import { formatUsdc } from "@/lib/agents";
import { api } from "@/lib/api";
import { explorerTx } from "@/lib/arc";
import type { PreviewResult } from "@/lib/buyer-preview";

const field =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none transition placeholder:text-ink-faint focus:border-ink";

export function PreviewButton({ sellerId, sellerName }: { sellerId: string; sellerName: string }) {
  const { ready, authenticated, login } = usePrivy();
  const [open, setOpen] = useState(false);
  const [buyers, setBuyers] = useState<Agent[] | null>(null);
  const [buyerId, setBuyerId] = useState("");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResult | null>(null);

  useEffect(() => {
    if (!open || buyers) return;
    api<{ agents: Agent[] }>("/api/agents")
      .then((data) => {
        const eligible = data.agents.filter((a) => a.status !== "draft");
        setBuyers(eligible);
        if (eligible[0]) setBuyerId(eligible[0].id);
      })
      .catch(() => setBuyers([]));
  }, [open, buyers]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const d = await api<{ preview: PreviewResult }>(`/api/agents/${buyerId}/preview`, {
        method: "POST",
        body: JSON.stringify({ sellerId, brief }),
      });
      setResult(d.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const pill = "rounded-full border border-ink px-6 py-3 text-sm font-medium transition hover:bg-ink hover:text-white";
  if (!ready) return <span className={`${pill} invisible`}>Preview</span>;
  if (!authenticated) {
    return (
      <button type="button" onClick={() => login()} className={pill}>
        Preview pitch, 0.01 USDC
      </button>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill}>
        Preview pitch, 0.01 USDC
      </button>
      {open ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/30 p-4 backdrop-blur-sm sm:items-center" onClick={() => !busy && setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-panel border border-line bg-card p-8 shadow-[0_24px_60px_rgba(0,0,0,0.12)]">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Preview {sellerName}</p>
            {result ? (
              <>
                <h2 className="mt-3 font-display text-2xl font-medium tracking-[-0.03em]">The pitch</h2>
                <p className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-muted">{result.pitch}</p>
                <p className="mt-6 font-mono text-xs text-ink-muted">
                  Paid {result.payment.amount ? formatUsdc(Number(result.payment.amount) / 1_000_000) : "0.01 USDC"} over x402.{" "}
                  {result.payment.transaction ? (
                    <a href={explorerTx(result.payment.transaction)} target="_blank" rel="noreferrer" className="text-ink underline-offset-4 hover:underline">
                      Settlement transaction
                    </a>
                  ) : null}
                </p>
                <button type="button" onClick={() => { setResult(null); setOpen(false); }} className="mt-8 rounded-full bg-ink px-6 py-3 font-sans text-sm font-medium text-white">
                  Done
                </button>
              </>
            ) : (
              <form onSubmit={submit}>
                <h2 className="mt-3 font-display text-2xl font-medium tracking-[-0.03em]">One paid call, one pitch, before any escrow</h2>
                <p className="mt-2 font-sans text-sm leading-relaxed text-ink-muted">
                  Your agent pays 0.01 USDC straight to the specialist over x402 and gets a short pitch for your brief.
                </p>
                <label className="mt-6 block font-sans text-sm font-medium">
                  Which of your agents is asking
                  <select className={`${field} mt-2`} value={buyerId} onChange={(e) => setBuyerId(e.target.value)} required>
                    {buyers === null ? <option>Loading</option> : null}
                    {buyers?.length === 0 ? <option value="">No agent with a wallet yet</option> : null}
                    {buyers?.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-5 block font-sans text-sm font-medium">
                  Brief
                  <textarea
                    className={`${field} mt-2 min-h-24 resize-y`}
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    minLength={20}
                    maxLength={500}
                    placeholder="Who you are and what you want to be known for in fintech."
                    required
                  />
                  <span className="mt-1 block font-mono text-[11px] font-normal text-ink-faint">20 to 500 characters</span>
                </label>
                {error ? <p className="mt-4 font-sans text-sm">{error}</p> : null}
                <div className="mt-8 flex flex-wrap gap-3">
                  <button type="submit" disabled={busy || !buyerId} className="rounded-full bg-ink px-6 py-3 font-sans text-sm font-medium text-white transition hover:bg-ink/85 disabled:opacity-50">
                    {busy ? "Paying and waiting for the pitch" : "Pay 0.01 USDC and preview"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-full border border-ink px-6 py-3 font-sans text-sm font-medium transition hover:bg-ink hover:text-white disabled:opacity-50">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
