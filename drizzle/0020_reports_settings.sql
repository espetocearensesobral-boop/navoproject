-- Navo Project — Pacote 3: Contadores e Relatórios
-- Execute manualmente no Supabase antes de publicar o código desta etapa.

ALTER TABLE operation_settings
  ADD COLUMN IF NOT EXISTS reports_day_start_time TEXT NOT NULL DEFAULT '00:00',
  ADD COLUMN IF NOT EXISTS reports_include_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reports_include_no_show BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reports_comparison_window TEXT NOT NULL DEFAULT 'previous_period',
  ADD COLUMN IF NOT EXISTS reports_refresh_seconds INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS reports_show_pending_values BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE operation_settings
  DROP CONSTRAINT IF EXISTS operation_settings_reports_day_start_check,
  DROP CONSTRAINT IF EXISTS operation_settings_reports_comparison_check,
  DROP CONSTRAINT IF EXISTS operation_settings_reports_refresh_check;

ALTER TABLE operation_settings
  ADD CONSTRAINT operation_settings_reports_day_start_check CHECK (reports_day_start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT operation_settings_reports_comparison_check CHECK (reports_comparison_window IN ('previous_period', 'none')),
  ADD CONSTRAINT operation_settings_reports_refresh_check CHECK (reports_refresh_seconds BETWEEN 15 AND 300);
