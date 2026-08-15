-- Navo Project — Pacote 1: Agenda e Disponibilidade
-- Execute manualmente no Supabase antes de publicar o código desta etapa.
-- Os defaults preservam o comportamento atual da Agenda.

CREATE TABLE IF NOT EXISTS operation_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  slot_interval_minutes INTEGER NOT NULL DEFAULT 30,
  minimum_booking_lead_minutes INTEGER NOT NULL DEFAULT 0,
  maximum_booking_horizon_days INTEGER NOT NULL DEFAULT 90,
  same_day_booking_cutoff_minutes INTEGER NOT NULL DEFAULT 0,
  buffer_between_appointments_minutes INTEGER NOT NULL DEFAULT 0,
  availability_cache_ttl_seconds INTEGER NOT NULL DEFAULT 20,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operation_settings_singleton_check CHECK (id = 'default'),
  CONSTRAINT operation_settings_slot_interval_check CHECK (slot_interval_minutes IN (5, 10, 15, 20, 30, 60)),
  CONSTRAINT operation_settings_minimum_lead_check CHECK (minimum_booking_lead_minutes BETWEEN 0 AND 10080),
  CONSTRAINT operation_settings_horizon_check CHECK (maximum_booking_horizon_days BETWEEN 1 AND 730),
  CONSTRAINT operation_settings_same_day_cutoff_check CHECK (same_day_booking_cutoff_minutes BETWEEN 0 AND 1440),
  CONSTRAINT operation_settings_buffer_check CHECK (buffer_between_appointments_minutes BETWEEN 0 AND 120),
  CONSTRAINT operation_settings_cache_ttl_check CHECK (availability_cache_ttl_seconds BETWEEN 5 AND 300)
);

INSERT INTO operation_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION touch_operation_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS operation_settings_updated_at_trigger ON operation_settings;
CREATE TRIGGER operation_settings_updated_at_trigger
BEFORE UPDATE ON operation_settings
FOR EACH ROW EXECUTE FUNCTION touch_operation_settings_updated_at();
