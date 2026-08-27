import express from 'express';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const subscriptionsRouter = express.Router();

subscriptionsRouter.get('/plans', async (req, res) => {
  try {
    const plans = await db.select().from(schema.subscriptionPlans);
    res.json(plans);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

subscriptionsRouter.post('/plans', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = `plan_${Date.now()}`;
    const [inserted] = await db.insert(schema.subscriptionPlans).values({ ...req.body, id }).returning();
    res.json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

subscriptionsRouter.put('/plans/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [updated] = await db.update(schema.subscriptionPlans).set(req.body).where(eq(schema.subscriptionPlans.id, req.params.id)).returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

subscriptionsRouter.delete('/plans/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.delete(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

subscriptionsRouter.get('/members', requireAuth, requireAdmin, async (req, res) => {
  try {
    const members = await db.select().from(schema.subscriptionMembers);
    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

subscriptionsRouter.post('/members', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = `mem_${Date.now()}`;
    const [inserted] = await db.insert(schema.subscriptionMembers).values({ ...req.body, id }).returning();
    res.json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
