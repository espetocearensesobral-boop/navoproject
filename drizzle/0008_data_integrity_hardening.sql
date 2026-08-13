-- Reconciliação idempotente do schema atual com bancos criados por históricos parciais.
-- Não renomeia colunas legadas automaticamente; apenas cria estruturas/colunas ausentes.

CREATE TABLE IF NOT EXISTS "reviews" (
  "id" text PRIMARY KEY NOT NULL,
  "appointment_id" text,
  "client_id" text,
  "professional_id" text NOT NULL,
  "rating" integer NOT NULL,
  "understood_request" text,
  "wait_time_acceptable" text,
  "would_recommend" text,
  "comment" text,
  "has_photo" boolean DEFAULT false,
  "photo_url" text,
  "points_awarded" integer DEFAULT 0,
  "admin_response" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "point_transactions" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL,
  "amount" integer NOT NULL,
  "type" text NOT NULL,
  "description" text NOT NULL,
  "source_key" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "referrals" (
  "id" text PRIMARY KEY NOT NULL,
  "referrer_id" text NOT NULL,
  "referred_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "points_awarded" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "rewards" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "points_required" integer NOT NULL,
  "reward_type" text NOT NULL,
  "value_description" text NOT NULL,
  "icon" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "schedule_blocks" (
  "id" text PRIMARY KEY NOT NULL,
  "professional_id" text NOT NULL,
  "date" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "cash_transactions" (
  "id" text PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "description" text NOT NULL,
  "amount" numeric(10, 2) NOT NULL,
  "category" text NOT NULL,
  "payment_method" text NOT NULL,
  "date" text NOT NULL,
  "status" text NOT NULL DEFAULT 'completed',
  "professional_name" text,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "shop_settings" (
  "id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
  "name" text NOT NULL DEFAULT 'Navo Barber & Club',
  "unit_name" text NOT NULL DEFAULT 'Unidade Expectativa',
  "slogan" text NOT NULL DEFAULT 'Estilo, Tradição e Excelência na Medida Certa',
  "address" text NOT NULL DEFAULT 'Rua Fortaleza, 1420 - Expectativa, Sobral - CE',
  "phone" text NOT NULL DEFAULT '(11) 99999-8888',
  "whatsapp" text NOT NULL DEFAULT '5511999998888',
  "open_time" text NOT NULL DEFAULT '09:00',
  "close_time" text NOT NULL DEFAULT '20:00',
  "operating_days" jsonb NOT NULL DEFAULT '[1,2,3,4,5,6]'::jsonb,
  "operating_schedule" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "maps_url" text DEFAULT 'https://maps.google.com/?q=Rua+Fortaleza+1420+Expectativa+Sobral+CE',
  "instagram" text DEFAULT '@barbearianavo',
  "logo_url" text,
  "description" text DEFAULT 'Barbearia premium com foco em experiência do cliente, cortes modernos e tradicionais.',
  "allow_outside_hours_approval" boolean NOT NULL DEFAULT false,
  "theme_palette" text NOT NULL DEFAULT 'heritage',
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "loyalty_redemptions" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL,
  "reward_id" text NOT NULL,
  "points" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'completed',
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notification_deliveries" (
  "id" text PRIMARY KEY NOT NULL,
  "appointment_id" text,
  "kind" text NOT NULL,
  "channel" text NOT NULL,
  "delivery_key" text NOT NULL UNIQUE,
  "sent_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "loyalty_settings" (
  "id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'appointment_date'
  ) THEN
    ALTER TABLE "appointments" RENAME COLUMN "date" TO "appointment_date";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'professionals' AND column_name = 'user_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE "professionals" DROP CONSTRAINT IF EXISTS "professionals_user_id_profiles_id_fk";
    ALTER TABLE "professionals" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;
    ALTER TABLE "professionals" ADD CONSTRAINT "professionals_user_id_profiles_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "referral_code" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "referred_by" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "birthday" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "reset_code_hash" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "reset_code_expires_at" timestamp;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "theme_palette" text NOT NULL DEFAULT 'heritage';
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "lgpd_consent" boolean NOT NULL DEFAULT false;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "lgpd_consent_date" timestamp;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "gallery_urls" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "client_phone" text;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "booking_code" text;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "cancellation_reason" text;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "is_reviewed" boolean NOT NULL DEFAULT false;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "waiting_queue" ADD COLUMN IF NOT EXISTS "client_phone" text;
ALTER TABLE "waiting_queue" ADD COLUMN IF NOT EXISTS "professional_name" text;
ALTER TABLE "waiting_queue" ADD COLUMN IF NOT EXISTS "service_price" numeric(10, 2);
ALTER TABLE "waiting_queue" ADD COLUMN IF NOT EXISTS "scheduled_time" text;
ALTER TABLE "waiting_queue" ADD COLUMN IF NOT EXISTS "arrived_at" text;
ALTER TABLE "waiting_queue" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "waiting_queue" ADD COLUMN IF NOT EXISTS "started_at" text;
ALTER TABLE "waiting_queue" ADD COLUMN IF NOT EXISTS "completed_at" text;
ALTER TABLE "waiting_queue" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "points_awarded" integer DEFAULT 0;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "admin_response" text;
ALTER TABLE "point_transactions" ADD COLUMN IF NOT EXISTS "source_key" text;
ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "allow_outside_hours_approval" boolean NOT NULL DEFAULT false;
ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "theme_palette" text NOT NULL DEFAULT 'heritage';
ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "email_settings" ALTER COLUMN "notify_on_cancel" SET DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "profiles_referral_code_unique" ON "profiles" ("referral_code") WHERE "referral_code" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_booking_code_unique" ON "appointments" ("booking_code") WHERE "booking_code" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "point_transactions_source_key_unique" ON "point_transactions" ("source_key") WHERE "source_key" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "referrals_referred_id_unique" ON "referrals" ("referred_id");
CREATE UNIQUE INDEX IF NOT EXISTS "reviews_appointment_id_unique" ON "reviews" ("appointment_id") WHERE "appointment_id" IS NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_appointment_id_appointments_id_fk') THEN
    ALTER TABLE "reviews" ADD CONSTRAINT "reviews_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_client_id_profiles_id_fk') THEN
    ALTER TABLE "reviews" ADD CONSTRAINT "reviews_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "profiles"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_professional_id_professionals_id_fk') THEN
    ALTER TABLE "reviews" ADD CONSTRAINT "reviews_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_transactions_client_id_profiles_id_fk') THEN
    ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "profiles"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_referrer_id_profiles_id_fk') THEN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_profiles_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "profiles"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_referred_id_profiles_id_fk') THEN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_profiles_id_fk" FOREIGN KEY ("referred_id") REFERENCES "profiles"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_blocks_professional_id_professionals_id_fk') THEN
    ALTER TABLE "schedule_blocks" ADD CONSTRAINT "schedule_blocks_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_redemptions_client_id_profiles_id_fk') THEN
    ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "profiles"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_redemptions_reward_id_rewards_id_fk') THEN
    ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_deliveries_appointment_id_appointments_id_fk') THEN
    ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE;
  END IF;
END $$;
