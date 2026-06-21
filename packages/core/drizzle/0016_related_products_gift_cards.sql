CREATE TYPE "product_relation_type" AS ENUM ('related', 'upsell', 'cross_sell');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_relations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "related_product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "type" "product_relation_type" NOT NULL DEFAULT 'related',
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_relations_unique_idx" ON "product_relations" ("product_id", "related_product_id", "type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_relations_product_id_idx" ON "product_relations" ("product_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gift_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "initial_balance" integer NOT NULL,
  "balance" integer NOT NULL,
  "currency" text NOT NULL,
  "issued_to_email" text,
  "order_id" uuid,
  "expires_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gift_cards_code_idx" ON "gift_cards" ("code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gift_card_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gift_card_id" uuid NOT NULL REFERENCES "gift_cards"("id") ON DELETE CASCADE,
  "order_id" uuid,
  "amount" integer NOT NULL,
  "description" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gift_card_transactions_gift_card_id_idx" ON "gift_card_transactions" ("gift_card_id");
