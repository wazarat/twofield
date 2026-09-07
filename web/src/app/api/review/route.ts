import { desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, jobs } from "@/db/schema";
import { requirePlatformOwner } from "@/lib/platform";
import { publicJob } from "@/lib/public-job";

export async function GET(request: Request) {
  const auth = await requirePlatformOwner(request);
  if (auth.response) return auth.response;
  const rows = await db()
    .select()
    .from(jobs)
    .where(inArray(jobs.status, ["submitted", "generating", "funded"]))
    .orderBy(desc(jobs.updatedAt));
  const ids = [...new Set(rows.flatMap((r) => [r.buyerAgentId, r.sellerAgentId]))];
  const people = ids.length ? await db().select().from(agents).where(inArray(agents.id, ids)) : [];
  const byId = new Map(people.map((a) => [a.id, a]));
  return NextResponse.json({ jobs: rows.map((r) => publicJob(r, byId.get(r.buyerAgentId), byId.get(r.sellerAgentId))) });
}

export const dynamic = "force-dynamic";
