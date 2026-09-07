CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"buyer_agent_id" uuid NOT NULL,
	"seller_agent_id" uuid NOT NULL,
	"brief" text NOT NULL,
	"price_usdc" numeric(18, 6) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"onchain_job_id" text,
	"expires_at" timestamp with time zone,
	"create_tx" text,
	"budget_tx" text,
	"approve_tx" text,
	"fund_tx" text,
	"submit_tx" text,
	"settle_tx" text,
	"refund_tx" text,
	"feedback_tx" text,
	"deliverable" text,
	"deliverable_hash" text,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "policy_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_buyer_agent_id_agents_id_fk" FOREIGN KEY ("buyer_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_seller_agent_id_agents_id_fk" FOREIGN KEY ("seller_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;