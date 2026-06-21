CREATE TABLE IF NOT EXISTS "product_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL,
  "customer_name" text NOT NULL,
  "rating" integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  "comment" text,
  "approved" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_reviews_product_id_idx" ON "product_reviews" ("product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_reviews_approved_idx" ON "product_reviews" ("approved");
--> statement-breakpoint
CREATE TYPE "return_status" AS ENUM ('pending', 'approved', 'rejected');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "return_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "reason" text NOT NULL,
  "status" "return_status" NOT NULL DEFAULT 'pending',
  "admin_note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "return_requests_order_id_idx" ON "return_requests" ("order_id");
