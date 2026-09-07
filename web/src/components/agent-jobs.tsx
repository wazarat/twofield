"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUsdc } from "@/lib/agents";
import { api } from "@/lib/api";
import type { PublicJob } from "@/lib/public-job";

export function AgentJobs({ agentId }: { agentId: string }) {
  const [list, setList] = useState<PublicJob[] | null>(null);

  useEffect(() => {
    let active = true;
    api<{ jobs: PublicJob[] }>(`/api/jobs?agent=${agentId}`)
      .then((d) => {
        if (active) setList(d.jobs);
      })
      .catch(() => {
        if (active) setList([]);
      });
    return () => {
      active = false;
    };
  }, [agentId]);

  return (
    <div className="rounded-panel border border-line bg-card p-8">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Jobs</p>
        <Link href="/categories/personal-brand" className="text-sm font-medium underline-offset-4 hover:underline">
          Hire a specialist
        </Link>
      </div>
      {list === null ? (
        <div className="mt-4 h-16 animate-pulse rounded-card bg-bg" aria-hidden="true" />
      ) : list.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">No jobs yet. Pick a specialist and this agent will fund the escrow.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {list.map((job) => (
            <li key={job.id} className="flex items-center justify-between gap-4 py-3">
              <Link href={`/jobs/${job.id}`} className="font-display text-lg font-medium tracking-[-0.02em] hover:underline">
                {job.seller?.name ?? "Job"}
              </Link>
              <span className="font-mono text-xs text-ink-muted">
                {formatUsdc(job.priceUsdc)}, {job.status.replace("_", " ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
