CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promo_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "type" "public"."discount_type" NOT NULL,
  "value" integer NOT NULL,
  "currency" text,
  "minimum_amount" integer,
  "max_uses" integer,
  "used_count" integer NOT NULL DEFAULT 0,
  "expires_at" timestamptz,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_idx" ON "promo_codes" ("code");
