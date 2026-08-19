import { z } from "zod";

const id = z.string().trim().min(1).max(120);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida. Use YYYY-MM-DD.');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido. Use HH:mm.');
const service = z.union([
  id,
  z.object({ id, title: z.string().trim().max(200).optional() }).passthrough(),
]);

export const bookingSchema = z.object({
  id: id.optional(),
  clientId: id.optional(),
  client_id: id.optional(),
  clientName: z.string().trim().max(120).optional(),
  client_name: z.string().trim().max(120).optional(),
  clientPhone: z.string().trim().max(30).optional(),
  client_phone: z.string().trim().max(30).optional(),
  clientEmail: z.string().trim().email('E-mail inválido.').max(320).optional().or(z.literal('')),
  client_email: z.string().trim().email('E-mail inválido.').max(320).optional().or(z.literal('')),
  professionalId: id.optional(),
  professional_id: id.optional(),
  professionalName: z.string().trim().max(120).optional(),
  professional_name: z.string().trim().max(120).optional(),
  date: date.optional(),
  timeSlot: time.optional(),
  time_slot: time.optional(),
  services: z.array(service).max(20).optional().default([]),
  paymentMethod: z.enum(['credit_card', 'pix', 'loyalty_balance', 'pay_at_venue', 'in_store']).optional(),
  payment_method: z.enum(['credit_card', 'pix', 'loyalty_balance', 'pay_at_venue', 'in_store']).optional(),
  status: z.enum(['pending', 'pending_approval', 'confirmed', 'in_queue', 'in_service', 'completed', 'cancelled', 'no_show']).optional(),
  totalDurationMinutes: z.coerce.number().int().min(5).max(480).optional(),
  total_duration_minutes: z.coerce.number().int().min(5).max(480).optional(),
  originalAmount: z.coerce.number().finite().min(0).max(99999999.99).optional(),
  original_amount: z.coerce.number().finite().min(0).max(99999999.99).optional(),
  discountAmount: z.coerce.number().finite().min(0).max(99999999.99).optional(),
  discount_amount: z.coerce.number().finite().min(0).max(99999999.99).optional(),
  finalAmount: z.coerce.number().finite().min(0).max(99999999.99).optional(),
  final_amount: z.coerce.number().finite().min(0).max(99999999.99).optional(),
  bookingCode: z.string().trim().max(40).optional(),
  booking_code: z.string().trim().max(40).optional(),
  idempotencyKey: z.string().trim().max(160).optional(),
}).passthrough();

export const generateBookingCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'BRX-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};
