import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { refreshReputation } from "@/lib/reputation";

// Recomputes every seller's cached score from the registry under the current tags.
// Run once after the rating scale changes, safe to run again any time.
const sellers = await db().select().from(agents).where(eq(agents.kind, "seller"));
console.log("");
for (const seller of sellers) {
  const row = await refreshReputation(seller);
  console.log(`${row.name.padEnd(28)} ${row.reputationCount} ratings ${row.reputationScore ? `${Number(row.reputationScore).toFixed(1)} of 5` : "no score"}`);
}
console.log("");
