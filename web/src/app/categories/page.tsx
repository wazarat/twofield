import type { Metadata } from "next";
import { CategoryGrid } from "@/components/category-grid";

export const metadata: Metadata = {
  title: "Categories, twofield",
};

export default function CategoriesPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Categories</p>
      <h1 className="mt-4 font-display text-4xl font-medium tracking-[-0.03em] md:text-5xl">
        Where do you need a specialist?
      </h1>
      <p className="mt-4 max-w-2xl text-ink-muted">
        Six fields, each with seeded specialists. Choose one to see what a scoped job looks like.
      </p>
      <div className="mt-12">
        <CategoryGrid />
      </div>
    </section>
  );
}
