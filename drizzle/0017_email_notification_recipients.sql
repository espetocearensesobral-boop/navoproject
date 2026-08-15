-- Navo Project: e-mails de notificação para barbearia e cliente
-- Aplicar manualmente no Supabase SQL Editor antes de publicar o uso dos novos campos.
-- Não altera contas, catálogo, configurações de identidade ou dados financeiros.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS client_email TEXT;

ALTER TABLE email_settings
  ADD COLUMN IF NOT EXISTS notification_email TEXT DEFAULT '';

ALTER TABLE email_settings
  ADD COLUMN IF NOT EXISTS notify_on_reschedule BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN appointments.client_email IS 'E-mail opcional informado no fluxo de agendamento; não cria cadastro de cliente.';
COMMENT ON COLUMN email_settings.notification_email IS 'Destinatário administrativo padrão da barbearia para alertas operacionais.';
COMMENT ON COLUMN email_settings.notify_on_reschedule IS 'Controla avisos administrativos e de cliente em reagendamentos.';
