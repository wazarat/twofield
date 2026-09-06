import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { appBaseUrl, registrationFile } from "@/lib/metadata";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public. This is the agent URI stored onchain, so anyone may read it.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const [agent] = await db().select().from(agents).where(eq(agents.id, id)).limit(1);
  if (!agent || agent.status === "draft") return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  return NextResponse.json(registrationFile(agent, appBaseUrl(request)), {
    headers: { "cache-control": "public, max-age=60" },
  });
}
