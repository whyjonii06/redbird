ALTER TABLE "orders" ADD COLUMN "refunded_amount" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE "product_features" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "name" text NOT NULL,
  "value" text NOT NULL,
  "position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_features" ADD CONSTRAINT "product_features_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "product_features_product_id_idx" ON "product_features" ("product_id");
