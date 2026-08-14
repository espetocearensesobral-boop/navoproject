import express from 'express';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { queuePayloadSchema } from '../utils/validation.js';

export const queueRouter = express.Router();

queueRouter.get('/', requireAuth, async (req: any, res) => {
  try {
    let dbQueue = await db.query.waitingQueue.findMany();
    if (req.user.role !== 'admin') dbQueue = dbQueue.filter((q: any) => q.clientId === req.user.id);
    res.json(dbQueue);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

queueRouter.post('/', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = queuePayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados da fila inválidos.', details: parsed.error.flatten() });
    const id = typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : `q_${crypto.randomUUID()}`;
    const [created] = await db.insert(schema.waitingQueue)
      .values({ id, joinedAt: new Date(), ...parsed.data, updatedAt: new Date() })
      .onConflictDoNothing()
      .returning();
    if (!created) return res.status(409).json({ error: 'Já existe um item com este identificador.' });
    res.status(201).json(created);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

queueRouter.put('/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = queuePayloadSchema.omit({ id: true }).partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados da fila inválidos.', details: parsed.error.flatten() });
    const [updated] = await db.update(schema.waitingQueue)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(schema.waitingQueue.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Item da fila não encontrado.' });
    res.json(updated);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

queueRouter.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const deleted = await db.delete(schema.waitingQueue).where(eq(schema.waitingQueue.id, req.params.id)).returning({ id: schema.waitingQueue.id });
    if (deleted.length === 0) return res.status(404).json({ error: 'Item da fila não encontrado.' });
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});
