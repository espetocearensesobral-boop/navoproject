-- ====================================================================
-- NAVOCLUB - CONSOLIDATED DATABASE SETUP SCRIPT (SUPABASE)
-- ====================================================================

-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Perfis e Usuários
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'client',
  password_hash TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Configurações da Loja
CREATE TABLE IF NOT EXISTS public.shop_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  name TEXT NOT NULL DEFAULT 'Navo Barber & Club',
  unit_name TEXT DEFAULT 'Unidade Expectativa',
  slogan TEXT DEFAULT 'Estilo, Tradição e Excelência na Medida Certa',
  address TEXT DEFAULT 'Rua Fortaleza, 1420 - Expectativa, Sobral - CE',
  phone TEXT DEFAULT '(88) 99834-0085',
  whatsapp TEXT DEFAULT '5588998340085',
  open_time TEXT DEFAULT '09:00',
  close_time TEXT DEFAULT '20:00',
  operating_days JSONB DEFAULT '[1, 2, 3, 4, 5, 6]'::jsonb,
  operating_schedule JSONB DEFAULT '{"sunday":{"active":false,"open":"10:00","close":"16:00"},"monday":{"active":true,"open":"09:00","close":"20:00"},"tuesday":{"active":true,"open":"09:00","close":"20:00"},"wednesday":{"active":true,"open":"09:00","close":"20:00"},"thursday":{"active":true,"open":"09:00","close":"20:00"},"friday":{"active":true,"open":"09:00","close":"21:00"},"saturday":{"active":true,"open":"09:00","close":"20:00"}}'::jsonb,
  maps_url TEXT,
  instagram TEXT DEFAULT 'barbearia.navo',
  logo_url TEXT,
  description TEXT,
  allow_outside_hours_approval BOOLEAN DEFAULT false,
  theme_palette TEXT DEFAULT 'heritage',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Serviços
CREATE TABLE IF NOT EXISTS public.services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  category TEXT DEFAULT 'cabelo',
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Barbeiros
CREATE TABLE IF NOT EXISTS public.barbers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  bio TEXT,
  avatar_url TEXT,
  specialties JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  schedule_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Agendamentos
