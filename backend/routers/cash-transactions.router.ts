import express from 'express';
import crypto from 'crypto';
import { eq, desc } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { cashTransactionPayloadSchema } from '../utils/validation.js';

export const cashTransactionsRouter = express.Router();

cashTransactionsRouter.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json(await db.query.cashTransactions.findMany({ orderBy: [desc(schema.cashTransactions.createdAt)] }));
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

cashTransactionsRouter.post('/', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = cashTransactionPayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados financeiros inválidos.', details: parsed.error.flatten() });
    const id = typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : `tx_${crypto.randomUUID()}`;
    const [created] = await db.insert(schema.cashTransactions)
      .values({ id, ...parsed.data, createdAt: new Date() })
      .onConflictDoNothing()
      .returning();
    if (!created) return res.status(409).json({ error: 'Já existe um lançamento com este identificador.' });
    res.status(201).json(created);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

cashTransactionsRouter.put('/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = cashTransactionPayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados financeiros inválidos.', details: parsed.error.flatten() });
    const [updated] = await db.update(schema.cashTransactions)
      .set({ ...parsed.data })
      .where(eq(schema.cashTransactions.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Lançamento não encontrado.' });
    res.json(updated);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

cashTransactionsRouter.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const deleted = await db.delete(schema.cashTransactions).where(eq(schema.cashTransactions.id, req.params.id)).returning({ id: schema.cashTransactions.id });
    if (deleted.length === 0) return res.status(404).json({ error: 'Lançamento não encontrado.' });
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});
