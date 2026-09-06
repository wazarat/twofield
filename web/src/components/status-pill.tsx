import type { AgentStatus } from "@/db/schema";
import { statusLabels } from "@/lib/agents";

const tone: Record<AgentStatus, string> = {
  draft: "border-line text-ink-muted",
  wallet_ready: "border-ink text-ink",
  registered: "border-ink bg-ink text-white",
};

export function StatusPill({ status }: { status: AgentStatus }) {
  return (
    <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide ${tone[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
