CREATE TYPE "public"."staff_role" AS ENUM('owner', 'admin', 'warehouse', 'support');
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"role" "staff_role" DEFAULT 'support' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_email_idx" ON "staff" ("email");
--> statement-breakpoint
CREATE INDEX "staff_role_idx" ON "staff" ("role");
--> statement-breakpoint
CREATE TABLE "product_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "product_attributes_product_id_idx" ON "product_attributes" ("product_id");
--> statement-breakpoint
CREATE TABLE "attribute_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attribute_id" uuid NOT NULL REFERENCES "product_attributes"("id") ON DELETE CASCADE,
	"value" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "attribute_values_attribute_id_idx" ON "attribute_values" ("attribute_id");
--> statement-breakpoint
CREATE TABLE "variant_attribute_values" (
	"variant_id" uuid NOT NULL REFERENCES "product_variants"("id") ON DELETE CASCADE,
	"attribute_value_id" uuid NOT NULL REFERENCES "attribute_values"("id") ON DELETE CASCADE,
	PRIMARY KEY ("variant_id", "attribute_value_id")
);
