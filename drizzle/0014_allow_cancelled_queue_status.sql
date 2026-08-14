-- 0014_allow_cancelled_queue_status.sql
--
-- The production database still has the legacy waiting_queue_status_check,
-- which accepts abandoned but not cancelled. The current application needs
-- cancelled as a distinct historical state after an appointment is cancelled.

DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT c.conname
    FROM pg_constraint AS c
    JOIN pg_class AS t ON t.oid = c.conrelid
    JOIN pg_namespace AS n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'waiting_queue'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.waiting_queue DROP CONSTRAINT IF EXISTS %I',
      constraint_row.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.waiting_queue
  ADD CONSTRAINT waiting_queue_status_check
  CHECK (status IN ('waiting', 'in_chair', 'completed', 'abandoned', 'cancelled'));

UPDATE public.waiting_queue AS queue_item
SET status = 'cancelled',
    updated_at = NOW()
FROM public.appointments AS appointment
WHERE queue_item.appointment_id = appointment.id
  AND queue_item.status = 'abandoned'
  AND appointment.status = 'cancelled';
