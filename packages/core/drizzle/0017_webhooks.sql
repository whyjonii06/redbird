CREATE TYPE "webhook_delivery_status" AS ENUM ('pending', 'success', 'failed');
--> statement-breakpoint
CREATE TABLE "webhooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "url" text NOT NULL,
  "secret" text NOT NULL,
  "events" text[] NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "webhooks_active_idx" ON "webhooks" ("active");
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "webhook_id" uuid NOT NULL,
  "event" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "response_status" integer,
  "response_body" text,
  "error" text,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk"
  FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhook_id_idx" ON "webhook_deliveries" ("webhook_id");
--> statement-breakpoint
CREATE INDEX "webhook_deliveries_event_idx" ON "webhook_deliveries" ("event");
--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_idx" ON "webhook_deliveries" ("status");
