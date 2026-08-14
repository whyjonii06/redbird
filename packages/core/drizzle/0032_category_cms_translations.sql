CREATE TABLE "category_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "category_translations_category_locale_idx" ON "category_translations" ("category_id","locale");
--> statement-breakpoint
CREATE INDEX "category_translations_locale_idx" ON "category_translations" ("locale");
--> statement-breakpoint
CREATE TABLE "cms_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL REFERENCES "cms_pages"("id") ON DELETE CASCADE,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"content" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cms_translations_page_locale_idx" ON "cms_translations" ("page_id","locale");
--> statement-breakpoint
CREATE INDEX "cms_translations_locale_idx" ON "cms_translations" ("locale");
