CREATE TABLE IF NOT EXISTS "loyalty_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "balance" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_accounts_customer_id_idx" ON "loyalty_accounts" ("customer_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "type" text NOT NULL,
  "points" integer NOT NULL,
  "description" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_transactions_account_id_idx" ON "loyalty_transactions" ("account_id");
