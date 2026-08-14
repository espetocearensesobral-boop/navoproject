-- 0015_create_receipts.sql
-- Recebimentos pós-serviço: pendentes até a confirmação do pagamento.

CREATE TABLE IF NOT EXISTS receipts (
  id text PRIMARY KEY,
  appointment_id text REFERENCES appointments(id) ON DELETE SET NULL,
  client_id text REFERENCES profiles(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_phone text,
  professional_id text REFERENCES professionals(id) ON DELETE SET NULL,
  professional_name text,
  service_title text NOT NULL,
  original_amount numeric(10, 2) NOT NULL DEFAULT 0,
  entered_amount numeric(10, 2) NOT NULL DEFAULT 0,
  discount_percent numeric(5, 2) NOT NULL DEFAULT 0,
  discount_amount numeric(10, 2) NOT NULL DEFAULT 0,
  surcharge_percent numeric(5, 2) NOT NULL DEFAULT 0,
  surcharge_amount numeric(10, 2) NOT NULL DEFAULT 0,
  total_amount numeric(10, 2) NOT NULL DEFAULT 0,
  payment_method text,
  amount_received numeric(10, 2) NOT NULL DEFAULT 0,
  change_amount numeric(10, 2) NOT NULL DEFAULT 0,
  observations text,
  status text NOT NULL DEFAULT 'pending',
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receipts_status_check CHECK (status IN ('pending', 'received', 'cancelled')),
  CONSTRAINT receipts_amounts_non_negative_check CHECK (
    original_amount >= 0 AND
    entered_amount >= 0 AND
    discount_percent >= 0 AND
    discount_amount >= 0 AND
    surcharge_percent >= 0 AND
    surcharge_amount >= 0 AND
    total_amount >= 0 AND
    amount_received >= 0 AND
    change_amount >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS receipts_appointment_id_unique
  ON receipts(appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS receipts_status_created_at_idx
  ON receipts(status, created_at DESC);

CREATE INDEX IF NOT EXISTS receipts_client_id_idx
  ON receipts(client_id);

COMMENT ON TABLE receipts IS 'Recebimentos de serviços, criados após a conclusão do atendimento.';
COMMENT ON COLUMN receipts.entered_amount IS 'Valor base digitado/confirmado pelo barbeiro na etapa de revisão.';
COMMENT ON COLUMN receipts.total_amount IS 'Valor final após descontos e acréscimos.';
COMMENT ON COLUMN receipts.amount_received IS 'Valor entregue pelo cliente, usado para calcular troco em dinheiro.';
