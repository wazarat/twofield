"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUsdc } from "@/lib/agents";
import { api } from "@/lib/api";
import type { PublicJob } from "@/lib/public-job";
import { Deliverable } from "@/components/deliverable";

export function ReviewQueue() {
  const { ready, user } = usePrivy();
  const [list, setList] = useState<PublicJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const isOwner = Boolean(user?.id) && user?.id === process.env.NEXT_PUBLIC_PLATFORM_OWNER_ID;

  useEffect(() => {
    if (!ready || !isOwner) return;
    let active = true;
    api<{ jobs: PublicJob[] }>("/api/review")
      .then((d) => {
        if (active) setList(d.jobs);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load the queue");
      });
    return () => {
      active = false;
    };
  }, [ready, isOwner]);

  async function decide(job: PublicJob, action: "approve" | "reject") {
    setBusyId(job.id);
    setError(null);
    try {
      const d = await api<{ job: PublicJob }>(`/api/jobs/${job.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ note: notes[job.id] ?? "" }),
      });
      setList((prev) => (prev ?? []).map((j) => (j.id === job.id ? d.job : j)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return <div className="h-48 animate-pulse rounded-panel border border-line bg-card/60" aria-hidden="true" />;
  if (!isOwner) {
    return (
      <div className="rounded-panel border border-line bg-card p-8">
        <p className="text-sm text-ink-muted">The review queue is only for the platform owner.</p>
      </div>
    );
  }
  if (error && !list) return <p className="text-sm">{error}</p>;
  if (!list) return <div className="h-48 animate-pulse rounded-panel border border-line bg-card/60" aria-hidden="true" />;

  const waiting = list.filter((j) => j.status === "submitted");
  const working = list.filter((j) => j.status !== "submitted");

  return (
    <div className="flex flex-col gap-6">
      {error ? <p className="text-sm">{error}</p> : null}
      {waiting.length === 0 ? (
        <div className="rounded-panel border border-dashed border-line-strong p-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Nothing to review</p>
          <p className="mt-3 text-sm text-ink-muted">Submitted work appears here once a specialist finishes.</p>
        </div>
      ) : null}
      {waiting.map((job) => (
        <div key={job.id} className="rounded-panel border border-line bg-card p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
                {job.seller?.name} for {job.buyer?.name}
              </p>
              <h2 className="mt-2 font-display text-2xl font-medium tracking-[-0.03em]">
                {formatUsdc(job.priceUsdc)} in escrow, ERC-8183 job {job.onchainJobId}
              </h2>
            </div>
            <Link href={`/jobs/${job.id}`} className="text-sm font-medium underline-offset-4 hover:underline">
              Open job
            </Link>
          </div>
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-medium">Brief</summary>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{job.brief}</p>
          </details>
          <div className="mt-6 max-h-[32rem] overflow-y-auto rounded-card border border-line p-6">
            {job.deliverable ? <Deliverable text={job.deliverable} /> : <p className="text-sm text-ink-muted">No deliverable stored.</p>}
          </div>
          <label className="mt-6 block text-sm font-medium">
            Review note, optional
            <input
              className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-ink"
              value={notes[job.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [job.id]: e.target.value }))}
              maxLength={500}
              placeholder="Why you approved or rejected, kept with the receipt"
            />
          </label>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busyId === job.id}
              onClick={() => decide(job, "approve")}
              className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition hover:bg-ink/85 disabled:opacity-50"
            >
              {busyId === job.id ? "Settling" : "Approve and pay the specialist"}
            </button>
            <button
              type="button"
              disabled={busyId === job.id}
              onClick={() => decide(job, "reject")}
              className="rounded-full border border-ink px-6 py-3 text-sm font-medium transition hover:bg-ink hover:text-white disabled:opacity-50"
            >
              Reject and refund the buyer
            </button>
          </div>
        </div>
      ))}
      {working.length ? (
        <div className="rounded-panel border border-line bg-card p-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">In progress</p>
          <ul className="mt-4 divide-y divide-line">
            {working.map((job) => (
              <li key={job.id} className="flex items-center justify-between gap-4 py-3">
                <Link href={`/jobs/${job.id}`} className="font-display text-lg font-medium tracking-[-0.02em] hover:underline">
                  {job.seller?.name} for {job.buyer?.name}
                </Link>
                <span className="font-mono text-xs text-ink-muted">
                  {formatUsdc(job.priceUsdc)}, {job.lastError ? "stopped, open to retry" : job.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
