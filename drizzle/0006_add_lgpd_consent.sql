-- Persiste o consentimento LGPD já coletado no formulário de cadastro
-- (front-end envia lgpdConsent/lgpdConsentDate, mas a API descartava os
-- campos por falta de colunas na tabela). Default false/NULL preserva
-- perfis existentes, que serão marcados como "sem consentimento registrado".
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "lgpd_consent" boolean NOT NULL DEFAULT false;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "lgpd_consent_date" timestamp;
