-- Acompanhamento administrativo de avaliações públicas e autenticadas.
-- Não adiciona identificação ao fluxo público; apenas cria metadados internos para o Admin.

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS management_status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS handled_at timestamptz;

CREATE TABLE IF NOT EXISTS review_followup_events (
  id text PRIMARY KEY,
  review_id text NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  admin_id text REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  from_status text,
  to_status text,
  from_priority text,
  to_priority text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_followup_events_review_created_idx
  ON review_followup_events (review_id, created_at);

CREATE INDEX IF NOT EXISTS reviews_management_status_priority_idx
  ON reviews (management_status, priority, created_at);
