-- 0009_allow_completed_appointment_status.sql
--
-- The queue and appointment workflows both use `completed`. Some production
-- databases were created with an older status CHECK constraint that omitted
-- this value, causing the atomic completion transaction to roll back with a
-- generic HTTP 500. Remove only legacy CHECK constraints on appointments that
-- reference status, then install the canonical list used by the application.

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
      AND t.relname = 'appointments'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS %I',
      constraint_row.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (
    status IN (
      'pending',
      'pending_approval',
      'confirmed',
      'in_queue',
      'in_service',
      'completed',
      'cancelled',
      'no_show'
    )
  );
