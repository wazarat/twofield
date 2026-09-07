ALTER TABLE "agents" ADD COLUMN "jobs_period" text DEFAULT 'week' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "top_up_tx" text;