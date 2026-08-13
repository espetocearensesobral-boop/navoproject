import express from 'express';
import crypto from 'crypto';
import { asc, eq } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { rewardPayloadSchema } from '../utils/validation.js';

export const rewardsRouter = express.Router();

rewardsRouter.get('/', async (_req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    res.json(await db.select().from(schema.rewards).where(eq(schema.rewards.isActive, true)).orderBy(asc(schema.rewards.pointsRequired)));
  } catch (e: any) {
    return handleError(res, e, 'GET /api/rewards');
  }
});

rewardsRouter.post('/admin/create', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = rewardPayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados de recompensa inválidos.', details: parsed.error.flatten() });
    const id = typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : `rw_${crypto.randomUUID()}`;
    const [reward] = await db.insert(schema.rewards).values({ id, ...parsed.data }).onConflictDoNothing().returning();
    if (!reward) return res.status(409).json({ error: 'Já existe uma recompensa com este identificador.' });
    res.status(201).json({ success: true, reward });
  } catch (e: any) {
    return handleError(res, e, 'POST /api/rewards/admin/create');
  }
});

rewardsRouter.put('/admin/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = rewardPayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados de recompensa inválidos.', details: parsed.error.flatten() });
    const [reward] = await db.update(schema.rewards)
      .set(parsed.data)
      .where(eq(schema.rewards.id, req.params.id))
      .returning();
    if (!reward) return res.status(404).json({ error: 'Recompensa não encontrada.' });
    res.json({ success: true, reward });
  } catch (e: any) {
    return handleError(res, e, 'PUT /api/rewards/admin/:id');
  }
});

rewardsRouter.patch('/admin/:id/status', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    if (typeof req.body?.isActive !== 'boolean') return res.status(400).json({ error: 'isActive deve ser booleano.' });
    const [reward] = await db.update(schema.rewards)
      .set({ isActive: req.body.isActive })
      .where(eq(schema.rewards.id, req.params.id))
      .returning();
    if (!reward) return res.status(404).json({ error: 'Recompensa não encontrada.' });
    res.json({ success: true, reward });
  } catch (e: any) {
    return handleError(res, e, 'PATCH /api/rewards/admin/:id/status');
  }
});

rewardsRouter.delete('/admin/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const [reward] = await db.update(schema.rewards)
      .set({ isActive: false })
      .where(eq(schema.rewards.id, req.params.id))
      .returning();
    if (!reward) return res.status(404).json({ error: 'Recompensa não encontrada.' });
    res.json({ success: true, message: 'Recompensa desativada com sucesso.' });
  } catch (e: any) {
    return handleError(res, e, 'DELETE /api/rewards/admin/:id');
  }
});
