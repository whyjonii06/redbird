CREATE TYPE "public"."subscription_interval" AS ENUM('weekly', 'monthly', 'yearly');
--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'paused', 'cancelled');
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
	"variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE CASCADE,
	"quantity" integer DEFAULT 1 NOT NULL,
	"interval" "subscription_interval" NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"next_renewal_at" timestamp with time zone NOT NULL,
	"last_reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "subscriptions_customer_id_idx" ON "subscriptions" ("customer_id");
--> statement-breakpoint
CREATE INDEX "subscriptions_next_renewal_idx" ON "subscriptions" ("next_renewal_at");
