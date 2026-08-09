-- Adiciona o toggle de admin que controla se horários que ultrapassam o
-- fechamento podem ser solicitados (fica pendente de aprovação do barbeiro)
-- ou se simplesmente não são oferecidos. Desativado por padrão.
ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "allow_outside_hours_approval" boolean NOT NULL DEFAULT false;
