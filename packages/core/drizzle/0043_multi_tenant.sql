CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended');
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"status" "tenant_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_idx" ON "tenants" ("slug");
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "customers_tenant_id_idx" ON "customers" ("tenant_id");
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "products_tenant_id_idx" ON "products" ("tenant_id");
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "categories_tenant_id_idx" ON "categories" ("tenant_id");
--> statement-breakpoint
ALTER TABLE "carts" ADD COLUMN "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "carts_tenant_id_idx" ON "carts" ("tenant_id");
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "orders_tenant_id_idx" ON "orders" ("tenant_id");
