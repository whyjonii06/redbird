ALTER TYPE "public"."discount_type" ADD VALUE 'bogo';--> statement-breakpoint
ALTER TYPE "public"."discount_type" ADD VALUE 'tiered';--> statement-breakpoint
ALTER TABLE "promo_codes" ADD COLUMN "bogo_config" jsonb;--> statement-breakpoint
ALTER TABLE "promo_codes" ADD COLUMN "tiers" jsonb;
