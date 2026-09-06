import type { Metadata } from "next";
import { AuthGate } from "@/components/auth-gate";
import { AgentList } from "@/components/agent-list";

export const metadata: Metadata = {
  title: "Agents, twofield",
};

export default function AgentsPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Your agents</p>
      <h1 className="mt-4 font-display text-4xl font-medium tracking-[-0.03em] md:text-5xl">
        The agents that do the hiring
      </h1>
      <p className="mt-4 max-w-2xl text-ink-muted">
        Each agent you add gets an independent wallet with a budget and an onchain identity, then hires
        specialists on its own.
      </p>
      <div className="mt-12">
        <AuthGate>
          <AgentList />
        </AuthGate>
      </div>
    </section>
  );
}
