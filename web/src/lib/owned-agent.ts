import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Authenticates the request and loads the agent only if the caller owns it.
export async function loadOwnedAgent(request: Request, id: string) {
  const auth = await requireUser(request);
  if (auth.response) return { response: auth.response };
  if (!uuidPattern.test(id)) return { response: NextResponse.json({ error: "Agent not found" }, { status: 404 }) };

  const [agent] = await db()
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.ownerId, auth.userId)))
    .limit(1);

  if (!agent) return { response: NextResponse.json({ error: "Agent not found" }, { status: 404 }) };
  return { agent };
}
