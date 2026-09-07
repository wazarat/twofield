import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, jobs, previews } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import type { HistoryItem } from "@/lib/history";
import { getUser } from "@/lib/users";

export const dynamic = "force-dynamic";

// Every job and paid preview on the account, newest first. Pass agent=<id> for one agent.
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const agentId = new URL(request.url).searchParams.get("agent");
  const jobWhere = agentId ? and(eq(jobs.ownerId, auth.userId), eq(jobs.buyerAgentId, agentId)) : eq(jobs.ownerId, auth.userId);
  const previewWhere = agentId ? and(eq(previews.ownerId, auth.userId), eq(previews.buyerAgentId, agentId)) : eq(previews.ownerId, auth.userId);

  const [jobRows, previewRows, owner] = await Promise.all([
    db().select().from(jobs).where(jobWhere).orderBy(desc(jobs.createdAt)),
    db().select().from(previews).where(previewWhere).orderBy(desc(previews.createdAt)),
    getUser(auth.userId),
  ]);
  const ids = [...new Set([...jobRows, ...previewRows].flatMap((r) => [r.buyerAgentId, r.sellerAgentId]))];
  const people = ids.length ? await db().select().from(agents).where(inArray(agents.id, ids)) : [];
  const byId = new Map(people.map((a) => [a.id, a]));
  const username = owner?.username ?? null;
  const name = (id: string) => byId.get(id)?.name ?? "Unknown";

  const items: HistoryItem[] = [
    ...jobRows.map<HistoryItem>((j) => ({
      kind: "job",
      id: j.id,
      createdAt: j.createdAt.toISOString(),
      agent: { id: j.buyerAgentId, name: name(j.buyerAgentId), ownerUsername: username },
      seller: { id: j.sellerAgentId, name: name(j.sellerAgentId) },
      amountUsdc: j.priceUsdc,
      status: j.status,
      tx: j.settleTx ?? j.refundTx ?? j.fundTx ?? j.createTx,
      href: `/jobs/${j.id}`,
      brief: j.brief,
      hasDeliverable: Boolean(j.deliverable),
    })),
    ...previewRows.map<HistoryItem>((p) => ({
      kind: "preview",
      id: p.id,
      createdAt: p.createdAt.toISOString(),
      agent: { id: p.buyerAgentId, name: name(p.buyerAgentId), ownerUsername: username },
      seller: { id: p.sellerAgentId, name: name(p.sellerAgentId) },
      amountUsdc: p.amountUsdc,
      status: "paid",
      tx: p.paymentTx,
      href: `/sellers/${p.sellerAgentId}`,
      brief: p.brief,
      pitch: p.pitch,
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return NextResponse.json({ items });
}
