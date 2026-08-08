-- Fix structural issues: Type consistency, Foreign Keys, and Overbooking Index

-- 1. Fix profiles.id type if it was uuid (matching the app's expectation of text)
-- Note: In a real production DB with data, this would require careful casting.
ALTER TABLE "profiles" ALTER COLUMN "id" TYPE text;

-- 2. Add missing Foreign Keys
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_profiles_id_fk" 
    FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "waiting_queue" ADD CONSTRAINT "waiting_queue_client_id_profiles_id_fk" 
    FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;

-- 3. Add Unique Index for Overbooking Prevention
CREATE UNIQUE INDEX IF NOT EXISTS "booking_conflict_idx" ON "appointments" ("professional_id", "date", "time_slot") WHERE (status != 'cancelled');

-- 4. Ensure other FKs match the desired schema (cascades etc)
ALTER TABLE "professionals" DROP CONSTRAINT IF EXISTS "professionals_user_id_profiles_id_fk";
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_user_id_profiles_id_fk" 
    FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "waiting_queue" DROP CONSTRAINT IF EXISTS "waiting_queue_appointment_id_appointments_id_fk";
ALTER TABLE "waiting_queue" ADD CONSTRAINT "waiting_queue_appointment_id_appointments_id_fk" 
    FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;
