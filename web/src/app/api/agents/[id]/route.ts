import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const [row] = await db()
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.ownerId, auth.userId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ agent: row });
}
