ALTER TABLE "customers" ADD COLUMN "marketing_opt_in" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "unsubscribe_token" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "customers_unsubscribe_token_idx" ON "customers" ("unsubscribe_token");
--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'sending', 'sent');
--> statement-breakpoint
CREATE TYPE "public"."campaign_recipient_status" AS ENUM('pending', 'sent', 'failed');
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"audience_group_id" uuid REFERENCES "customer_groups"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
	"customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
	"email" text NOT NULL,
	"status" "campaign_recipient_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_recipients_campaign_customer_idx" ON "campaign_recipients" ("campaign_id","customer_id");
--> statement-breakpoint
CREATE INDEX "campaign_recipients_campaign_id_idx" ON "campaign_recipients" ("campaign_id");
