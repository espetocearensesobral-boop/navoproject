-- Meta Ads: conexão por proprietário, campanhas sincronizadas e leads capturados.
-- Access tokens são armazenados apenas no backend; o código não os expõe em respostas.
CREATE TABLE IF NOT EXISTS meta_ads_connections (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meta_user_id TEXT,
  meta_user_name TEXT,
  access_token TEXT NOT NULL DEFAULT '',
  token_expires_at TIMESTAMPTZ,
  ad_account_id TEXT,
  ad_account_name TEXT,
  currency TEXT DEFAULT 'BRL',
  page_id TEXT,
  page_name TEXT,
  status TEXT NOT NULL DEFAULT 'connected',
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meta_ads_connections_owner_unique UNIQUE (owner_id)
);

CREATE TABLE IF NOT EXISTS meta_ads_campaigns (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id TEXT NOT NULL REFERENCES meta_ads_connections(id) ON DELETE CASCADE,
  meta_campaign_id TEXT NOT NULL UNIQUE,
  meta_ad_set_id TEXT,
  meta_creative_id TEXT,
  meta_ad_id TEXT,
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PAUSED',
  daily_budget_cents INTEGER NOT NULL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  location_label TEXT,
  location_key TEXT,
  destination_url TEXT,
  ad_text TEXT,
  headline TEXT,
  image_url TEXT,
  impressions INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  spend_cents INTEGER NOT NULL DEFAULT 0,
  last_insight_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meta_ads_campaigns_owner_idx ON meta_ads_campaigns (owner_id);
CREATE INDEX IF NOT EXISTS meta_ads_campaigns_connection_idx ON meta_ads_campaigns (connection_id);

CREATE TABLE IF NOT EXISTS meta_ads_leads (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id TEXT NOT NULL REFERENCES meta_ads_connections(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES meta_ads_campaigns(id) ON DELETE SET NULL,
  meta_lead_id TEXT NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meta_ads_leads_owner_idx ON meta_ads_leads (owner_id);
CREATE INDEX IF NOT EXISTS meta_ads_leads_campaign_idx ON meta_ads_leads (campaign_id);
