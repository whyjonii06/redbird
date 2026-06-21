CREATE TABLE IF NOT EXISTS "customer_addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "label" text NOT NULL DEFAULT 'home',
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "line1" text NOT NULL,
  "line2" text,
  "city" text NOT NULL,
  "postal_code" text NOT NULL,
  "country_code" text NOT NULL,
  "phone" text,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_addresses_customer_id_idx" ON "customer_addresses" ("customer_id");
