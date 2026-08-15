import { z } from 'zod';

const idSchema = z.string().trim().min(1).max(120);
const moneySchema = z.coerce.number().finite().min(0).max(99999999.99);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida. Use YYYY-MM-DD.');
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido. Use HH:mm.');

export const servicePayloadSchema = z.object({
  id: idSchema.optional(),
  categorySlug: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  price: moneySchema,
  durationMinutes: z.coerce.number().int().min(5).max(480),
  isCombo: z.coerce.boolean().optional().default(false),
  originalPrice: moneySchema.nullable().optional(),
  discountPercentage: z.coerce.number().int().min(0).max(100).optional().default(0),
  isPopular: z.coerce.boolean().optional().default(false),
  imageUrl: z.string().url().max(2000).nullable().optional(),
  galleryUrls: z.array(z.string().url().max(2000)).max(20).optional().default([]),
});

export const productPayloadSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  brand: z.string().trim().min(1).max(120),
  price: moneySchema,
  costPrice: moneySchema.nullable().optional(),
  stockQuantity: z.coerce.number().int().min(0).max(1000000),
  minStockAlert: z.coerce.number().int().min(0).max(1000000),
  commissionPercentage: z.coerce.number().int().min(0).max(100).optional().default(0),
  imageUrl: z.string().url().max(2000).nullable().optional(),
});

export const professionalPayloadSchema = z.object({
  id: idSchema.optional(),
  userId: idSchema.nullable().optional(),
  name: z.string().trim().min(1).max(120),
  nickname: z.string().trim().max(80).nullable().optional(),
  roleTitle: z.string().trim().min(1).max(100),
  rating: z.coerce.number().min(0).max(5),
  reviewsCount: z.coerce.number().int().min(0).max(10000000),
  photoUrl: z.string().url().max(2000).nullable().optional(),
  specialties: z.array(z.string().trim().min(1).max(80)).max(30).optional().default([]),
  commissionRate: z.coerce.number().min(0).max(1),
  isActive: z.coerce.boolean().optional().default(true),
  workingHours: z.record(z.string(), z.unknown()).default({}),
});

export const cashTransactionPayloadSchema = z.object({
  id: idSchema.optional(),
  type: z.enum(['income', 'expense']),
  description: z.string().trim().min(1).max(500),
  amount: moneySchema.max(999999999.99),
  category: z.string().trim().min(1).max(80),
  paymentMethod: z.string().trim().min(1).max(50),
  date: dateSchema,
  status: z.enum(['completed', 'pending', 'cancelled']).default('completed'),
  professionalName: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const receiptMoney = moneySchema.max(99999999.99);
const receiptPercent = z.coerce.number().finite().min(0).max(100);
const receiptPaymentMethod = z.enum(['pix', 'credit_card', 'debit_card', 'cash', 'other']);

export const receiptCreatePayloadSchema = z.object({
  id: idSchema.optional(),
  appointmentId: idSchema.nullable().optional(),
  clientId: idSchema.nullable().optional(),
  clientName: z.string().trim().min(1).max(120),
  clientPhone: z.string().trim().max(30).nullable().optional(),
  professionalId: idSchema.nullable().optional(),
  professionalName: z.string().trim().max(120).nullable().optional(),
  serviceTitle: z.string().trim().min(1).max(500),
  originalAmount: receiptMoney,
  enteredAmount: receiptMoney,
  observations: z.string().trim().max(2000).nullable().optional(),
});

export const receiptReceivePayloadSchema = z.object({
  enteredAmount: receiptMoney,
  discountPercent: receiptPercent,
  discountAmount: receiptMoney,
  surchargePercent: receiptPercent,
  surchargeAmount: receiptMoney,
  totalAmount: receiptMoney,
  paymentMethod: receiptPaymentMethod,
  amountReceived: receiptMoney,
  changeAmount: receiptMoney,
  observations: z.string().trim().max(2000).nullable().optional(),
});

export const queuePayloadSchema = z.object({
  id: idSchema.optional(),
  appointmentId: idSchema.nullable().optional(),
  clientId: idSchema,
  clientName: z.string().trim().min(1).max(120),
  clientPhone: z.string().trim().max(30).optional(),
  professionalId: idSchema.nullable().optional(),
  professionalName: z.string().trim().max(120).nullable().optional(),
  serviceTitle: z.string().trim().min(1).max(200),
  servicePrice: moneySchema.nullable().optional(),
  scheduledTime: timeSchema.nullable().optional(),
  arrivedAt: z.string().trim().max(40).nullable().optional(),
  status: z.enum(['waiting', 'in_chair', 'completed', 'abandoned', 'cancelled']).default('waiting'),
  estimatedWaitMinutes: z.coerce.number().int().min(0).max(1440).default(0),
  queuePosition: z.coerce.number().int().min(0).max(100000).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  startedAt: z.string().trim().max(40).nullable().optional(),
  completedAt: z.string().trim().max(40).nullable().optional(),
});

const scheduleBlockFields = {
  professionalId: idSchema,
  date: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  reason: z.string().trim().max(300).nullable().optional(),
};

const scheduleBlockTimeRefinement = (value: { startTime: string; endTime: string }) => value.startTime < value.endTime;
const scheduleBlockTimeError = {
  message: 'O início do bloqueio deve ser anterior ao fim.',
  path: ['endTime'],
};

export const scheduleBlockPayloadSchema = z.object({
  id: idSchema.optional(),
  ...scheduleBlockFields,
}).refine(scheduleBlockTimeRefinement, scheduleBlockTimeError);

// Zod não permite `.omit()` em um objeto que já possui refinements.
// Este schema representa explicitamente o payload de criação/edição sem `id`.
export const scheduleBlockMutationSchema = z.object(scheduleBlockFields)
  .refine(scheduleBlockTimeRefinement, scheduleBlockTimeError);

export const rewardPayloadSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(1).max(160),
  pointsRequired: z.coerce.number().int().positive().max(100000000),
  rewardType: z.string().trim().min(1).max(60),
  valueDescription: z.string().trim().min(1).max(500),
  icon: z.string().trim().max(60).optional().default('Gift'),
  isActive: z.coerce.boolean().optional().default(true),
});

export const reviewPayloadSchema = z.object({
  appointmentId: idSchema.optional(),
  professionalId: idSchema,
  rating: z.coerce.number().int().min(1).max(5),
  understoodRequest: z.string().trim().max(30).nullable().optional(),
  waitTimeAcceptable: z.string().trim().max(30).nullable().optional(),
  wouldRecommend: z.string().trim().max(30).nullable().optional(),
  comment: z.string().trim().max(2000).nullable().optional(),
  hasPhoto: z.coerce.boolean().optional().default(false),
  photoUrl: z.string().url().max(2000).nullable().optional(),
});

export const publicReviewLookupSchema = z.object({
  bookingCode: z.string().trim().min(4).max(80),
  clientPhone: z.string().trim().min(8).max(30),
});

export const publicReviewPayloadSchema = z.object({
  bookingCode: z.string().trim().min(4).max(80),
  clientPhone: z.string().trim().min(8).max(30),
  rating: z.coerce.number().int().min(1).max(5),
  understoodRequest: z.string().trim().max(30).nullable().optional(),
  waitTimeAcceptable: z.string().trim().max(30).nullable().optional(),
  wouldRecommend: z.string().trim().max(30).nullable().optional(),
  comment: z.string().trim().max(2000).nullable().optional(),
});

export { dateSchema, timeSchema, idSchema, moneySchema };
