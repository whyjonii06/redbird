CREATE TABLE "return_request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_request_id" uuid NOT NULL REFERENCES "return_requests"("id") ON DELETE CASCADE,
	"line_item_id" uuid NOT NULL REFERENCES "order_line_items"("id") ON DELETE CASCADE,
	"quantity" integer NOT NULL,
	"restock" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX "return_request_items_return_id_idx" ON "return_request_items" ("return_request_id");
