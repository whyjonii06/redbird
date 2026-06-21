CREATE TABLE IF NOT EXISTS "product_translations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "locale" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_translations_product_locale_idx" ON "product_translations" ("product_id", "locale");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_translations_locale_idx" ON "product_translations" ("locale");
