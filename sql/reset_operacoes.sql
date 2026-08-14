-- Navo Project — reset operacional manual
--
-- ATENÇÃO: este arquivo é destrutivo. NÃO é uma migração e não deve ser
-- executado automaticamente no deploy, no boot ou pelo Drizzle.
--
-- Objetivo:
--   limpar a operação para iniciar um novo ciclo de testes/uso, removendo
--   agenda, fila, checkout, livro-caixa, bloqueios, avaliações e histórico
--   de fidelidade, sem remover a configuração estrutural da barbearia.
--
-- Preservados intencionalmente:
--   profiles, professionals, services, products, rewards,
--   shop_settings, email_settings, loyalty_settings,
--   admin_push_subscriptions e a estrutura/migrações do banco.
--
-- Não executa DELETE/UPDATE em paletas ou configurações. A coluna
-- profiles.theme_palette e as colunas de paleta/configuração permanecem intactas.
-- Também não zera estoque de products, pois estoque é cadastro/inventário e
-- não deve ser destruído junto com o reset operacional.
--
-- Pré-requisitos recomendados:
--   1. Exportar um backup/snapshot do banco no Supabase.
--   2. Confirmar que não há checkout, fila ou agendamento em uso.
--   3. Executar em uma janela de manutenção.
--   4. Conferir a saída final antes de COMMIT.
--
-- Para desfazer antes do COMMIT, use ROLLBACK. Depois do COMMIT não há undo
-- sem restauração do backup.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- Falha de forma explícita se o schema esperado não estiver presente. Isso
-- evita executar um reset parcial em um banco errado ou incompleto.
DO $$
DECLARE
  required_table text;
  required_tables constant text[] := ARRAY[
    'appointments',
    'waiting_queue',
    'receipts',
    'cash_transactions',
    'schedule_blocks',
    'reviews',
    'point_transactions',
    'referrals',
    'loyalty_redemptions',
    'notification_deliveries'
  ];
BEGIN
  FOREACH required_table IN ARRAY required_tables LOOP
    IF to_regclass(format('public.%I', required_table)) IS NULL THEN
      RAISE EXCEPTION
        'Reset abortado: tabela public.% não existe.', required_table;
    END IF;
  END LOOP;
END
$$;

-- As tabelas estão listadas juntas para que o PostgreSQL valide as chaves
-- estrangeiras no conjunto. Não usamos CASCADE: uma tabela operacional nova
-- ou desconhecida bloqueia o reset em vez de ser apagada silenciosamente.
TRUNCATE TABLE
  public.notification_deliveries,
  public.loyalty_redemptions,
  public.point_transactions,
  public.referrals,
  public.reviews,
  public.receipts,
  public.waiting_queue,
  public.schedule_blocks,
  public.cash_transactions,
  public.appointments;

-- Os registros de fidelidade e avaliações foram removidos. Estas colunas são
-- agregados derivados, portanto voltam ao estado inicial sem apagar perfis ou
-- profissionais cadastrados. A coluna profiles.theme_palette não é alterada.
UPDATE public.profiles
SET loyalty_points = 0,
    loyalty_tier = 'Bronze',
    updated_at = now()
WHERE loyalty_points <> 0 OR loyalty_tier <> 'Bronze';

UPDATE public.professionals
SET rating = 5.00,
    reviews_count = 0,
    updated_at = now()
WHERE rating <> 5.00 OR reviews_count <> 0;

-- Resultado informativo dentro da mesma transação. Se algum total for diferente de
-- zero, o script aborta e nada é confirmado.
DO $$
DECLARE
  remaining_rows bigint;
BEGIN
  SELECT COALESCE(SUM(row_count), 0)
    INTO remaining_rows
  FROM (
    SELECT COUNT(*) AS row_count FROM public.appointments
    UNION ALL SELECT COUNT(*) FROM public.waiting_queue
    UNION ALL SELECT COUNT(*) FROM public.receipts
    UNION ALL SELECT COUNT(*) FROM public.cash_transactions
    UNION ALL SELECT COUNT(*) FROM public.schedule_blocks
    UNION ALL SELECT COUNT(*) FROM public.reviews
    UNION ALL SELECT COUNT(*) FROM public.point_transactions
    UNION ALL SELECT COUNT(*) FROM public.referrals
    UNION ALL SELECT COUNT(*) FROM public.loyalty_redemptions
    UNION ALL SELECT COUNT(*) FROM public.notification_deliveries
  ) AS counts;

  IF remaining_rows <> 0 THEN
    RAISE EXCEPTION
      'Reset abortado: ainda existem % registros operacionais.', remaining_rows;
  END IF;
END
$$;

-- Resultado informativo para o SQL Editor. O COMMIT é intencional e deve ser
-- removido/substituído por ROLLBACK caso o usuário esteja apenas ensaiando.
SELECT
  'reset_operacoes' AS operation,
  'concluido' AS status,
  0::bigint AS registros_operacionais_restantes,
  'Paletas, configurações, catálogo, profissionais, perfis e push admin preservados' AS preserved_scope;

COMMIT;
