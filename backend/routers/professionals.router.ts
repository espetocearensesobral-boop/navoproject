import express from 'express';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db, isDbConnected } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { JWT_SECRET } from '../config/env.js';
import { professionalPayloadSchema } from '../utils/validation.js';

export const professionalsRouter = express.Router();

professionalsRouter.get('/', async (req: any, res) => {
  const authHeader = req.headers.authorization;
  const token = req.cookies?.token || (authHeader && authHeader.split(' ')[1]);
  if (!token) res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
  try {
    let isAdmin = false;
    if (token) {
      try { isAdmin = (jwt.verify(token, JWT_SECRET) as any).role === 'admin'; } catch {}
    }
    const professionals = isDbConnected && db
      ? await db.query.professionals.findMany(isAdmin ? undefined : { where: eq(schema.professionals.isActive, true) })
      : [];
    const safe = isAdmin ? professionals : professionals.map((p: any) => ({
      id: p.id,
      name: p.name,
      nickname: p.nickname,
      roleTitle: p.roleTitle,
      rating: p.rating,
      reviewsCount: p.reviewsCount,
      photoUrl: p.photoUrl,
      specialties: p.specialties,
      isActive: p.isActive,
      workingHours: p.workingHours,
    }));
    res.json(safe);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

professionalsRouter.post('/', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = professionalPayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados de profissional inválidos.', details: parsed.error.flatten() });
    const id = typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : `prof_${crypto.randomUUID()}`;
    const [created] = await db.insert(schema.professionals).values({ id, ...parsed.data }).onConflictDoNothing().returning();
    if (!created) return res.status(409).json({ error: 'Já existe um profissional com este identificador.' });
    res.status(201).json(created);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

professionalsRouter.put('/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = professionalPayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados de profissional inválidos.', details: parsed.error.flatten() });
    const [updated] = await db.update(schema.professionals)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(schema.professionals.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Profissional não encontrado.' });
    res.json(updated);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

professionalsRouter.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const deleted = await db.delete(schema.professionals).where(eq(schema.professionals.id, req.params.id)).returning({ id: schema.professionals.id });
    if (deleted.length === 0) return res.status(404).json({ error: 'Profissional não encontrado.' });
    res.json({ success: true });
  } catch (e: any) {
    if (e?.code === '23503' || e?.message?.includes('violates foreign key constraint')) {
      return res.status(409).json({ error: 'Não é possível excluir profissional vinculado a reservas.' });
    }
    return handleError(res, e, req.path);
  }
});
