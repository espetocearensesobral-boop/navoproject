-- Persiste a paleta de destaque escolhida por cada usuário autenticado.
-- Heritage mantém a identidade visual original para perfis existentes.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "theme_palette" text NOT NULL DEFAULT 'heritage';
ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "theme_palette" text NOT NULL DEFAULT 'heritage';
