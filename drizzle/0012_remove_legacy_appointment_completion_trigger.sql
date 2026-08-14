-- 0012_remove_legacy_appointment_completion_trigger.sql
--
-- Production diagnosis found that this legacy trigger writes to
-- loyalty_points_log, which is not part of the current data model and causes
-- PostgreSQL 42804 during appointment completion. The application already
-- awards loyalty points through processAppointmentCompletion(), using the
-- idempotent point_transactions.source_key flow.

DROP TRIGGER IF EXISTS trg_on_appointment_completed
  ON public.appointments;

DROP FUNCTION IF EXISTS public.handle_appointment_completion();
