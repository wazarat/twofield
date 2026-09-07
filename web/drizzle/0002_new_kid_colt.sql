ALTER TABLE "agents" ADD COLUMN "kind" text DEFAULT 'buyer' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "category_slug" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "price_usdc" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "persona" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "attested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "attestation_tx" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "validation_request_hash" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "reputation_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "reputation_score" numeric(8, 2);