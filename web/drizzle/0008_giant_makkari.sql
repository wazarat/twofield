CREATE TABLE "previews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"buyer_agent_id" uuid NOT NULL,
	"seller_agent_id" uuid NOT NULL,
	"brief" text NOT NULL,
	"pitch" text NOT NULL,
	"amount_usdc" numeric(18, 6) NOT NULL,
	"payment_tx" text,
	"payer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "previews" ADD CONSTRAINT "previews_buyer_agent_id_agents_id_fk" FOREIGN KEY ("buyer_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "previews" ADD CONSTRAINT "previews_seller_agent_id_agents_id_fk" FOREIGN KEY ("seller_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;