import express from 'express';
import { and, eq, desc, ilike } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { optionalAuth, requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { publicReviewLookupSchema, publicReviewPayloadSchema, reviewPayloadSchema } from '../utils/validation.js';
import { matchPhoneNumbers } from '../utils/phone.js';

export const reviewsRouter = express.Router();

const publicReviewDetails = (appointment: any) => ({
  appointmentId: appointment.id,
  clientName: appointment.clientName || 'Cliente',
  professionalId: appointment.professionalId,
  professionalName: appointment.professionalName || 'Profissional Navo',
  serviceTitle: Array.isArray(appointment.services) && appointment.services.length > 0
    ? (typeof appointment.services[0] === 'string' ? appointment.services[0] : appointment.services[0]?.title || 'Atendimento')
    : 'Atendimento de Barbearia',
  date: appointment.date,
  timeSlot: appointment.timeSlot,
});

const findPublicReviewAppointment = async (bookingCode: string, clientPhone: string) => {
  const normalizedCode = bookingCode.trim().toUpperCase();
  const appointment = await db.query.appointments.findFirst({
    where: ilike(schema.appointments.bookingCode, normalizedCode),
  });
  if (!appointment || !appointment.clientPhone || !matchPhoneNumbers(appointment.clientPhone, clientPhone)) return null;
  return appointment;
};

// POST /api/reviews/public/lookup - Validate a completed appointment for the public survey
reviewsRouter.post('/public/lookup', async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    const parsed = publicReviewLookupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Informe o código do agendamento e o telefone.' });
    const appointment = await findPublicReviewAppointment(parsed.data.bookingCode, parsed.data.clientPhone);
    if (!appointment) return res.status(404).json({ error: 'Não encontramos um atendimento para esses dados.' });
    if (appointment.status !== 'completed') return res.status(400).json({ error: 'A avaliação fica disponível após a conclusão do atendimento.' });
    if (appointment.isReviewed) return res.status(409).json({ error: 'Este atendimento já recebeu uma avaliação.' });
    return res.json(publicReviewDetails(appointment));
  } catch (e: any) {
    return handleError(res, e, 'POST /api/reviews/public/lookup');
  }
});

// POST /api/reviews/public - Submit a survey after validating the booking code and phone again
reviewsRouter.post('/public', async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    const parsed = publicReviewPayloadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados de avaliação inválidos.', details: parsed.error.flatten() });
    const appointment = await findPublicReviewAppointment(parsed.data.bookingCode, parsed.data.clientPhone);
    if (!appointment) return res.status(404).json({ error: 'Não encontramos um atendimento para esses dados.' });
    if (appointment.status !== 'completed') return res.status(400).json({ error: 'A avaliação fica disponível após a conclusão do atendimento.' });
    if (appointment.isReviewed) return res.status(409).json({ error: 'Este atendimento já recebeu uma avaliação.' });

    const newReview = {
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      appointmentId: appointment.id,
      clientId: appointment.clientId || null,
      professionalId: appointment.professionalId,
      rating: parsed.data.rating,
      understoodRequest: parsed.data.understoodRequest || null,
      waitTimeAcceptable: parsed.data.waitTimeAcceptable || null,
      wouldRecommend: parsed.data.wouldRecommend || null,
      comment: parsed.data.comment || null,
      hasPhoto: false,
      photoUrl: null,
      pointsAwarded: 0,
      createdAt: new Date(),
    };

    if (typeof db.transaction === 'function') {
      await db.transaction(async (tx: any) => {
        await tx.insert(schema.reviews).values(newReview);
        await tx.update(schema.appointments)
          .set({ isReviewed: true, updatedAt: new Date() })
          .where(and(eq(schema.appointments.id, appointment.id), eq(schema.appointments.isReviewed, false)));
      });
    } else {
      await db.insert(schema.reviews).values(newReview);
      await db.update(schema.appointments)
        .set({ isReviewed: true, updatedAt: new Date() })
        .where(and(eq(schema.appointments.id, appointment.id), eq(schema.appointments.isReviewed, false)));
    }

    return res.json({ success: true, message: 'Avaliação enviada com sucesso. Obrigado pelo feedback!' });
  } catch (e: any) {
    return handleError(res, e, 'POST /api/reviews/public');
  }
});

