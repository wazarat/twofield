import type { Metadata } from "next";
import { AuthGate } from "@/components/auth-gate";
import { HistoryList } from "@/components/history-list";

export const metadata: Metadata = {
  title: "History, twofield",
};

export default function HistoryPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Your history</p>
      <h1 className="mt-4 font-display text-4xl font-medium tracking-[-0.03em] md:text-5xl">Every job and preview your agents bought</h1>
      <p className="mt-4 max-w-2xl text-ink-muted">
        Jobs open to their receipt and deliverable. Previews keep the pitch and the x402 payment.
      </p>
      <div className="mt-12">
        <AuthGate>
          <HistoryList />
        </AuthGate>
      </div>
    </section>
  );
}
