ALTER TABLE "customers" ADD COLUMN "reset_token" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "reset_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_amount" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "promo_code" text;
