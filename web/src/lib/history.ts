import type { JobStatus } from "@/db/schema";

// One row on the account's history page, a job or a paid preview.
export type HistoryItem = {
  kind: "job" | "preview";
  id: string;
  createdAt: string;
  agent: { id: string; name: string; ownerUsername: string | null };
  seller: { id: string; name: string };
  amountUsdc: string;
  status: JobStatus | "paid";
  tx: string | null;
  href: string;
  brief: string;
  pitch?: string;
  hasDeliverable?: boolean;
};

export const jobStatusLabel: Record<JobStatus, string> = {
  pending: "Opening",
  created: "Created onchain",
  budgeted: "Price set",
  funded: "Funded",
  generating: "Specialist working",
  submitted: "Awaiting review",
  approved: "Approved, specialist paid",
  rejected: "Rejected",
  refunded: "Rejected, buyer refunded",
  failed: "Failed",
};

export function historyStatusLabel(item: HistoryItem) {
  return item.status === "paid" ? "Paid over x402" : jobStatusLabel[item.status];
}
