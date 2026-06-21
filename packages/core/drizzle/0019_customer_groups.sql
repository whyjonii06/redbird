CREATE TABLE "customer_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "customer_groups_name_idx" ON "customer_groups" ("name");
--> statement-breakpoint
CREATE TABLE "customer_group_members" (
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "group_id" uuid NOT NULL REFERENCES "customer_groups"("id") ON DELETE CASCADE,
  PRIMARY KEY ("customer_id", "group_id")
);
--> statement-breakpoint
CREATE INDEX "customer_group_members_group_id_idx" ON "customer_group_members" ("group_id");
--> statement-breakpoint
CREATE TABLE "group_price_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL REFERENCES "customer_groups"("id") ON DELETE CASCADE,
  "variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE CASCADE,
  "price_amount" integer NOT NULL,
  "price_currency" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "group_price_rules_group_variant_idx" ON "group_price_rules" ("group_id", "variant_id");
--> statement-breakpoint
CREATE INDEX "group_price_rules_group_id_idx" ON "group_price_rules" ("group_id");
--> statement-breakpoint
CREATE INDEX "group_price_rules_variant_id_idx" ON "group_price_rules" ("variant_id");
