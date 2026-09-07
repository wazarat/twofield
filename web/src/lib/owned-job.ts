import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, jobs } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { loadJobFiles } from "@/lib/jobs";
import { getUser } from "@/lib/users";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadOwnedJob(request: Request, id: string) {
  const auth = await requireUser(request);
  if (auth.response) return { response: auth.response };
  if (!uuidPattern.test(id)) return { response: NextResponse.json({ error: "Job not found" }, { status: 404 }) };
  const [job] = await db()
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.ownerId, auth.userId)))
    .limit(1);
  if (!job) return { response: NextResponse.json({ error: "Job not found" }, { status: 404 }) };
  const [buyer] = await db().select().from(agents).where(eq(agents.id, job.buyerAgentId)).limit(1);
  const [seller] = await db().select().from(agents).where(eq(agents.id, job.sellerAgentId)).limit(1);
  const [files, owner] = await Promise.all([loadJobFiles(job.id), getUser(auth.userId)]);
  return { job, buyer, seller, files, owner, userId: auth.userId };
}
