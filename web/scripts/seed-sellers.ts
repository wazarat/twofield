import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { PLATFORM_OWNER, agents } from "@/db/schema";
import { registerAgent } from "@/lib/identity";
import { SELLER_CATEGORY, sellerSeeds } from "@/lib/sellers";
import { createAgentWallet } from "@/lib/wallets";

// Seeds the ten demo sellers. Safe to rerun, it only completes what is missing.
const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://twofielddev.vercel.app";

console.log("");
console.log(`Seeding ${sellerSeeds.length} sellers. Agent URIs use ${base}`);
console.log("");

for (const seed of sellerSeeds) {
  let [row] = await db()
    .select()
    .from(agents)
    .where(and(eq(agents.kind, "seller"), eq(agents.name, seed.name)))
    .limit(1);

  if (!row) {
    [row] = await db()
      .insert(agents)
      .values({
        ownerId: PLATFORM_OWNER,
        kind: "seller",
        name: seed.name,
        description: seed.tagline,
        tagline: seed.tagline,
        persona: seed.persona,
        categorySlug: SELLER_CATEGORY,
        priceUsdc: seed.priceUsdc,
        maxBudgetPerJob: "0",
        maxJobs: 0,
        maxTotalBudget: "0",
      })
      .returning();
    console.log(`created   ${seed.name}`);
  }

  if (row.status === "draft") {
    row = await createAgentWallet(row);
    console.log(`wallet    ${seed.name} ${row.walletAddress}`);
  }
  if (row.status === "wallet_ready") {
    row = await registerAgent(row, base);
    console.log(`identity  ${seed.name} ERC-8004 id ${row.onchainAgentId}`);
  }
  console.log(`ready     ${seed.name} ${seed.priceUsdc} USDC ${row.walletAddress} id ${row.onchainAgentId}`);
  console.log("");
}

console.log("Done.");
