ALTER TABLE "appointments" ADD COLUMN "client_phone" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "gallery_urls" jsonb DEFAULT '[]'::jsonb;