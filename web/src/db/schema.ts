import { integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const agentStatuses = ["draft", "wallet_ready", "registered"] as const;
export type AgentStatus = (typeof agentStatuses)[number];

export const agentKinds = ["buyer", "seller"] as const;
export type AgentKind = (typeof agentKinds)[number];

export const PLATFORM_OWNER = "platform";

// One row per signed in account, keyed by the Privy DID. The username is public.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;

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
  policyVersion: integer("policy_version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

export const jobStatuses = [
  "pending",
  "created",
  "budgeted",
  "funded",
  "generating",
  "submitted",
  "approved",
  "rejected",
  "refunded",
  "failed",
] as const;
export type JobStatus = (typeof jobStatuses)[number];

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  buyerAgentId: uuid("buyer_agent_id")
    .notNull()
    .references(() => agents.id),
  sellerAgentId: uuid("seller_agent_id")
    .notNull()
    .references(() => agents.id),
  brief: text("brief").notNull(),
  priceUsdc: numeric("price_usdc", { precision: 18, scale: 6 }).notNull(),
  status: text("status", { enum: jobStatuses }).notNull().default("pending"),
  lastError: text("last_error"),
  onchainJobId: text("onchain_job_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createTx: text("create_tx"),
  budgetTx: text("budget_tx"),
  approveTx: text("approve_tx"),
  fundTx: text("fund_tx"),
  submitTx: text("submit_tx"),
  settleTx: text("settle_tx"),
  refundTx: text("refund_tx"),
  feedbackTx: text("feedback_tx"),
  deliverable: text("deliverable"),
  deliverableHash: text("deliverable_hash"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
