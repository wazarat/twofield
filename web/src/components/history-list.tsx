"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUsdc } from "@/lib/agents";
import { api } from "@/lib/api";
import { explorerTx } from "@/lib/arc";
import { historyStatusLabel, type HistoryItem } from "@/lib/history";
import { buyerLabel } from "@/lib/public-job";

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function HistoryList({ agentId }: { agentId?: string } = {}) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<{ items: HistoryItem[] }>(agentId ? `/api/history?agent=${agentId}` : "/api/history")
      .then((d) => {
        if (active) setItems(d.items);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load history");
      });
    return () => {
      active = false;
    };
  }, [agentId]);

  if (error) return <p className="text-sm">{error}</p>;
  if (!items) return <div className="h-48 animate-pulse rounded-panel border border-line bg-card/60" aria-hidden="true" />;
  if (items.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line-strong p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Nothing yet</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          When an agent hires a specialist or pays for a preview, it shows up here with the work.
        </p>
      </div>
    );
  }

  return (
    <ol className="divide-y divide-line rounded-panel border border-line bg-card">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`} className="px-8 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div>
              <p className="font-display text-lg font-medium tracking-[-0.02em]">
                {buyerLabel(item.agent)} {item.kind === "job" ? "hired" : "previewed"}{" "}
                <Link href={item.href} className="underline-offset-4 hover:underline">
                  {item.seller.name}
                </Link>
              </p>
              <p className="mt-1 font-mono text-xs text-ink-muted">
                {when(item.createdAt)}, {item.kind === "job" ? "job" : "preview"}, {formatUsdc(item.amountUsdc)}
              </p>
            </div>
            <div className="flex items-center gap-4 font-mono text-xs">
              <span className="rounded-full border border-line px-2.5 py-0.5 uppercase tracking-wide text-ink-muted">{historyStatusLabel(item)}</span>
              {item.tx ? (
                <a href={explorerTx(item.tx)} target="_blank" rel="noreferrer" className="text-ink underline-offset-4 hover:underline">
                  transaction
                </a>
              ) : null}
              {item.kind === "job" ? (
                <Link href={item.href} className="text-ink underline-offset-4 hover:underline">
                  {item.hasDeliverable ? "receipt and work" : "receipt"}
                </Link>
              ) : null}
            </div>
          </div>
          {item.kind === "preview" ? (
            <details className="mt-3">
              <summary className="cursor-pointer font-mono text-xs text-ink-muted">Pitch</summary>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{item.pitch}</p>
              <p className="mt-3 font-mono text-xs text-ink-faint">Brief. {item.brief}</p>
            </details>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
