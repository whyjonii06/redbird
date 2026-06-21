CREATE TABLE IF NOT EXISTS "theme_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "theme" text NOT NULL,
  "section_type" text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "config" jsonb NOT NULL DEFAULT '{}',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "theme_sections_theme_idx" ON "theme_sections" ("theme");
