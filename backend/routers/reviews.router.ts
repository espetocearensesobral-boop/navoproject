import express from 'express';
import jwt from 'jsonwebtoken';
import { and, eq, desc, ilike, sql } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { optionalAuth, requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { publicReviewLookupSchema, publicReviewPayloadSchema, reviewPayloadSchema } from '../utils/validation.js';
import { matchPhoneNumbers } from '../utils/phone.js';
import { JWT_SECRET } from '../config/env.js';
import { expirePointsInTransaction, getLoyaltyConfig, refreshProfileTierInTransaction } from '../services/loyalty-engine.service.js';

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

const isReviewSchemaCompatibilityError = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  const missingOptionalColumn = ['service_id', 'service_title', 'service_experience']
    .some((column) => message.includes(column));
  return error?.code === '42703' || (missingOptionalColumn && message.includes('column'));
};

const insertAnonymousReview = async (review: any) => {
  try {
    await db.insert(schema.reviews).values(review);
  } catch (error: any) {
    if (!isReviewSchemaCompatibilityError(error)) throw error;

    // Compatibilidade temporária com bancos que ainda possuem o formato legado
    // de reviews. A avaliação continua anônima e preserva as respostas essenciais.
    await db.insert(schema.reviews).values({
      id: review.id,
      appointmentId: review.appointmentId,
      clientId: review.clientId,
      professionalId: review.professionalId,
      rating: review.rating,
      understoodRequest: review.understoodRequest,
      waitTimeAcceptable: review.waitTimeAcceptable,
      wouldRecommend: review.wouldRecommend,
      comment: review.comment,
      hasPhoto: review.hasPhoto,
      photoUrl: review.photoUrl,
      createdAt: review.createdAt,
    });
  }
};

