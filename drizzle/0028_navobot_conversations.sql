-- Estado conversacional e idempotência do agente híbrido de WhatsApp.
ALTER TABLE evolution_api_settings ADD COLUMN IF NOT EXISTS navobot_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS navobot_conversations (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  instance_name TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'idle',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_inbound_message_id TEXT,
  last_inbound_at TIMESTAMP,
  last_outbound_at TIMESTAMP,
  handoff_requested BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT navobot_conversations_phone_instance_unique UNIQUE (phone, instance_name)
);

CREATE TABLE IF NOT EXISTS navobot_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES navobot_conversations(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  intent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS navobot_messages_conversation_idx ON navobot_messages (conversation_id, created_at);
