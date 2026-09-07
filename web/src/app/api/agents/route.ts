import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { validateAgentInput } from "@/lib/agents";
import { assertNameFree } from "@/lib/agent-updates";
import { AppError } from "@/lib/errors";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  // Archived agents are hidden unless asked for, so hire and preview pickers never list them.
  const archived = new URL(request.url).searchParams.get("archived") === "1";
  const rows = await db()
    .select()
    .from(agents)
    .where(and(eq(agents.ownerId, auth.userId), eq(agents.kind, "buyer"), archived ? isNotNull(agents.archivedAt) : isNull(agents.archivedAt)))
    .orderBy(desc(agents.createdAt));
  return NextResponse.json({ agents: rows });
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = validateAgentInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    await assertNameFree(auth.userId, parsed.value.name);
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const [row] = await db()
    .insert(agents)
    .values({
      ownerId: auth.userId,
      name: parsed.value.name,
      description: parsed.value.description,
      maxBudgetPerJob: parsed.value.maxBudgetPerJob.toString(),
      maxJobs: parsed.value.maxJobs,
      jobsPeriod: parsed.value.jobsPeriod,
      maxTotalBudget: parsed.value.maxTotalBudget.toString(),
    })
    .returning();

  return NextResponse.json({ agent: row }, { status: 201 });
}
