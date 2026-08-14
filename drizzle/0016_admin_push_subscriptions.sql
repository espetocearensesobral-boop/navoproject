-- Assinaturas Web Push por dispositivo administrativo.
-- A chave privada VAPID nunca é armazenada no banco.
CREATE TABLE IF NOT EXISTS "admin_push_subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "admin_id" text NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "admin_push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_push_subscriptions_admin_id_profiles_id_fk'
  ) THEN
    ALTER TABLE "admin_push_subscriptions"
      ADD CONSTRAINT "admin_push_subscriptions_admin_id_profiles_id_fk"
      FOREIGN KEY ("admin_id") REFERENCES "profiles"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "admin_push_subscriptions_admin_id_idx"
  ON "admin_push_subscriptions" ("admin_id");
CREATE INDEX IF NOT EXISTS "admin_push_subscriptions_enabled_idx"
  ON "admin_push_subscriptions" ("enabled");
