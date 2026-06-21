CREATE TABLE IF NOT EXISTS "store_settings" (
  "key" text PRIMARY KEY,
  "value" jsonb NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