CREATE TABLE IF NOT EXISTS public.appointments (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  barber_id TEXT REFERENCES public.barbers(id) ON DELETE SET NULL,
  barber_name TEXT NOT NULL,
  service_id TEXT REFERENCES public.services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  service_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  service_duration INTEGER NOT NULL DEFAULT 30,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  notes TEXT,
  payment_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Lembretes
CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id TEXT PRIMARY KEY,
  appointment_id TEXT REFERENCES public.appointments(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- 8. Assinaturas Web Push
CREATE TABLE IF NOT EXISTS public.admin_push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Caixa e Transações
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id TEXT PRIMARY KEY,
  appointment_id TEXT REFERENCES public.appointments(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  description TEXT,
  payment_method TEXT,
  created_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Fidelidade e Recompensas
CREATE TABLE IF NOT EXISTS public.loyalty_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  points_per_real NUMERIC(10, 2) DEFAULT 1.00,
  points_expiry_days INTEGER DEFAULT 365,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loyalty_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  min_points INTEGER NOT NULL DEFAULT 0,
  multiplier NUMERIC(3, 2) DEFAULT 1.00,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rewards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.point_transactions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loyalty_benefits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loyalty_tier_benefits (
  tier_id TEXT REFERENCES public.loyalty_tiers(id) ON DELETE CASCADE,
  benefit_id TEXT REFERENCES public.loyalty_benefits(id) ON DELETE CASCADE,
  PRIMARY KEY (tier_id, benefit_id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loyalty_plan_benefits (
  plan_id TEXT REFERENCES public.loyalty_plans(id) ON DELETE CASCADE,
  benefit_id TEXT REFERENCES public.loyalty_benefits(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, benefit_id)
);

-- 11. Integrações & Marketing
CREATE TABLE IF NOT EXISTS public.google_ads_connections (
  id TEXT PRIMARY KEY DEFAULT 'default',
  refresh_token TEXT,
  customer_id TEXT,
  status TEXT DEFAULT 'disconnected',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.google_ads_campaigns (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  budget NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.google_ads_leads (
  id TEXT PRIMARY KEY,
  campaign_id TEXT,
  lead_name TEXT,
  lead_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.meta_ads_connections (
  id TEXT PRIMARY KEY DEFAULT 'default',
  access_token TEXT,
  ad_account_id TEXT,
  status TEXT DEFAULT 'disconnected',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.meta_ads_campaigns (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  budget NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.meta_ads_leads (
  id TEXT PRIMARY KEY,
  campaign_id TEXT,
  lead_name TEXT,
  lead_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.evolution_api_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  server_url TEXT,
  api_key TEXT,
  instance_name TEXT,
  is_active BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.navobot_conversations (
  id TEXT PRIMARY KEY,
  client_phone TEXT NOT NULL,
  client_name TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.navobot_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES public.navobot_conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Operações, E-mail, Impressão e Auditoria
CREATE TABLE IF NOT EXISTS public.operation_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  auto_confirm_appointments BOOLEAN DEFAULT true,
  send_whatsapp_reminders BOOLEAN DEFAULT true,
  reminder_hours_before INTEGER DEFAULT 2,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 587,
  smtp_user TEXT,
  smtp_pass TEXT,
  from_email TEXT,
  from_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.print_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  printer_width TEXT DEFAULT '80mm',
  header_text TEXT,
  footer_text TEXT,
  show_logo BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  meta_title TEXT DEFAULT 'Navo Barber & Club',
  meta_description TEXT,
  favicon_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.receipts (
  id TEXT PRIMARY KEY,
  appointment_id TEXT REFERENCES public.appointments(id) ON DELETE SET NULL,
  receipt_number TEXT UNIQUE NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.review_followup_events (
  id TEXT PRIMARY KEY,
  appointment_id TEXT REFERENCES public.appointments(id) ON DELETE CASCADE,
  rating INTEGER,
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.schedule_blocks (
  id TEXT PRIMARY KEY,
  barber_id TEXT REFERENCES public.barbers(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Inserção de Dados Iniciais Padrão
INSERT INTO public.shop_settings (id, name, unit_name, slogan, address, phone, whatsapp, open_time, close_time)
VALUES (
  'default',
  'Navo Barber & Club',
  'Unidade Expectativa',
  'Estilo, Tradição e Excelência na Medida Certa',
  'Rua Fortaleza, 1420 - Expectativa, Sobral - CE',
  '(88) 99834-0085',
  '5588998340085',
  '09:00',
  '20:00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.loyalty_settings (id, points_per_real, points_expiry_days, is_active)
VALUES ('default', 1.00, 365, true)
ON CONFLICT (id) DO NOTHING;

-- 14. Aplicação de Row Level Security (RLS) Seguro para o Linter do Supabase
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
      'admin_push_subscriptions', 'cash_transactions', 'email_settings',
      'evolution_api_settings', 'google_ads_campaigns', 'google_ads_connections',
      'google_ads_leads', 'loyalty_benefits', 'loyalty_plan_benefits',
      'loyalty_plans', 'loyalty_redemptions', 'loyalty_settings',
      'loyalty_tier_benefits', 'loyalty_tiers', 'meta_ads_campaigns',
      'meta_ads_connections', 'meta_ads_leads', 'navobot_conversations',
      'navobot_messages', 'notification_deliveries', 'operation_settings',
      'point_transactions', 'print_settings', 'receipts', 'referrals',
      'review_followup_events', 'rewards', 'schedule_blocks', 'shop_settings', 'site_settings'
    ];
BEGIN
    FOR t IN SELECT unnest(tables) LOOP
        BEGIN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
            EXECUTE format('DROP POLICY IF EXISTS "service_role_admin_access" ON public.%I;', t);
            EXECUTE format('CREATE POLICY "service_role_admin_access" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', t);
        EXCEPTION WHEN undefined_table THEN
            NULL;
        END;
    END LOOP;
END $$;
