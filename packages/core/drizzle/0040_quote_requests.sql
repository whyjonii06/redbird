CREATE TYPE "public"."quote_status" AS ENUM('pending', 'quoted', 'accepted', 'rejected', 'expired');
--> statement-breakpoint
CREATE TABLE "quote_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
	"status" "quote_status" DEFAULT 'pending' NOT NULL,
	"currency" text NOT NULL,
	"customer_note" text,
	"staff_note" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "quote_requests_customer_id_idx" ON "quote_requests" ("customer_id");
--> statement-breakpoint
CREATE INDEX "quote_requests_status_idx" ON "quote_requests" ("status");
--> statement-breakpoint
CREATE TABLE "quote_request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_request_id" uuid NOT NULL REFERENCES "quote_requests"("id") ON DELETE CASCADE,
	"variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE CASCADE,
	"quantity" integer NOT NULL,
	"quoted_price_amount" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "quote_request_items_quote_id_idx" ON "quote_request_items" ("quote_request_id");
