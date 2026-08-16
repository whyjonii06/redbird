CREATE TYPE "public"."register_session_status" AS ENUM('open', 'closed');
--> statement-breakpoint
CREATE TABLE "register_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE RESTRICT,
	"status" "register_session_status" DEFAULT 'open' NOT NULL,
	"opening_cash_amount" integer NOT NULL,
	"closing_cash_amount" integer,
	"notes" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "register_sessions_staff_id_idx" ON "register_sessions" ("staff_id");
--> statement-breakpoint
CREATE INDEX "register_sessions_status_idx" ON "register_sessions" ("status");
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "register_session_id" uuid REFERENCES "register_sessions"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "orders_register_session_id_idx" ON "orders" ("register_session_id");
