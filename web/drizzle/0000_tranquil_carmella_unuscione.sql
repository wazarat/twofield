CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"budget_per_job" numeric(18, 6) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"wallet_id" text,
	"wallet_address" text,
	"onchain_agent_id" text,
	"registration_tx" text,
	"metadata_uri" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
