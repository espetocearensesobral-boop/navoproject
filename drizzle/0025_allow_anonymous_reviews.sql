-- Permite avaliações públicas anônimas sem vínculo obrigatório a agendamento ou perfil.
-- O fluxo público identifica somente serviço e profissional e não solicita login,
-- portanto essas duas referências precisam aceitar NULL.

ALTER TABLE reviews
  ALTER COLUMN appointment_id DROP NOT NULL,
  ALTER COLUMN client_id DROP NOT NULL;

COMMENT ON COLUMN reviews.appointment_id IS 'Opcional: avaliações públicas anônimas não possuem agendamento vinculado.';
COMMENT ON COLUMN reviews.client_id IS 'Opcional: avaliações públicas anônimas não possuem perfil vinculado.';
