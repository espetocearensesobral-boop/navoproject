-- Add fields to support real password reset via WhatsApp code
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "reset_code_hash" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "reset_code_expires_at" timestamp;
