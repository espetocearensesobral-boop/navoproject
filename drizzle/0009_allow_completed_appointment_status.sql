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

-- Some older Supabase installations may have created status as a PostgreSQL
-- enum instead of text. Add every application-supported value that is missing.
DO $$
DECLARE
  status_type_oid oid;
  status_type_name text;
  enum_value text;
BEGIN
  SELECT a.atttypid
    INTO status_type_oid
  FROM pg_attribute AS a
  JOIN pg_class AS t ON t.oid = a.attrelid
  JOIN pg_namespace AS n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'appointments'
    AND a.attname = 'status'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  SELECT ty.typname
    INTO status_type_name
  FROM pg_type AS ty
  WHERE ty.oid = status_type_oid
    AND ty.typnamespace = 'public'::regnamespace
    AND ty.typtype = 'e';

  IF status_type_name IS NOT NULL THEN
    FOREACH enum_value IN ARRAY ARRAY[
      'pending',
      'pending_approval',
      'confirmed',
      'in_queue',
      'in_service',
      'completed',
      'cancelled',
      'no_show'
    ]
    LOOP
      EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', status_type_name, enum_value);
    END LOOP;
  END IF;
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
