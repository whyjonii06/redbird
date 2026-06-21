ALTER TABLE "products" ADD COLUMN "meta_title" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "meta_description" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_url" text;--> statement-breakpoint
CREATE TABLE "cms_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL DEFAULT '',
	"excerpt" text,
	"published" boolean NOT NULL DEFAULT false,
	"position" integer NOT NULL DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "cms_pages_slug_idx" ON "cms_pages" USING btree ("slug");
