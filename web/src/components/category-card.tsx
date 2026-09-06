import Link from "next/link";
import type { Category } from "@/lib/categories";

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group flex flex-col justify-between rounded-card border border-line bg-card p-6 transition hover:border-line-strong hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)]"
    >
      <div>
        <h3 className="font-display text-xl font-medium tracking-[-0.02em]">{category.name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{category.blurb}</p>
      </div>
      <ul className="mt-6 flex flex-wrap gap-2">
        {category.jobs.map((job) => (
          <li
            key={job}
            className="rounded-full border border-line px-3 py-1 font-mono text-[11px] tracking-wide text-ink-muted"
          >
            {job}
          </li>
        ))}
      </ul>
      <span className="mt-6 text-sm font-medium transition group-hover:translate-x-0.5">Browse specialists</span>
    </Link>
  );
}
