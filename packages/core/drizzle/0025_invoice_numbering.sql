ALTER TABLE "orders" ADD COLUMN "invoice_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "invoiced_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_invoice_number_idx" ON "orders" USING btree ("invoice_number");--> statement-breakpoint
CREATE TABLE "counters" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
