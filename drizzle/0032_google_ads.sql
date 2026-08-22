CREATE TABLE IF NOT EXISTS "google_ads_connections" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_id" text NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "google_user_id" text,
  "google_user_name" text,
  "refresh_token" text DEFAULT '' NOT NULL,
  "token_expires_at" timestamp,
  "customer_id" text,
  "customer_name" text,
  "manager_customer_id" text,
  "currency" text DEFAULT 'BRL',
  "status" text DEFAULT 'connected' NOT NULL,
  "last_synced_at" timestamp,
  "last_error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "google_ads_connections_owner_unique_idx" ON "google_ads_connections" ("owner_id");

CREATE TABLE IF NOT EXISTS "google_ads_campaigns" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_id" text NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "connection_id" text NOT NULL REFERENCES "google_ads_connections"("id") ON DELETE CASCADE,
  "customer_id" text NOT NULL,
  "google_campaign_id" text NOT NULL,
  "google_ad_group_id" text,
  "google_ad_id" text,
  "name" text NOT NULL,
  "objective" text DEFAULT 'WEBSITE_TRAFFIC' NOT NULL,
  "status" text DEFAULT 'PAUSED' NOT NULL,
  "daily_budget_cents" integer DEFAULT 0 NOT NULL,
  "start_date" text,
  "end_date" text,
  "location_label" text,
  "location_resource_name" text,
  "destination_url" text,
  "ad_text" text,
  "headline" text,
  "keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "impressions" integer DEFAULT 0 NOT NULL,
  "reach" integer DEFAULT 0 NOT NULL,
  "clicks" integer DEFAULT 0 NOT NULL,
  "leads" integer DEFAULT 0 NOT NULL,
  "spend_cents" integer DEFAULT 0 NOT NULL,
  "conversions" numeric DEFAULT '0' NOT NULL,
  "last_insight_at" timestamp,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "google_ads_campaigns_owner_idx" ON "google_ads_campaigns" ("owner_id");
CREATE INDEX IF NOT EXISTS "google_ads_campaigns_connection_idx" ON "google_ads_campaigns" ("connection_id");
CREATE UNIQUE INDEX IF NOT EXISTS "google_ads_campaigns_remote_unique_idx" ON "google_ads_campaigns" ("customer_id", "google_campaign_id");

CREATE TABLE IF NOT EXISTS "google_ads_leads" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_id" text NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "connection_id" text NOT NULL REFERENCES "google_ads_connections"("id") ON DELETE CASCADE,
  "campaign_id" text REFERENCES "google_ads_campaigns"("id") ON DELETE SET NULL,
  "google_lead_id" text NOT NULL UNIQUE,
  "full_name" text,
  "phone" text,
  "email" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "received_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "google_ads_leads_owner_idx" ON "google_ads_leads" ("owner_id");
CREATE INDEX IF NOT EXISTS "google_ads_leads_campaign_idx" ON "google_ads_leads" ("campaign_id");
