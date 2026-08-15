CREATE TABLE "customer_payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
	"provider" text NOT NULL,
	"provider_customer_id" text NOT NULL,
	"provider_payment_method_id" text NOT NULL,
	"brand" text,
	"last4" text,
	"exp_month" integer,
	"exp_year" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "customer_payment_methods_customer_id_idx" ON "customer_payment_methods" ("customer_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "customer_payment_methods_provider_pm_idx" ON "customer_payment_methods" ("provider","provider_payment_method_id");
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "payment_method_id" uuid REFERENCES "customer_payment_methods"("id") ON DELETE SET NULL;
