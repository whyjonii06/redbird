CREATE TABLE IF NOT EXISTS "stock_levels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE CASCADE,
  "available" integer NOT NULL DEFAULT 0,
  "reserved" integer NOT NULL DEFAULT 0,
  "committed" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_levels_variant_id_idx" ON "stock_levels" ("variant_id");
