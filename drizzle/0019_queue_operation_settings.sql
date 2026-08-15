-- Navo Project — Pacote 2: Operação e Fila
-- Execute manualmente no Supabase antes de publicar o código desta etapa.
-- Os defaults preservam o comportamento atual da fila.

ALTER TABLE waiting_queue
  ADD COLUMN IF NOT EXISTS queue_position INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS waiting_queue_operation_order_idx
  ON waiting_queue (status, queue_position, joined_at);

ALTER TABLE operation_settings
  ADD COLUMN IF NOT EXISTS queue_refresh_seconds INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS queue_base_wait_minutes INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS allow_walk_in BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS require_professional_for_walk_in BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS queue_visible_limit INTEGER NOT NULL DEFAULT 5;

ALTER TABLE operation_settings
  DROP CONSTRAINT IF EXISTS operation_settings_queue_refresh_check,
  DROP CONSTRAINT IF EXISTS operation_settings_queue_base_wait_check,
  DROP CONSTRAINT IF EXISTS operation_settings_queue_visible_limit_check;

ALTER TABLE operation_settings
  ADD CONSTRAINT operation_settings_queue_refresh_check CHECK (queue_refresh_seconds BETWEEN 5 AND 300),
  ADD CONSTRAINT operation_settings_queue_base_wait_check CHECK (queue_base_wait_minutes BETWEEN 1 AND 240),
  ADD CONSTRAINT operation_settings_queue_visible_limit_check CHECK (queue_visible_limit BETWEEN 1 AND 20);
