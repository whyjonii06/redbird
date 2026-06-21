CREATE TABLE IF NOT EXISTS "brands" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "logo_url" text,
  "website_url" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "brands_slug_idx" ON "brands" ("slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "contact_email" text,
  "contact_phone" text,
  "address" text,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_suppliers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "supplier_id" uuid NOT NULL REFERENCES "suppliers"("id") ON DELETE CASCADE,
  "supplier_sku" text,
  "cost_price" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_suppliers_unique_idx" ON "product_suppliers" ("product_id", "supplier_id");
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brand_id" uuid REFERENCES "brands"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_brand_id_idx" ON "products" ("brand_id");
