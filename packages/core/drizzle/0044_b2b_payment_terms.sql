ALTER TABLE "customer_groups" ADD COLUMN "payment_terms_days" integer;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "po_number" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "due_date" timestamp with time zone;
