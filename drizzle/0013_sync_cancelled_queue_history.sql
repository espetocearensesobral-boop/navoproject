-- 0013_sync_cancelled_queue_history.sql
--
-- A queue item is `abandoned` only while its linked appointment remains
-- recoverable. When the appointment is cancelled, place the linked queue item
-- in the cancelled history instead of leaving it in the Removidos tab.

UPDATE public.waiting_queue AS queue_item
SET status = 'cancelled',
    updated_at = NOW()
FROM public.appointments AS appointment
WHERE queue_item.appointment_id = appointment.id
  AND queue_item.status = 'abandoned'
  AND appointment.status = 'cancelled';
