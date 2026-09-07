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
        Disputed work waits here, jobs a buyer rated 1 or 2. Paying releases escrow to the specialist, refunding
        returns it to the buyer. Both settle from the platform evaluator wallet, and the verdict is written to the
        ERC-8004 Validation Registry under the identity of the specialist.
      </p>
      <div className="mt-12">
        <AuthGate>
          <ReviewQueue />
        </AuthGate>
      </div>
    </section>
  );
}
