import { z } from "zod";

export const bookingSchema = z.object({
  clientId: z.string().optional(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  professionalId: z.string().optional(),
  professionalName: z.string().optional(),
  date: z.string().optional(),
  timeSlot: z.string().optional(),
  services: z.array(z.any()).optional().default([]),
  paymentMethod: z.string().optional()
}).passthrough();

export const generateBookingCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'BRX-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};
