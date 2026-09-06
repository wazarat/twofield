ALTER TABLE "agents" ADD COLUMN "max_budget_per_job" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "max_jobs" integer;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "max_total_budget" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "policy_id" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "funding_tx" text;--> statement-breakpoint
UPDATE "agents" SET "max_budget_per_job" = "budget_per_job", "max_total_budget" = "budget_per_job", "max_jobs" = 1;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "max_budget_per_job" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "max_jobs" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "max_total_budget" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "budget_per_job";
