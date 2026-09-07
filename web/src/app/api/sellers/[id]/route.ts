import { and, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, jobs } from "@/db/schema";
import { publicSeller } from "@/lib/public-seller";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  const [row] = await db()
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.kind, "seller")))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  // Disputes the platform settled in the buyer's favour, a refund on a rated job.
  const upheld = await db()
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.sellerAgentId, id), eq(jobs.status, "refunded"), isNotNull(jobs.rating)));
  return NextResponse.json({ seller: publicSeller(row, { disputesUpheld: upheld.length }) });
}
