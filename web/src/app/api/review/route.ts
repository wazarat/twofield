import { and, desc, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, jobFiles, jobs, users } from "@/db/schema";
import { requirePlatformOwner } from "@/lib/platform";
import { publicJob } from "@/lib/public-job";

export async function GET(request: Request) {
  const auth = await requirePlatformOwner(request);
  if (auth.response) return auth.response;
  const rows = await db()
    .select()
    .from(jobs)
    // Open disputes and stuck jobs, plus settled disputes whose verdict is not on chain yet.
    .where(
      or(
        inArray(jobs.status, ["disputed", "generating", "funded"]),
        and(isNotNull(jobs.rating), inArray(jobs.status, ["approved", "refunded"]), isNull(jobs.validationTx)),
      ),
    )
    .orderBy(desc(jobs.updatedAt));
  const ids = [...new Set(rows.flatMap((r) => [r.buyerAgentId, r.sellerAgentId]))];
  const people = ids.length ? await db().select().from(agents).where(inArray(agents.id, ids)) : [];
  const byId = new Map(people.map((a) => [a.id, a]));
  const ownerIds = [...new Set(rows.map((r) => r.ownerId))];
  const owners = ownerIds.length ? await db().select().from(users).where(inArray(users.id, ownerIds)) : [];
  const ownerById = new Map(owners.map((u) => [u.id, u]));
  const jobIds = rows.map((r) => r.id);
  const files = jobIds.length ? await db().select().from(jobFiles).where(inArray(jobFiles.jobId, jobIds)) : [];
  return NextResponse.json({
    jobs: rows.map((r) =>
      publicJob(r, byId.get(r.buyerAgentId), byId.get(r.sellerAgentId), files.filter((f) => f.jobId === r.id), ownerById.get(r.ownerId)),
    ),
  });
}

export const dynamic = "force-dynamic";
