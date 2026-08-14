CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_code_idx" ON "warehouses" ("code");
--> statement-breakpoint
CREATE TABLE "warehouse_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE CASCADE,
	"variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE CASCADE,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_stock_warehouse_variant_idx" ON "warehouse_stock" ("warehouse_id","variant_id");
--> statement-breakpoint
CREATE INDEX "warehouse_stock_variant_id_idx" ON "warehouse_stock" ("variant_id");
