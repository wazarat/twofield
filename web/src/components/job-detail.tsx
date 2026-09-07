"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUsdc } from "@/lib/agents";
import { api } from "@/lib/api";
import { AGENTIC_COMMERCE, explorerAddress, explorerTx } from "@/lib/arc";
import type { PublicJob } from "@/lib/public-job";

const statusLabel: Record<PublicJob["status"], string> = {
  pending: "Opening",
  created: "Created onchain",
  budgeted: "Price set",
  funded: "Funded, escrow holds the price",
  generating: "Specialist working",
  submitted: "Submitted, awaiting review",
  approved: "Approved, specialist paid",
  rejected: "Rejected",
  refunded: "Refunded",
  failed: "Failed",
};

export function JobDetail({ id }: { id: string }) {
  const [job, setJob] = useState<PublicJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api<{ job: PublicJob }>(`/api/jobs/${id}`)
      .then((d) => {
        if (active) setJob(d.job);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load job");
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function retry() {
    setBusy(true);
    try {
      const d = await api<{ job: PublicJob }>(`/api/jobs/${id}/retry`, { method: "POST" });
      setJob(d.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-panel border border-line bg-card p-8">
        <p className="text-sm">{error}</p>
        <Link href="/agents" className="mt-4 inline-block text-sm font-medium underline">
          Back to agents
        </Link>
      </div>
    );
  }
  if (!job) return <div className="h-64 animate-pulse rounded-panel border border-line bg-card/60" aria-hidden="true" />;

  const steps = [
    { label: "Job created onchain", tx: job.createTx, note: job.onchainJobId ? `ERC-8183 job ${job.onchainJobId}` : undefined },
    { label: "Specialist set the price", tx: job.budgetTx, note: formatUsdc(job.priceUsdc) },
    { label: "Escrow approved", tx: job.approveTx },
    { label: "Escrow funded", tx: job.fundTx },
    { label: "Work submitted", tx: job.submitTx, note: job.submitTx ? undefined : "Next milestone" },
    { label: "Settled", tx: job.settleTx ?? job.refundTx, note: job.settleTx || job.refundTx ? undefined : "Next milestone" },
  ];
  const stalled = Boolean(job.lastError) && !job.fundTx;

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-display text-4xl font-medium tracking-[-0.03em] md:text-5xl">{job.seller?.name ?? "Job"}</h1>
        <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">
          {statusLabel[job.status]}
        </span>
      </div>
      <p className="mt-4 max-w-2xl text-lg text-ink-muted">
        Hired by {job.buyer ? <Link href={`/agents/${job.buyer.id}`} className="text-ink underline-offset-4 hover:underline">{job.buyer.name}</Link> : "your agent"} for {formatUsdc(job.priceUsdc)}.
      </p>

      <div className="mt-12 grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="rounded-panel border border-line bg-card p-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Timeline</p>
            <ol className="mt-6 divide-y divide-line">
              {steps.map((step, i) => (
                <li key={step.label} className="flex items-center justify-between gap-6 py-4">
                  <div className="flex items-center gap-4">
                    <span className={`font-mono text-sm ${step.tx ? "text-ink" : "text-ink-faint"}`}>0{i + 1}</span>
                    <span className="font-display text-lg font-medium tracking-[-0.02em]">{step.label}</span>
                  </div>
                  <span className="font-mono text-xs text-ink-muted">
                    {step.tx ? (
                      <a href={explorerTx(step.tx)} target="_blank" rel="noreferrer" className="text-ink underline-offset-4 hover:underline">
                        {step.note ?? "transaction"}
                      </a>
                    ) : (
                      <span className="text-ink-faint">{step.note ?? "waiting"}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            {stalled ? (
              <div className="mt-6 rounded-card border border-line-strong p-4 text-sm">
                <p>Escrow stopped at a step. {job.lastError}</p>
                <button type="button" onClick={retry} disabled={busy} className="mt-3 rounded-full bg-ink px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {busy ? "Retrying" : "Retry"}
                </button>
              </div>
            ) : null}
          </div>
          <div className="rounded-panel border border-line bg-card p-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Brief</p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{job.brief}</p>
          </div>
        </div>
        <div className="rounded-panel border border-line bg-card p-8 font-mono text-xs text-ink-muted">
          <p className="uppercase tracking-[0.2em]">Escrow</p>
          <dl className="mt-4 flex flex-col gap-2">
            <div className="flex justify-between gap-4">
              <dt>Contract</dt>
              <dd>
                <a href={explorerAddress(AGENTIC_COMMERCE)} target="_blank" rel="noreferrer" className="text-ink underline-offset-4 hover:underline">
                  ERC-8183
                </a>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Job id</dt>
              <dd>{job.onchainJobId ?? "pending"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Amount</dt>
              <dd>{formatUsdc(job.priceUsdc)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Expires</dt>
              <dd>{job.expiresAt ? new Date(job.expiresAt).toLocaleString("en-US") : "pending"}</dd>
            </div>
            {job.seller?.onchainAgentId ? (
              <div className="flex justify-between gap-4">
                <dt>Specialist id</dt>
                <dd>{job.seller.onchainAgentId}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </>
  );
}
