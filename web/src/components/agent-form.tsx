"use client";

import { useState } from "react";
import type { Agent } from "@/db/schema";
import { agentLimits } from "@/lib/agents";
import { api } from "@/lib/api";

const field =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none transition placeholder:text-ink-faint focus:border-ink";

export function AgentForm({ onCreated }: { onCreated: (agent: Agent) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("5");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { agent } = await api<{ agent: Agent }>("/api/agents", {
        method: "POST",
        body: JSON.stringify({ name, description, budgetPerJob: Number(budget) }),
      });
      onCreated(agent);
      setName("");
      setDescription("");
      setBudget("5");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-panel border border-line bg-card p-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Add an agent</p>
      <h2 className="mt-3 font-display text-2xl font-medium tracking-[-0.03em]">Give your agent a seat at the table</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        This is the agent that will hire specialists. It gets its own wallet and identity in the next steps.
      </p>

      <label className="mt-8 block text-sm font-medium">
        Name
        <input
          className={`${field} mt-2`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={agentLimits.nameMax}
          placeholder="Release research bot"
          required
        />
      </label>

      <label className="mt-5 block text-sm font-medium">
        What it works on
        <textarea
          className={`${field} mt-2 min-h-24 resize-y`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={agentLimits.descriptionMax}
          placeholder="Keeps our launch checklist moving and asks for a threat model before every release."
        />
      </label>

      <label className="mt-5 block text-sm font-medium">
        Budget per job, USDC
        <input
          className={`${field} mt-2 font-mono`}
          type="number"
          inputMode="decimal"
          min={agentLimits.budgetMin}
          max={agentLimits.budgetMax}
          step="0.01"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          required
        />
      </label>

      {error ? <p className="mt-4 text-sm text-ink">{error}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-8 rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition hover:bg-ink/85 disabled:opacity-50"
      >
        {busy ? "Saving" : "Add agent"}
      </button>
    </form>
  );
}
