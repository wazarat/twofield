import { numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const agentStatuses = ["draft", "wallet_ready", "registered"] as const;
export type AgentStatus = (typeof agentStatuses)[number];

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  budgetPerJob: numeric("budget_per_job", { precision: 18, scale: 6 }).notNull(),
  status: text("status", { enum: agentStatuses }).notNull().default("draft"),
  walletId: text("wallet_id"),
  walletAddress: text("wallet_address"),
  onchainAgentId: text("onchain_agent_id"),
  registrationTx: text("registration_tx"),
  metadataUri: text("metadata_uri"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
