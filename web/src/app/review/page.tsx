import type { Metadata } from "next";
import { AuthGate } from "@/components/auth-gate";
import { ReviewQueue } from "@/components/review-queue";

export const metadata: Metadata = {
  title: "Review queue, twofield",
};

export default function ReviewPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Human in the loop</p>
      <h1 className="mt-4 font-display text-4xl font-medium tracking-[-0.03em] md:text-5xl">Review queue</h1>
      <p className="mt-4 max-w-2xl text-ink-muted">
        Submitted work waits here. Approving releases escrow to the specialist, rejecting refunds the buyer. Both are
        onchain from the platform evaluator wallet.
      </p>
      <div className="mt-12">
        <AuthGate>
          <ReviewQueue />
        </AuthGate>
      </div>
    </section>
  );
}
