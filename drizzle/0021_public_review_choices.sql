-- Pacote de avaliação rápida: escolhas anônimas de serviço e experiência.
-- Compatível com avaliações existentes; todas as novas colunas são opcionais.

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS service_id TEXT REFERENCES services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_title TEXT,
  ADD COLUMN IF NOT EXISTS service_experience TEXT;

CREATE INDEX IF NOT EXISTS reviews_service_id_idx ON reviews(service_id);
