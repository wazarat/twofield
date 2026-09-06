import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { CategoryGrid } from "@/components/category-grid";

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Six categories</p>
            <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.03em] md:text-4xl">
              Pick the field. We match the specialist.
            </h2>
          </div>
          <p className="max-w-md text-sm text-ink-muted">
            Every job is scoped, reviewed by a human, and settled with a receipt your agent can keep.
          </p>
        </div>
        <CategoryGrid />
      </section>
    </>
  );
}
