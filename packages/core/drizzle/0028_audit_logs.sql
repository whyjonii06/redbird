CREATE TYPE "public"."audit_actor_type" AS ENUM('admin', 'staff', 'system');
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_id" uuid,
	"actor_label" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" ("created_at");
--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" ("entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" ("action");
