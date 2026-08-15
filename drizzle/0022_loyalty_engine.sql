-- Grupo 1 do Clube de Fidelidade: ledger real, validade e níveis persistidos.
-- Registros históricos permanecem com source_type = legacy e expires_at = NULL.
ALTER TABLE point_transactions
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS point_transactions_client_expires_idx
  ON point_transactions(client_id, expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS point_transactions_source_idx
  ON point_transactions(source_type, source_id);

CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  minimum_points INTEGER NOT NULL DEFAULT 0,
  multiplier NUMERIC(8, 2) NOT NULL DEFAULT 1.00,
  display_order INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_tiers_minimum_points_unique
  ON loyalty_tiers(minimum_points)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS loyalty_tiers_order_idx
  ON loyalty_tiers(display_order, minimum_points);

INSERT INTO loyalty_tiers (id, name, minimum_points, multiplier, display_order, color)
VALUES
  ('tier_bronze', 'Bronze', 0, 1.00, 0, '#A97142'),
  ('tier_prata', 'Prata', 1000, 1.20, 1, '#8D99AE'),
  ('tier_ouro', 'Ouro', 3000, 1.50, 2, '#C9A227'),
  ('tier_diamante', 'Diamante', 6000, 2.00, 3, '#54C7EC')
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_transactions_amount_non_zero_check') THEN
    ALTER TABLE point_transactions
      ADD CONSTRAINT point_transactions_amount_non_zero_check CHECK (amount <> 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_tiers_minimum_points_non_negative_check') THEN
    ALTER TABLE loyalty_tiers
      ADD CONSTRAINT loyalty_tiers_minimum_points_non_negative_check CHECK (minimum_points >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_tiers_multiplier_positive_check') THEN
    ALTER TABLE loyalty_tiers
      ADD CONSTRAINT loyalty_tiers_multiplier_positive_check CHECK (multiplier > 0);
  END IF;
END $$;
