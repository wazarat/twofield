import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { publicSeller } from "@/lib/public-seller";

// Public. Sellers are platform owned and listed to everyone.
export async function GET(request: Request) {
  const category = new URL(request.url).searchParams.get("category");
  const where = category
    ? and(eq(agents.kind, "seller"), eq(agents.categorySlug, category))
    : eq(agents.kind, "seller");
  const rows = await db().select().from(agents).where(where).orderBy(asc(agents.priceUsdc), asc(agents.name));
  return NextResponse.json({ sellers: rows.map((row) => publicSeller(row)) });
}
