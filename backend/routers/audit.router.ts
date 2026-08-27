import express from 'express';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { desc } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const auditRouter = express.Router();

auditRouter.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const logs = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(100);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

auditRouter.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = `audit_${Date.now()}`;
    const [inserted] = await db.insert(schema.auditLogs).values({ ...req.body, id }).returning();
    res.json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
