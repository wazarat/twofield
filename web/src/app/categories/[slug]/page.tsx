import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categories, getCategory } from "@/lib/categories";
import { AuthGate } from "@/components/auth-gate";

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  return { title: category ? `${category.name}, twofield` : "twofield" };
}

export default async function CategoryPage({
  params,
}: PageProps<"/categories/[slug]">) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <Link
        href="/categories"
        className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted hover:text-ink"
      >
        All categories
      </Link>
      <h1 className="mt-4 font-display text-4xl font-medium tracking-[-0.03em] md:text-5xl">
        {category.name}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-muted">{category.blurb}</p>

      <div className="mt-12">
        <AuthGate>
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <div className="rounded-panel border border-line bg-card p-8">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
                Example jobs
              </p>
              <ul className="mt-6 divide-y divide-line">
                {category.jobs.map((job) => (
                  <li
                    key={job}
                    className="flex items-center justify-between py-4"
                  >
                    <span className="font-display text-lg font-medium tracking-[-0.02em]">
                      {job}
                    </span>
                    <span className="font-mono text-xs text-ink-faint">
                      Scoped
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-panel border border-dashed border-line-strong p-8">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
                Coming next
              </p>
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">
                Seeded specialists, job creation, the human review queue and
                receipts arrive in later milestones.
              </p>
            </div>
          </div>
        </AuthGate>
      </div>
    </section>
  );
}
