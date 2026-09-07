"use client";

import { useState } from "react";
import { jobPeriods, type Agent } from "@/db/schema";
import { agentLimits, formatUsdc, periodLabels } from "@/lib/agents";
import { api } from "@/lib/api";
import { explorerTx } from "@/lib/arc";

const field =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none transition placeholder:text-ink-faint focus:border-ink";

type Outcome = { agent: Agent; topUpUsdc: string | null; policyRewritten: boolean };

export function EditAgentForm({ agent, onUpdated, onClose }: { agent: Agent; onUpdated: (agent: Agent) => void; onClose: () => void }) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [perJob, setPerJob] = useState(String(Number(agent.maxBudgetPerJob)));
  const [jobs, setJobs] = useState(String(agent.maxJobs));
  const [period, setPeriod] = useState<Agent["jobsPeriod"]>(agent.jobsPeriod);
  const [total, setTotal] = useState(String(Number(agent.maxTotalBudget)));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);

  const raise = Number(total) - Number(agent.maxTotalBudget);
  const { budgetMin, budgetMax, jobsMin, jobsMax } = agentLimits;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (Number(total) < Number(perJob)) {
      setError("Max total budget must be at least the max budget per job");
      return;
    }
    setBusy(true);
    try {
      const outcome = await api<Outcome>(`/api/agents/${agent.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          description,
          maxBudgetPerJob: Number(perJob),
          maxJobs: Number(jobs),
          jobsPeriod: period,
          maxTotalBudget: Number(total),
        }),
      });
      onUpdated(outcome.agent);
      setDone(outcome);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-card border border-line p-5 text-sm">
        <p>
          Saved.
          {done.policyRewritten ? " The wallet policy now carries the new per job cap." : ""}
          {done.topUpUsdc && done.agent.topUpTx ? (
            <>
              {" "}
              {formatUsdc(done.topUpUsdc)} moved from the platform wallet,{" "}
              <a href={explorerTx(done.agent.topUpTx)} target="_blank" rel="noreferrer" className="text-ink underline-offset-4 hover:underline">
                transaction
              </a>
              .
            </>
          ) : null}
        </p>
        <button type="button" onClick={onClose} className="mt-4 rounded-full border border-ink px-5 py-2 text-sm font-medium transition hover:bg-ink hover:text-white">
          Close
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
      <label className="block text-sm font-medium">
        Name
        <input className={`${field} mt-2`} value={name} onChange={(e) => setName(e.target.value)} maxLength={agentLimits.nameMax} required />
      </label>
      <label className="block text-sm font-medium">
        What it works on
        <textarea className={`${field} mt-2 min-h-20 resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={agentLimits.descriptionMax} />
      </label>
      <label className="block text-sm font-medium">
        Max budget per job, USDC
        <input className={`${field} mt-2 font-mono`} type="number" inputMode="decimal" min={budgetMin} max={budgetMax} step="0.01" value={perJob} onChange={(e) => setPerJob(e.target.value)} required />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Max jobs
          <input className={`${field} mt-2 font-mono`} type="number" inputMode="numeric" min={jobsMin} max={jobsMax} step="1" value={jobs} onChange={(e) => setJobs(e.target.value)} required />
        </label>
        <label className="block text-sm font-medium">
          Per
          <select className={`${field} mt-2`} value={period} onChange={(e) => setPeriod(e.target.value as Agent["jobsPeriod"])}>
            {jobPeriods.map((p) => (
              <option key={p} value={p}>
                {periodLabels[p]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium">
        Max total budget, USDC
        <input className={`${field} mt-2 font-mono`} type="number" inputMode="decimal" min={budgetMin} max={budgetMax} step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} required />
        <span className="mt-1 block font-mono text-[11px] font-normal text-ink-faint">
          {agent.status !== "draft" && raise > 0 ? `${formatUsdc(raise)} will move from the platform wallet` : "Raising the total moves the difference from the platform wallet. Lowering it leaves the balance where it is."}
        </span>
      </label>
      {error ? <p className="text-sm text-ink">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-ink/85 disabled:opacity-50">
          {busy ? "Saving" : "Save changes"}
        </button>
        <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-ink px-5 py-2 text-sm font-medium transition hover:bg-ink hover:text-white disabled:opacity-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
