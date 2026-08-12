import express from 'express';
import { eq, asc } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';

export const rewardsRouter = express.Router();

// GET /api/rewards - List all active rewards
rewardsRouter.get('/', async (req: any, res: any) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    }
    const rows = await db
      .select()
      .from(schema.rewards)
      .where(eq(schema.rewards.isActive, true))
      .orderBy(asc(schema.rewards.pointsRequired));
    res.json(rows);
  } catch (e: any) {
    return handleError(res, e, 'GET /api/rewards');
  }
});

// POST /api/rewards/admin/create - Create reward (Admin)
rewardsRouter.post('/admin/create', requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    }
    const { title, pointsRequired, rewardType, valueDescription, icon } = req.body;
    if (!title || !pointsRequired || !rewardType || !valueDescription) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }
    const newReward = {
      id: `rw_${Date.now()}`,
      title,
      pointsRequired: Number(pointsRequired),
      rewardType,
      valueDescription,
      icon: icon || 'Gift',
      isActive: true,
      createdAt: new Date()
    };
    await db.insert(schema.rewards).values(newReward);
    res.json({ success: true, reward: newReward });
  } catch (e: any) {
    return handleError(res, e, 'POST /api/rewards/admin/create');
  }
});

// DELETE /api/rewards/admin/:id - Delete reward (Admin)
rewardsRouter.delete('/admin/:id', requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    }
    const { id } = req.params;
    await db.delete(schema.rewards).where(eq(schema.rewards.id, id));
    res.json({ success: true, message: 'Recompensa removida com sucesso.' });
  } catch (e: any) {
    return handleError(res, e, 'DELETE /api/rewards/admin/:id');
  }
});
