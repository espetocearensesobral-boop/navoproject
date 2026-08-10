-- Adiciona a tabela de configuração de envio de e-mails (SMTP), editável
-- pelo admin em Configurações do Sistema > E-mail. Separada de shop_settings
-- porque guarda uma credencial sensível (smtp_password) e shop_settings é
-- lida publicamente (sem auth) pelo endpoint GET /api/shop-profile.
CREATE TABLE IF NOT EXISTS "email_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"enabled" boolean NOT NULL DEFAULT false,
	"smtp_host" text DEFAULT '',
	"smtp_port" integer NOT NULL DEFAULT 587,
	"smtp_secure" boolean NOT NULL DEFAULT false,
	"smtp_user" text DEFAULT '',
	"smtp_password" text DEFAULT '',
	"from_name" text NOT NULL DEFAULT 'Navo Barber & Club',
	"from_email" text DEFAULT '',
	"reply_to" text DEFAULT '',
	"notify_on_booking" boolean NOT NULL DEFAULT true,
	"notify_on_cancel" boolean NOT NULL DEFAULT true,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
