import express from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';

export const cashTransactionsRouter = express.Router();

cashTransactionsRouter.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const transactions = await db.query.cashTransactions.findMany({
      orderBy: [desc(schema.cashTransactions.createdAt)]
    });
    res.json(transactions);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

cashTransactionsRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const newTx = { id: req.body.id || `tx_${Date.now()}`, ...req.body };
    await db.insert(schema.cashTransactions).values(newTx).onConflictDoUpdate({
      target: schema.cashTransactions.id,
      set: { ...req.body }
    });
    res.json(newTx);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

cashTransactionsRouter.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const txData = { id: req.params.id, ...req.body };
    await db.insert(schema.cashTransactions).values(txData).onConflictDoUpdate({
      target: schema.cashTransactions.id,
      set: { ...req.body }
    });
    res.json(txData);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

cashTransactionsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.delete(schema.cashTransactions).where(eq(schema.cashTransactions.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});
