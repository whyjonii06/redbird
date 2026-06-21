ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_virtual" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_downloads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "filename" text NOT NULL,
  "url" text NOT NULL,
  "file_size" integer,
  "mime_type" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_downloads_product_id_idx" ON "product_downloads" ("product_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "download_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token" uuid NOT NULL,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "product_download_id" uuid NOT NULL REFERENCES "product_downloads"("id") ON DELETE CASCADE,
  "download_count" integer NOT NULL DEFAULT 0,
  "max_downloads" integer NOT NULL DEFAULT 5,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "download_tokens_token_idx" ON "download_tokens" ("token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "download_tokens_order_id_idx" ON "download_tokens" ("order_id");