// GET /api/reviews/public/session - Start a short-lived public survey session
reviewsRouter.get('/public/session', (_req: any, res: any) => {
  const expiresInSeconds = 5 * 60;
  const token = jwt.sign(
    { kind: 'public_review', nonce: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}` },
    JWT_SECRET,
    { expiresIn: expiresInSeconds },
  );
  return res.json({ token, expiresAt: Date.now() + expiresInSeconds * 1000 });
});

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

// POST /api/reviews/public - Submit a quick anonymous survey
reviewsRouter.post('/public', async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    const parsed = publicReviewPayloadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados de avaliação inválidos.', details: parsed.error.flatten() });

    try {
      const session = jwt.verify(parsed.data.sessionToken, JWT_SECRET) as any;
      if (session?.kind !== 'public_review') throw new Error('invalid_review_session');
    } catch {
      return res.status(410).json({ error: 'Esta avaliação expirou. Reinicie pelo mesmo link para começar novamente.' });
    }

    const service = await db.query.services.findFirst({ where: eq(schema.services.id, parsed.data.serviceId) });
    if (!service) return res.status(404).json({ error: 'Serviço não encontrado ou indisponível.' });
    const professional = await db.query.professionals.findFirst({ where: and(eq(schema.professionals.id, parsed.data.professionalId), eq(schema.professionals.isActive, true)) });
    if (!professional) return res.status(404).json({ error: 'Profissional não encontrado ou indisponível.' });

    let appointment: any = null;
    if (parsed.data.bookingCode && parsed.data.clientPhone) {
      appointment = await findPublicReviewAppointment(parsed.data.bookingCode, parsed.data.clientPhone);
      if (!appointment) return res.status(404).json({ error: 'Não encontramos um atendimento para esses dados.' });
      if (appointment.status !== 'completed') return res.status(400).json({ error: 'A avaliação fica disponível após a conclusão do atendimento.' });
      if (appointment.isReviewed) return res.status(409).json({ error: 'Este atendimento já recebeu uma avaliação.' });
      if (appointment.professionalId !== professional.id) return res.status(400).json({ error: 'O profissional não corresponde ao atendimento informado.' });
    }

    const newReview = {
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      appointmentId: appointment?.id || null,
      clientId: appointment?.clientId || null,
      serviceId: service.id,
      serviceTitle: service.title,
      professionalId: professional.id,
      rating: parsed.data.rating,
      understoodRequest: parsed.data.understoodRequest,
      waitTimeAcceptable: parsed.data.waitTimeAcceptable,
      serviceExperience: parsed.data.serviceExperience,
      wouldRecommend: parsed.data.wouldRecommend,
      comment: parsed.data.comment || null,
      hasPhoto: false,
      photoUrl: null,
      pointsAwarded: 0,
      createdAt: new Date(),
    };

    if (!appointment) {
      // Avaliações anônimas não precisam atualizar outro registro. Evitamos uma
      // transação desnecessária no runtime serverless e persistimos somente o
      // lançamento da avaliação.
      await insertAnonymousReview(newReview);
    } else if (typeof db.transaction === 'function') {
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
        serviceTitle: schema.reviews.serviceTitle,
        serviceExperience: schema.reviews.serviceExperience,
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
      serviceTitle: r.serviceTitle || '',
      serviceExperience: r.serviceExperience || '',
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
      serviceExperience: payload.serviceExperience || null,
      wouldRecommend: payload.wouldRecommend || null,
      comment: payload.comment || null,
      hasPhoto: payload.hasPhoto,
      photoUrl: payload.photoUrl || null,
      createdAt: new Date(),
    };

    let pointsAwarded = 0;
    const applyReviewPoints = async (tx: any) => {
      await expirePointsInTransaction(tx, req.user.id);
      const config = await getLoyaltyConfig(tx);
      pointsAwarded = config.reviewPoints.baseReview
        + (payload.hasPhoto ? config.reviewPoints.withPhotoBonus : 0)
        + (payload.rating === 5 ? config.reviewPoints.fiveStarBonus : 0);
      if (pointsAwarded <= 0) return;
      const validity = config.pointsValidityDays > 0
        ? new Date(Date.now() + config.pointsValidityDays * 86400000)
        : null;
      const [inserted] = await tx.insert(schema.pointTransactions).values({
        id: `pt_review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        clientId: req.user.id,
        amount: pointsAwarded,
        type: 'review_bonus',
        sourceType: 'review',
        sourceId: newReview.id,
        sourceKey: `review:${newReview.id}`,
        description: 'Bônus por avaliação enviada',
        expiresAt: validity,
        createdAt: new Date(),
      }).onConflictDoNothing({ target: schema.pointTransactions.sourceKey }).returning({ id: schema.pointTransactions.id });
      if (!inserted) pointsAwarded = 0;
      await tx.update(schema.profiles)
        .set({ loyaltyPoints: sql`${schema.profiles.loyaltyPoints} + ${pointsAwarded}`, updatedAt: new Date() })
        .where(eq(schema.profiles.id, req.user.id));
      await refreshProfileTierInTransaction(tx, req.user.id);
    };

    if (typeof db.transaction === 'function') {
      await db.transaction(async (tx: any) => {
        await tx.insert(schema.reviews).values(newReview);
        if (payload.appointmentId) {
          await tx.update(schema.appointments)
            .set({ isReviewed: true, updatedAt: new Date() })
            .where(eq(schema.appointments.id, payload.appointmentId));
        }
        await applyReviewPoints(tx);
      });
    } else {
      await db.insert(schema.reviews).values(newReview);
      if (payload.appointmentId) {
        await db.update(schema.appointments)
          .set({ isReviewed: true, updatedAt: new Date() })
          .where(eq(schema.appointments.id, payload.appointmentId));
      }
    }

    res.json({ success: true, pointsAwarded, message: 'Avaliação enviada com sucesso! Obrigado pelo feedback.' });
  } catch (e: any) {
    return handleError(res, e, 'POST /api/reviews');
  }
});
