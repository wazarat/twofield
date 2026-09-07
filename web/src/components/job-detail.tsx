"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatUsdc } from "@/lib/agents";
import { api } from "@/lib/api";
import { AGENTIC_COMMERCE, explorerAddress, explorerTx } from "@/lib/arc";
import { formatBytes } from "@/lib/context";
import { jobStatusLabel as statusLabel } from "@/lib/history";
import { buyerLabel, type PublicJob } from "@/lib/public-job";
import { Deliverable } from "@/components/deliverable";


export function JobDetail({ id }: { id: string }) {
  const { user } = usePrivy();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const isOwner = Boolean(user?.id) && user?.id === process.env.NEXT_PUBLIC_PLATFORM_OWNER_ID;

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

  // A funded job starts the specialist's work the first time its page is opened.
  useEffect(() => {
    if (!job || job.status !== "funded" || job.lastError || started.current) return;
    started.current = true;
    setBusy(true);
    api<{ job: PublicJob }>(`/api/jobs/${id}/work`, { method: "POST" })
      .then((d) => setJob(d.job))
      .catch((err) => setError(err instanceof Error ? err.message : "Work failed"))
      .finally(() => setBusy(false));
  }, [job, id]);

  // A settled job records the buyer's feedback on the specialist once.
  const rated = useRef(false);
  useEffect(() => {
    if (!job || (job.status !== "approved" && job.status !== "refunded") || job.feedbackTx || rated.current) return;
    rated.current = true;
    api<{ job: PublicJob }>(`/api/jobs/${id}/feedback`, { method: "POST" })
      .then((d) => setJob(d.job))
      .catch(() => undefined);
  }, [job, id]);

  async function call(path: string) {
    setBusy(true);
    setError(null);
    try {
      const d = await api<{ job: PublicJob }>(path, { method: "POST" });
      setJob(d.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !job) {
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

  const settled = job.status === "approved" || job.status === "refunded";
  const steps = [
    { label: "Job created onchain", tx: job.createTx, note: job.onchainJobId ? `ERC-8183 job ${job.onchainJobId}` : undefined },
    { label: "Specialist set the price", tx: job.budgetTx, note: formatUsdc(job.priceUsdc) },
    { label: "Escrow approved", tx: job.approveTx },
    { label: "Escrow funded", tx: job.fundTx },
    { label: "Work submitted", tx: job.submitTx, note: job.status === "generating" || busy ? "in progress" : undefined },
    { label: job.refundTx ? "Rejected, buyer refunded" : "Approved, specialist paid", tx: job.settleTx ?? job.refundTx, note: job.status === "submitted" ? "awaiting review" : undefined },
  ];
  const escrowStalled = Boolean(job.lastError) && !job.fundTx;
  const workStalled = Boolean(job.lastError) && Boolean(job.fundTx) && !job.submitTx;

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-display text-4xl font-medium tracking-[-0.03em] md:text-5xl">{job.seller?.name ?? "Job"}</h1>
        <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">
          {busy && job.status === "funded" ? "Specialist working" : statusLabel[job.status]}
        </span>
      </div>
      <p className="mt-4 max-w-2xl text-lg text-ink-muted">
        Hired by {job.buyer ? <Link href={`/agents/${job.buyer.id}`} className="text-ink underline-offset-4 hover:underline">{buyerLabel(job.buyer)}</Link> : "your agent"} for {formatUsdc(job.priceUsdc)}.
      </p>

      <div className="mt-12 grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          {job.deliverable ? (
            <div className="rounded-panel border border-line bg-card p-8">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Deliverable</p>
              <div className="mt-4">
                <Deliverable text={job.deliverable} />
              </div>
            </div>
          ) : null}

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
            {busy && job.status === "funded" ? (
              <p className="mt-6 text-sm text-ink-muted">The specialist is writing the niche pack. This takes about a minute.</p>
            ) : null}
            {job.status === "submitted" ? (
              <p className="mt-6 text-sm text-ink-muted">
                Work is in the human review queue. Escrow releases to the specialist on approval.
                {isOwner ? (
                  <>
                    {" "}
                    <Link href="/review" className="text-ink underline-offset-4 hover:underline">
                      Open the review queue
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}
            {escrowStalled || workStalled ? (
              <div className="mt-6 rounded-card border border-line-strong p-4 text-sm">
                <p>{escrowStalled ? "Escrow stopped at a step." : "Work stopped."} {job.lastError}</p>
                <button
                  type="button"
                  onClick={() => call(escrowStalled ? `/api/jobs/${id}/retry` : `/api/jobs/${id}/work`)}
                  disabled={busy}
                  className="mt-3 rounded-full bg-ink px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Retrying" : "Retry"}
                </button>
              </div>
            ) : null}
            {error && job ? <p className="mt-4 text-sm">{error}</p> : null}
          </div>

          <div className="rounded-panel border border-line bg-card p-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Brief</p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{job.brief}</p>
            {job.context ? (
              <>
                <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Context</p>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{job.context}</p>
              </>
            ) : null}
            {job.files?.length ? (
              <>
                <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Files</p>
                <ul className="mt-4 divide-y divide-line rounded-card border border-line">
                  {job.files.map((f) => (
                    <li key={f.id}>
                      <details>
                        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 font-mono text-xs">
                          <span className="truncate">{f.name}</span>
                          <span className="shrink-0 text-ink-muted">{formatBytes(f.bytes)}</span>
                        </summary>
                        <pre className="max-h-96 overflow-auto border-t border-line bg-bg px-4 py-3 font-mono text-xs leading-relaxed text-ink-muted">{f.content}</pre>
                      </details>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-panel border border-line bg-card p-8 font-mono text-xs text-ink-muted">
            <p className="uppercase tracking-[0.2em]">{settled ? "Receipt" : "Escrow"}</p>
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
                <dt>{settled ? "Outcome" : "Expires"}</dt>
                <dd>{settled ? (job.settleTx ? "paid to specialist" : "refunded to buyer") : job.expiresAt ? new Date(job.expiresAt).toLocaleString("en-US") : "pending"}</dd>
              </div>
              {job.seller?.onchainAgentId ? (
                <div className="flex justify-between gap-4">
                  <dt>Specialist id</dt>
                  <dd>{job.seller.onchainAgentId}</dd>
                </div>
              ) : null}
              {job.deliverableHash ? (
                <div className="flex justify-between gap-4">
                  <dt>Deliverable hash</dt>
                  <dd title={job.deliverableHash}>{job.deliverableHash.slice(0, 10)}...</dd>
                </div>
              ) : null}
              {job.settleTx || job.refundTx ? (
                <div className="flex justify-between gap-4">
                  <dt>Settlement</dt>
                  <dd>
                    <a href={explorerTx((job.settleTx ?? job.refundTx)!)} target="_blank" rel="noreferrer" className="text-ink underline-offset-4 hover:underline">
                      transaction
                    </a>
                  </dd>
                </div>
              ) : null}
              {job.reviewNote ? (
                <div className="flex justify-between gap-4">
                  <dt>Review note</dt>
                  <dd className="text-right">{job.reviewNote}</dd>
                </div>
              ) : null}
              {settled ? (
                <div className="flex justify-between gap-4">
                  <dt>Reputation</dt>
                  <dd>
                    {job.feedbackTx ? (
                      <a href={explorerTx(job.feedbackTx)} target="_blank" rel="noreferrer" className="text-ink underline-offset-4 hover:underline">
                        {job.status === "approved" ? "rated 100" : "rated 0"}
                      </a>
                    ) : (
                      "recording"
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
