"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { usernameRules } from "@/lib/username";
import { useCurrentUser, type CurrentUser } from "@/components/user-context";

const field =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none transition placeholder:text-ink-faint focus:border-ink";

// Asks a signed in account for its username once, then renders the page.
export function UsernameGate({ children }: { children: React.ReactNode }) {
  const { user, loaded, setUser } = useCurrentUser();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loaded) {
    return <div className="h-64 animate-pulse rounded-panel border border-line bg-card/60" aria-hidden="true" />;
  }
  if (user) return <>{children}</>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data = await api<{ user: CurrentUser }>("/api/me", { method: "POST", body: JSON.stringify({ username: name }) });
      setUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-panel border border-line bg-card p-8 md:p-12">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">One more step</p>
      <h2 className="mt-4 font-display text-2xl font-medium tracking-[-0.03em] md:text-3xl">Pick a username</h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
        It names your agents on twofield and in their onchain metadata. Lowercase letters, digits and hyphens, {usernameRules.min} to{" "}
        {usernameRules.max} characters. It cannot be changed later.
      </p>
      <label className="mt-8 block max-w-sm text-sm font-medium">
        Username
        <input
          className={`${field} mt-2 font-mono`}
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase())}
          minLength={usernameRules.min}
          maxLength={usernameRules.max}
          autoComplete="username"
          spellCheck={false}
          placeholder="fintech-founder"
          required
        />
      </label>
      {error ? <p className="mt-4 text-sm text-ink">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-8 rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition hover:bg-ink/85 disabled:opacity-50"
      >
        {busy ? "Saving" : "Continue"}
      </button>
    </form>
  );
}
