-- Configurações de impressão por tipo de documento.
-- Não cria tarefas de impressão; controla a composição do preview do navegador.

CREATE TABLE IF NOT EXISTS print_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  receipt_format TEXT NOT NULL DEFAULT 'thermal',
  report_format TEXT NOT NULL DEFAULT 'a4',
  qr_format TEXT NOT NULL DEFAULT 'a4',
  thermal_width_mm INTEGER NOT NULL DEFAULT 80,
  a4_orientation TEXT NOT NULL DEFAULT 'portrait',
  font_size INTEGER NOT NULL DEFAULT 11,
  density TEXT NOT NULL DEFAULT 'comfortable',
  margin_mm INTEGER NOT NULL DEFAULT 8,
  show_logo BOOLEAN NOT NULL DEFAULT TRUE,
  show_client_data BOOLEAN NOT NULL DEFAULT TRUE,
  show_professional BOOLEAN NOT NULL DEFAULT TRUE,
  show_service BOOLEAN NOT NULL DEFAULT TRUE,
  show_payment BOOLEAN NOT NULL DEFAULT TRUE,
  show_observations BOOLEAN NOT NULL DEFAULT TRUE,
  show_qr BOOLEAN NOT NULL DEFAULT TRUE,
  show_footer BOOLEAN NOT NULL DEFAULT TRUE,
  footer_text TEXT NOT NULL DEFAULT 'Obrigado pela preferência.',
  report_include_charts BOOLEAN NOT NULL DEFAULT TRUE,
  report_include_details BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'print_settings_receipt_format_check') THEN
    ALTER TABLE print_settings ADD CONSTRAINT print_settings_receipt_format_check CHECK (receipt_format IN ('thermal', 'a4'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'print_settings_report_format_check') THEN
    ALTER TABLE print_settings ADD CONSTRAINT print_settings_report_format_check CHECK (report_format IN ('thermal', 'a4'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'print_settings_qr_format_check') THEN
    ALTER TABLE print_settings ADD CONSTRAINT print_settings_qr_format_check CHECK (qr_format IN ('thermal', 'a4'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'print_settings_thermal_width_check') THEN
    ALTER TABLE print_settings ADD CONSTRAINT print_settings_thermal_width_check CHECK (thermal_width_mm IN (58, 80));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'print_settings_orientation_check') THEN
    ALTER TABLE print_settings ADD CONSTRAINT print_settings_orientation_check CHECK (a4_orientation IN ('portrait', 'landscape'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'print_settings_font_size_check') THEN
    ALTER TABLE print_settings ADD CONSTRAINT print_settings_font_size_check CHECK (font_size BETWEEN 9 AND 18);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'print_settings_density_check') THEN
    ALTER TABLE print_settings ADD CONSTRAINT print_settings_density_check CHECK (density IN ('compact', 'comfortable', 'spacious'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'print_settings_margin_check') THEN
    ALTER TABLE print_settings ADD CONSTRAINT print_settings_margin_check CHECK (margin_mm BETWEEN 0 AND 30);
  END IF;
END $$;

INSERT INTO print_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;
