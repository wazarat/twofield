import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { validateAgentInput } from "@/lib/agents";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const rows = await db().select().from(agents).where(eq(agents.ownerId, auth.userId)).orderBy(desc(agents.createdAt));
  return NextResponse.json({ agents: rows });
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = validateAgentInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const [row] = await db()
    .insert(agents)
    .values({
      ownerId: auth.userId,
      name: parsed.value.name,
      description: parsed.value.description,
      maxBudgetPerJob: parsed.value.maxBudgetPerJob.toString(),
      maxJobs: parsed.value.maxJobs,
      maxTotalBudget: parsed.value.maxTotalBudget.toString(),
    })
    .returning();

  return NextResponse.json({ agent: row }, { status: 201 });
}