// GET /api/reviews/public - Public reviews list
reviewsRouter.get('/public', async (req: any, res: any) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    }
    const rows = await db
      .select({
        id: schema.reviews.id,
        rating: schema.reviews.rating,
        comment: schema.reviews.comment,
        hasPhoto: schema.reviews.hasPhoto,
        photoUrl: schema.reviews.photoUrl,
        createdAt: schema.reviews.createdAt,
        clientName: schema.profiles.name,
        professionalName: schema.professionals.name
      })
      .from(schema.reviews)
      .leftJoin(schema.profiles, eq(schema.reviews.clientId, schema.profiles.id))
      .leftJoin(schema.professionals, eq(schema.reviews.professionalId, schema.professionals.id))
      .orderBy(desc(schema.reviews.createdAt))
      .limit(50);

    const formatted = rows.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment || '',
      clientName: r.clientName ? r.clientName.split(' ')[0] : 'Cliente',
      professionalName: r.professionalName || 'Barbeiro',
      hasPhoto: !!r.hasPhoto,
      photoUrl: r.photoUrl || '',
      createdAt: r.createdAt
    }));

    res.json(formatted);
  } catch (e: any) {
    return handleError(res, e, 'GET /api/reviews/public');
  }
});

// POST /api/reviews - Submit review
reviewsRouter.post('/', requireAuth, async (req: any, res: any) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    }
    const parsed = reviewPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados de avaliação inválidos.', details: parsed.error.flatten() });
    }

    const payload = parsed.data;
    let appointment: any = null;
    if (payload.appointmentId) {
      appointment = await db.query.appointments.findFirst({
        where: eq(schema.appointments.id, payload.appointmentId),
      });
      if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado.' });
      if (appointment.clientId !== req.user.id) return res.status(403).json({ error: 'A avaliação não pertence a este cliente.' });
      if (appointment.status !== 'completed') return res.status(400).json({ error: 'Apenas agendamentos concluídos podem ser avaliados.' });
      if (appointment.isReviewed) return res.status(409).json({ error: 'Este agendamento já foi avaliado.' });
      if (appointment.professionalId !== payload.professionalId) return res.status(400).json({ error: 'O profissional não corresponde ao agendamento.' });
    } else {
      const professional = await db.query.professionals.findFirst({ where: eq(schema.professionals.id, payload.professionalId) });
      if (!professional) return res.status(404).json({ error: 'Profissional não encontrado.' });
    }

    const newReview = {
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      appointmentId: payload.appointmentId || null,
      clientId: req.user.id,
      professionalId: payload.professionalId,
      rating: payload.rating,
      understoodRequest: payload.understoodRequest || null,
      waitTimeAcceptable: payload.waitTimeAcceptable || null,
      wouldRecommend: payload.wouldRecommend || null,
      comment: payload.comment || null,
      hasPhoto: payload.hasPhoto,
      photoUrl: payload.photoUrl || null,
      createdAt: new Date(),
    };

    if (typeof db.transaction === 'function') {
      await db.transaction(async (tx: any) => {
        await tx.insert(schema.reviews).values(newReview);
        if (payload.appointmentId) {
          await tx.update(schema.appointments)
            .set({ isReviewed: true, updatedAt: new Date() })
            .where(eq(schema.appointments.id, payload.appointmentId));
        }
      });
    } else {
      await db.insert(schema.reviews).values(newReview);
      if (payload.appointmentId) {
        await db.update(schema.appointments)
          .set({ isReviewed: true, updatedAt: new Date() })
          .where(eq(schema.appointments.id, payload.appointmentId));
      }
    }

    res.json({ success: true, message: 'Avaliação enviada com sucesso! Obrigado pelo feedback.' });
  } catch (e: any) {
    return handleError(res, e, 'POST /api/reviews');
  }
});
