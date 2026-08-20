-- Configuração administrativa e server-side da Evolution API.
-- A chave nunca deve ser exposta por endpoints públicos.
CREATE TABLE IF NOT EXISTS evolution_api_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  base_url TEXT NOT NULL DEFAULT '',
  instance_name TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  webhook_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_url TEXT NOT NULL DEFAULT '',
  webhook_secret TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO evolution_api_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;
