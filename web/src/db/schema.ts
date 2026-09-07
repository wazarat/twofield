import { integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const agentStatuses = ["draft", "wallet_ready", "registered"] as const;
export type AgentStatus = (typeof agentStatuses)[number];

export const agentKinds = ["buyer", "seller"] as const;
export type AgentKind = (typeof agentKinds)[number];

export const PLATFORM_OWNER = "platform";

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  kind: text("kind", { enum: agentKinds }).notNull().default("buyer"),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  maxBudgetPerJob: numeric("max_budget_per_job", { precision: 18, scale: 6 }).notNull(),
  maxJobs: integer("max_jobs").notNull(),
  maxTotalBudget: numeric("max_total_budget", { precision: 18, scale: 6 }).notNull(),
  status: text("status", { enum: agentStatuses }).notNull().default("draft"),
  policyId: text("policy_id"),
  walletId: text("wallet_id"),
  walletAddress: text("wallet_address"),
  fundingTx: text("funding_tx"),
  onchainAgentId: text("onchain_agent_id"),
  registrationTx: text("registration_tx"),
  metadataUri: text("metadata_uri"),
  categorySlug: text("category_slug"),
  priceUsdc: numeric("price_usdc", { precision: 18, scale: 6 }),
  tagline: text("tagline"),
  persona: text("persona"),
  attestedAt: timestamp("attested_at", { withTimezone: true }),
  attestationTx: text("attestation_tx"),
  validationRequestHash: text("validation_request_hash"),
  reputationCount: integer("reputation_count").notNull().default(0),
  reputationScore: numeric("reputation_score", { precision: 8, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
