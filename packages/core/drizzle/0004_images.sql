CREATE TABLE IF NOT EXISTS "product_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "variant_id" uuid REFERENCES "product_variants"("id") ON DELETE SET NULL,
  "url" text NOT NULL,
  "alt" text,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_images_product_id_idx" ON "product_images" ("product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_images_variant_id_idx" ON "product_images" ("variant_id");
