-- 0011_normalize_appointment_status_type.sql
--
-- Production diagnosis showed PostgreSQL 42804 while updating appointments.status:
-- the column is still backed by a legacy enum, while the application schema uses
-- text. Normalize the column type without deleting appointment rows.

-- The partial unique index and status checks depend on the old enum type.
DROP INDEX IF EXISTS public.booking_conflict_idx;

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
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.appointments
  ALTER COLUMN status TYPE text
  USING status::text;

ALTER TABLE public.appointments
  ALTER COLUMN status SET DEFAULT 'confirmed';

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

CREATE UNIQUE INDEX IF NOT EXISTS booking_conflict_idx
  ON public.appointments (professional_id, appointment_date, time_slot)
  WHERE status <> 'cancelled';
