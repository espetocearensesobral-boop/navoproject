import express from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { optionalAuth, requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';

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
reviewsRouter.post('/', optionalAuth, async (req: any, res: any) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    }
    const {
      appointmentId,
      professionalId,
      rating,
      understoodRequest,
      waitTimeAcceptable,
      wouldRecommend,
      comment,
      hasPhoto,
      photoUrl
    } = req.body;

    if (!professionalId || !rating) {
      return res.status(400).json({ error: 'Profissional e nota são obrigatórios.' });
    }

    const clientId = req.user?.id || null;
    const reviewId = `rev_${Date.now()}`;

    const newReview = {
      id: reviewId,
      appointmentId: appointmentId || null,
      clientId: clientId && clientId !== 'usr_guest' ? clientId : null,
      professionalId,
      rating: Number(rating),
      understoodRequest: understoodRequest || null,
      waitTimeAcceptable: waitTimeAcceptable || null,
      wouldRecommend: wouldRecommend || null,
      comment: comment || null,
      hasPhoto: !!hasPhoto,
      photoUrl: photoUrl || null,
      createdAt: new Date()
    };

    await db.insert(schema.reviews).values(newReview);

    // Update appointment if appointmentId present
    if (appointmentId) {
      await db.update(schema.appointments)
        .set({ isReviewed: true })
        .where(eq(schema.appointments.id, appointmentId));
    }

    res.json({ success: true, message: 'Avaliação enviada com sucesso! Obrigado pelo feedback.' });
  } catch (e: any) {
    return handleError(res, e, 'POST /api/reviews');
  }
});
