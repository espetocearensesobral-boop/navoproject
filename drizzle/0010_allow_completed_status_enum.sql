-- 0010_allow_completed_status_enum.sql
--
-- 0009 normalizes CHECK constraints. This follow-up is required for
-- installations where appointments.status is a PostgreSQL enum and 0009 has
-- already been applied: adding a CHECK constraint cannot add a missing enum
-- label. The block is a no-op when status is text or another non-enum type.

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
      EXECUTE format(
        'ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L',
        status_type_name,
        enum_value
      );
    END LOOP;
  END IF;
END $$;
