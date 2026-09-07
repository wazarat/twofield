"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Agent } from "@/db/schema";
import { formatUsdc } from "@/lib/agents";
import { ApiError, api } from "@/lib/api";
import { acceptList, contextLimits, fileBytes, formatBytes, validateContext, type ContextFile } from "@/lib/context";
import type { PublicJob } from "@/lib/public-job";

const field =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none transition placeholder:text-ink-faint focus:border-ink";

export function HireButton({ sellerId, sellerName, priceUsdc, size = "sm" }: { sellerId: string; sellerName: string; priceUsdc: string; size?: "sm" | "lg" }) {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [buyers, setBuyers] = useState<Agent[] | null>(null);
  const [buyerId, setBuyerId] = useState("");
  const [brief, setBrief] = useState("");
  const [context, setContext] = useState("");
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const picked = await Promise.all(Array.from(list).map(async (f) => ({ name: f.name, content: await f.text() })));
    const next = [...files.filter((f) => !picked.some((p) => p.name === f.name)), ...picked];
    const check = validateContext({ context, files: next });
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setFiles(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const check = validateContext({ context, files });
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
    try {
      const { job } = await api<{ job: PublicJob }>("/api/jobs", {
        method: "POST",
        body: JSON.stringify({ buyerAgentId: buyerId, sellerAgentId: sellerId, brief, context: check.context, files: check.files }),
      });
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.details?.needed) {
        setError(`${err.message}. It holds ${formatUsdc(err.details.balance)} and needs ${formatUsdc(err.details.needed)}.`);
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  }

  const pill = size === "lg" ? "rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition hover:bg-ink/85" : "rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink/85";

  if (!ready) return <span className={`${pill} invisible`}>Hire</span>;
  if (!authenticated) {
    return (
      <button type="button" onClick={() => login()} className={pill}>
        Hire
      </button>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill}>
        Hire
      </button>
      {open ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/30 p-4 backdrop-blur-sm sm:items-center" onClick={() => !busy && setOpen(false)}>
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-panel border border-line bg-card p-8 shadow-[0_24px_60px_rgba(0,0,0,0.12)]"
          >
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Hire {sellerName}</p>
            <h2 className="mt-3 font-display text-2xl font-medium tracking-[-0.03em]">
              {formatUsdc(priceUsdc)} held in escrow until you approve the work
            </h2>

            <label className="mt-6 block text-sm font-medium">
              Which of your agents is hiring
              <select className={`${field} mt-2`} value={buyerId} onChange={(e) => setBuyerId(e.target.value)} required>
                {buyers === null ? <option>Loading</option> : null}
                {buyers?.length === 0 ? <option value="">No agent with a wallet yet</option> : null}
                {buyers?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}, up to {formatUsdc(b.maxBudgetPerJob)} per job
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-5 block text-sm font-medium">
              Brief for the specialist
              <textarea
                className={`${field} mt-2 min-h-32 resize-y`}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                minLength={40}
                maxLength={2000}
                placeholder="Who you are, what you have built in fintech, who you want to reach, and the platforms you post on."
                required
              />
              <span className="mt-1 block font-mono text-[11px] font-normal text-ink-faint">40 to 2000 characters</span>
            </label>

            <label className="mt-5 block text-sm font-medium">
              Context, optional
              <textarea
                className={`${field} mt-2 min-h-20 resize-y`}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                maxLength={contextLimits.contextMax}
                placeholder="Notes, past posts, a bio draft, anything the specialist should read."
              />
            </label>

            <div className="mt-5 text-sm font-medium">
              Files, optional
              <label className="mt-2 block cursor-pointer rounded-xl border border-dashed border-line-strong px-4 py-3 text-center text-sm font-normal text-ink-muted transition hover:border-ink">
                Add text files, code, markdown, csv or json
                <input type="file" multiple accept={acceptList} className="hidden" onChange={(e) => addFiles(e.target.files).then(() => (e.target.value = ""))} />
              </label>
              {files.length ? (
                <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                  {files.map((f) => (
                    <li key={f.name} className="flex items-center justify-between gap-3 px-4 py-2 font-mono text-xs">
                      <span className="truncate">{f.name}</span>
                      <span className="flex shrink-0 items-center gap-3 text-ink-muted">
                        {formatBytes(fileBytes(f.content))}
                        <button type="button" onClick={() => setFiles(files.filter((x) => x.name !== f.name))} className="text-ink underline-offset-4 hover:underline">
                          Remove
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <span className="mt-1 block font-mono text-[11px] font-normal text-ink-faint">
                Up to {contextLimits.maxFiles} files, {formatBytes(contextLimits.maxFileBytes)} each, {formatBytes(contextLimits.maxTotalBytes)} in total.
                {files.length ? ` Attached ${formatBytes(files.reduce((n, f) => n + fileBytes(f.content), 0))}.` : ""}
              </span>
            </div>

            {error ? <p className="mt-4 text-sm">{error}</p> : null}

            <div className="mt-8 flex flex-wrap gap-3">
              <button type="submit" disabled={busy || !buyerId} className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition hover:bg-ink/85 disabled:opacity-50">
                {busy ? "Opening escrow, about twenty seconds" : "Hire and fund escrow"}
              </button>
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-full border border-ink px-6 py-3 text-sm font-medium transition hover:bg-ink hover:text-white disabled:opacity-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
