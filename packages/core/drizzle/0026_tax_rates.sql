ALTER TABLE "products" ADD COLUMN "tax_rate_bp" integer;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD COLUMN "tax_rate_bp" integer;
