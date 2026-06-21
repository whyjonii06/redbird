ALTER TABLE "carts" ADD COLUMN "shipping_address" jsonb;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_address" jsonb;
