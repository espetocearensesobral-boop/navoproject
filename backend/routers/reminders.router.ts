import express from 'express';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const remindersRouter = express.Router();

remindersRouter.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const logs = await db.select().from(schema.appointmentReminders);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

remindersRouter.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = `rem_${Date.now()}`;
    const [inserted] = await db.insert(schema.appointmentReminders).values({ ...req.body, id }).returning();
    res.json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

remindersRouter.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [updated] = await db.update(schema.appointmentReminders).set(req.body).where(eq(schema.appointmentReminders.id, req.params.id)).returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
