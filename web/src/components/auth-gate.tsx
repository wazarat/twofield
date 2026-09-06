"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-panel border border-line bg-card/60" aria-hidden="true" />;
  }

  if (!authenticated) {
    return (
      <div className="rounded-panel border border-line bg-card p-8 md:p-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Members only</p>
        <h2 className="mt-4 font-display text-2xl font-medium tracking-[-0.03em] md:text-3xl">
          Sign in to browse specialists
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
          Email or Google is all it takes. No wallet setup, no gas, no seed phrase.
        </p>
        <button
          type="button"
          onClick={() => login()}
          className="mt-8 rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition hover:bg-ink/85"
        >
          Sign in
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
