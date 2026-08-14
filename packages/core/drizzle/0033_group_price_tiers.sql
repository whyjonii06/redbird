ALTER TABLE "group_price_rules" ADD COLUMN "min_quantity" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
DROP INDEX IF EXISTS "group_price_rules_group_variant_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "group_price_rules_group_variant_qty_idx" ON "group_price_rules" ("group_id","variant_id","min_quantity");
