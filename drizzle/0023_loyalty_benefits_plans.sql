-- Grupo 2 do Clube de Fidelidade: catálogo de benefícios e planos.
-- Esta migração não cria assinaturas, cobranças ou débitos financeiros.

CREATE TABLE IF NOT EXISTS loyalty_benefits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  benefit_type TEXT NOT NULL DEFAULT 'custom',
  value_amount NUMERIC(10, 2),
  value_text TEXT,
  service_id TEXT REFERENCES services(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  usage_limit INTEGER,
  validity_days INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loyalty_benefits_active_order_idx
  ON loyalty_benefits(is_active, display_order, name);

CREATE TABLE IF NOT EXISTS loyalty_tier_benefits (
  tier_id TEXT NOT NULL REFERENCES loyalty_tiers(id) ON DELETE CASCADE,
  benefit_id TEXT NOT NULL REFERENCES loyalty_benefits(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (tier_id, benefit_id)
);

CREATE INDEX IF NOT EXISTS loyalty_tier_benefits_benefit_idx
  ON loyalty_tier_benefits(benefit_id, display_order);

CREATE TABLE IF NOT EXISTS loyalty_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  billing_period TEXT NOT NULL DEFAULT 'none',
  points_bonus INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loyalty_plans_status_order_idx
  ON loyalty_plans(status, display_order, name);

CREATE TABLE IF NOT EXISTS loyalty_plan_benefits (
  plan_id TEXT NOT NULL REFERENCES loyalty_plans(id) ON DELETE CASCADE,
  benefit_id TEXT NOT NULL REFERENCES loyalty_benefits(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, benefit_id)
);

CREATE INDEX IF NOT EXISTS loyalty_plan_benefits_benefit_idx
  ON loyalty_plan_benefits(benefit_id, display_order);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_benefits_type_check') THEN
    ALTER TABLE loyalty_benefits
      ADD CONSTRAINT loyalty_benefits_type_check CHECK (benefit_type IN ('discount_percent', 'discount_fixed', 'free_service', 'free_product', 'points_bonus', 'priority_queue', 'custom'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_benefits_amount_non_negative_check') THEN
    ALTER TABLE loyalty_benefits
      ADD CONSTRAINT loyalty_benefits_amount_non_negative_check CHECK (value_amount IS NULL OR value_amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_benefits_validity_positive_check') THEN
    ALTER TABLE loyalty_benefits
      ADD CONSTRAINT loyalty_benefits_validity_positive_check CHECK (validity_days IS NULL OR validity_days > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_plans_period_check') THEN
    ALTER TABLE loyalty_plans
      ADD CONSTRAINT loyalty_plans_period_check CHECK (billing_period IN ('none', 'monthly', 'quarterly', 'annual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_plans_status_check') THEN
    ALTER TABLE loyalty_plans
      ADD CONSTRAINT loyalty_plans_status_check CHECK (status IN ('draft', 'active', 'archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_plans_price_non_negative_check') THEN
    ALTER TABLE loyalty_plans
      ADD CONSTRAINT loyalty_plans_price_non_negative_check CHECK (price >= 0);
  END IF;
END $$;
