import express from 'express';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { scheduleBlockMutationSchema } from '../utils/validation.js';
import { invalidateAvailabilityCache } from './availability.router.js';

export const scheduleBlocksRouter = express.Router();

scheduleBlocksRouter.get('/', async (_req, res) => {
  try {
    res.json(await db.query.scheduleBlocks.findMany());
  } catch (e: any) {
    return handleError(res, e, '/api/schedule-blocks');
  }
});

scheduleBlocksRouter.post('/', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = scheduleBlockMutationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados de bloqueio inválidos.', details: parsed.error.flatten() });
    const id = typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : `blk_${crypto.randomUUID()}`;
    const [created] = await db.insert(schema.scheduleBlocks)
      .values({ id, ...parsed.data, createdAt: new Date() })
      .onConflictDoNothing()
      .returning();
    if (!created) return res.status(409).json({ error: 'Já existe um bloqueio com este identificador.' });
    invalidateAvailabilityCache();
    res.status(201).json(created);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

scheduleBlocksRouter.put('/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = scheduleBlockMutationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados de bloqueio inválidos.', details: parsed.error.flatten() });
    const [updated] = await db.update(schema.scheduleBlocks)
      .set({ ...parsed.data })
      .where(eq(schema.scheduleBlocks.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Bloqueio não encontrado.' });
    invalidateAvailabilityCache();
    res.json(updated);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

scheduleBlocksRouter.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const deleted = await db.delete(schema.scheduleBlocks).where(eq(schema.scheduleBlocks.id, req.params.id)).returning({ id: schema.scheduleBlocks.id });
    if (deleted.length === 0) return res.status(404).json({ error: 'Bloqueio não encontrado.' });
    invalidateAvailabilityCache();
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});
