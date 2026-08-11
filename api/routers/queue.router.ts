import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';

export const queueRouter = express.Router();

queueRouter.get("/", requireAuth, async (req: any, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;

    let dbQueue = await db.query.waitingQueue.findMany();
    if (!isAdmin) {
      dbQueue = dbQueue.filter((q: any) => q.clientId === userId);
    }
    return res.json(dbQueue);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

queueRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const newItem = { id: req.body.id || `q_${Date.now()}`, joinedAt: new Date(), ...req.body };
    await db.insert(schema.waitingQueue).values(newItem);
    res.json(newItem);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

queueRouter.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.update(schema.waitingQueue).set({ ...req.body }).where(eq(schema.waitingQueue.id, req.params.id));
    res.json({ id: req.params.id, ...req.body });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

queueRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.delete(schema.waitingQueue).where(eq(schema.waitingQueue.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});
