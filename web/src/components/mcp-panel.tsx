"use client";

import { useState } from "react";
import type { Agent } from "@/db/schema";
import { api } from "@/lib/api";

type Credential = { id: string; token: string; expiresAt: string; scopes: string[] };

function endpoint() {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/api/mcp`;
}

function snippet(token: string) {
  return JSON.stringify(
    { mcpServers: { twofield: { type: "http", url: endpoint(), headers: { Authorization: `Bearer ${token}` } } } },
    null,
    2,
  );
}

// Lets an external agent host act as this agent through MCP.
export function McpPanel({ agent }: { agent: Agent }) {
  const [credential, setCredential] = useState<Credential | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState<number | null>(null);
  const [copied, setCopied] = useState<"token" | "snippet" | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    setRevoked(null);
    try {
      const data = await api<{ credential: Credential }>(`/api/agents/${agent.id}/mcp-token`, { method: "POST" });
      setCredential(data.credential);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ revoked: number }>(`/api/agents/${agent.id}/mcp-token`, { method: "DELETE" });
      setRevoked(data.revoked);
      setCredential(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function copy(kind: "token" | "snippet", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Copy failed, select the text and copy it by hand");
    }
  }

  const expires = credential ? new Date(credential.expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null;

  return (
    <div className="rounded-panel border border-line bg-card p-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">Connect an MCP client</p>
      <h2 className="mt-3 font-display text-2xl font-medium tracking-[-0.03em]">Let Claude Code or Cursor act as this agent</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Create a token, paste the snippet into your MCP client, and it can browse specialists and read this agent&apos;s jobs. Tokens last 30 days and are shown once.
      </p>

      {credential ? (
        <div className="mt-6 flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">Token, expires {expires}</span>
              <button type="button" onClick={() => copy("token", credential.token)} className="font-mono text-xs text-ink underline-offset-4 hover:underline">
                {copied === "token" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-bg px-4 py-3 font-mono text-xs">{credential.token}</pre>
          </div>
          <div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">Client config</span>
              <button type="button" onClick={() => copy("snippet", snippet(credential.token))} className="font-mono text-xs text-ink underline-offset-4 hover:underline">
                {copied === "snippet" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-bg px-4 py-3 font-mono text-xs leading-relaxed">{snippet(credential.token)}</pre>
            <p className="mt-2 font-mono text-[11px] text-ink-faint">Claude Code reads this from .mcp.json in a project. Cursor reads it from .cursor/mcp.json.</p>
          </div>
        </div>
      ) : null}

      {revoked !== null ? (
        <p className="mt-4 text-sm text-ink-muted">{revoked === 0 ? "No active tokens to revoke." : `Revoked ${revoked} ${revoked === 1 ? "token" : "tokens"}. Connected clients are cut off.`}</p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-ink">{error}</p> : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={create} disabled={busy} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-ink/85 disabled:opacity-50">
          {busy ? "Working" : credential ? "Create another token" : "Create token"}
        </button>
        <button type="button" onClick={revoke} disabled={busy} className="rounded-full border border-ink px-5 py-2 text-sm font-medium transition hover:bg-ink hover:text-white disabled:opacity-50">
          Revoke tokens
        </button>
      </div>
      <p className="mt-3 font-mono text-[11px] text-ink-faint">Revoking cuts every client connected as this agent.</p>
    </div>
  );
}
