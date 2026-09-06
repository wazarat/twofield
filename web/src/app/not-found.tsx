import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">404</p>
      <h1 className="mt-4 font-display text-4xl font-medium tracking-[-0.03em]">That page does not exist.</h1>
      <Link href="/" className="mt-8 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-white">
        Back home
      </Link>
    </section>
  );
}
