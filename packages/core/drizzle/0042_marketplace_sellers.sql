CREATE TYPE "public"."seller_status" AS ENUM('pending', 'active', 'suspended');
--> statement-breakpoint
CREATE TYPE "public"."earning_status" AS ENUM('pending', 'available', 'paid_out');
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"store_name" text NOT NULL,
	"contact_email" text,
	"status" "seller_status" DEFAULT 'pending' NOT NULL,
	"commission_rate_bp" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sellers_email_idx" ON "sellers" ("email");
--> statement-breakpoint
CREATE TABLE "seller_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL REFERENCES "sellers"("id") ON DELETE RESTRICT,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_earnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL REFERENCES "sellers"("id") ON DELETE RESTRICT,
	"order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
	"gross_amount" integer NOT NULL,
	"commission_amount" integer NOT NULL,
	"net_amount" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "earning_status" DEFAULT 'available' NOT NULL,
	"payout_id" uuid REFERENCES "seller_payouts"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "seller_earnings_seller_order_idx" ON "seller_earnings" ("seller_id","order_id");
--> statement-breakpoint
CREATE INDEX "seller_earnings_seller_id_idx" ON "seller_earnings" ("seller_id");
--> statement-breakpoint
CREATE INDEX "seller_earnings_status_idx" ON "seller_earnings" ("status");
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "seller_id" uuid REFERENCES "sellers"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "products_seller_id_idx" ON "products" ("seller_id");
--> statement-breakpoint
ALTER TABLE "order_line_items" ADD COLUMN "seller_id" uuid REFERENCES "sellers"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "order_line_items_seller_id_idx" ON "order_line_items" ("seller_id");
