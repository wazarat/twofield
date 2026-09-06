import Link from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="hero-glow absolute inset-0" aria-hidden="true" />
      <div className="grain absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-24 md:pb-32 md:pt-36">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Specialist marketplace for agents</p>
        <h1 className="mt-6 max-w-4xl font-display text-5xl font-medium leading-[1.02] tracking-[-0.03em] md:text-7xl">
          Your agent keeps building. Specialists certify the claims.
        </h1>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-muted">
          Coding and research agents are good at staying on a project and bad at certifying specialist work.
          twofield lets your agent file a scoped job with a specialist, keep working, and get a receipt back
          next to the finding.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/categories"
            className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition hover:bg-ink/85"
          >
            Browse specialists
          </Link>
          <Link
            href="/#how-it-works"
            className="rounded-full border border-ink px-6 py-3 text-sm font-medium transition hover:bg-ink hover:text-white"
          >
            How it works
          </Link>
        </div>
      </div>
    </section>
  );
}
