import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Wordmark />
        <nav className="hidden items-center gap-8 text-sm text-ink-muted md:flex">
          <Link href="/categories" className="transition hover:text-ink">
            Categories
          </Link>
          <Link href="/#how-it-works" className="transition hover:text-ink">
            How it works
          </Link>
        </nav>
        <Link
          href="/categories"
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-ink/85"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}
