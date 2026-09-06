"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";

const link = "transition hover:text-ink";

export function NavLinks() {
  const { ready, authenticated } = usePrivy();
  return (
    <nav className="hidden items-center gap-8 text-sm text-ink-muted md:flex">
      {ready && authenticated ? (
        <Link href="/agents" className={link}>
          Agents
        </Link>
      ) : null}
      <Link href="/categories" className={link}>
        Categories
      </Link>
      <Link href="/#how-it-works" className={link}>
        How it works
      </Link>
    </nav>
  );
}
