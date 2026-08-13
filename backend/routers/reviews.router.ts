import express from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { optionalAuth, requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { reviewPayloadSchema } from '../utils/validation.js';

export const reviewsRouter = express.Router();

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
