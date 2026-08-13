import express from 'express';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { getTodayStringBRT } from '../utils/datetime.js';

export const loyaltyRouter = express.Router();

const pointsSchema = (value: unknown) => {
  const points = Number(value);
  return Number.isInteger(points) && Math.abs(points) <= 100000000 ? points : null;
};

loyaltyRouter.get('/me', requireAuth, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const user = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, req.user.id) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const referralsList = await db.select().from(schema.referrals).where(eq(schema.referrals.referrerId, req.user.id));
    const completed = referralsList.filter((r: any) => r.status === 'completed');
    const points = completed.reduce((acc: number, r: any) => acc + (r.pointsAwarded || 0), 0);
    const transactions = await db.select().from(schema.pointTransactions)
      .where(eq(schema.pointTransactions.clientId, req.user.id));
    const pendingReviews = await db.select().from(schema.appointments).where(and(
      eq(schema.appointments.clientId, req.user.id),
      eq(schema.appointments.status, 'completed'),
      eq(schema.appointments.isReviewed, false),
    ));

    res.json({
      loyaltyPoints: user.loyaltyPoints || 0,
      loyaltyTier: user.loyaltyTier || 'Bronze',
      referralCode: user.referralCode || '',
      transactions: transactions.map((item: any) => ({
        id: item.id,
        amount: item.amount,
        type: item.type,
        description: item.description,
        createdAt: item.createdAt,
      })),
      pendingReviews,
      referralStats: {
        totalInvited: referralsList.length,
        completedCount: completed.length,
        pointsEarned: points,
      },
    });
  } catch (e) {
    console.error('[LOYALTY] Failed to load customer data:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

loyaltyRouter.post('/redeem', requireAuth, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const rewardId = typeof req.body?.rewardId === 'string' ? req.body.rewardId.trim() : '';
    if (!rewardId) return res.status(400).json({ error: 'Recompensa inválida.' });
    const reward = await db.query.rewards.findFirst({ where: eq(schema.rewards.id, rewardId) });
    if (!reward || !reward.isActive) return res.status(404).json({ error: 'Recompensa não encontrada ou inativa' });

    const redemptionId = `red_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.transaction(async (tx: any) => {
      const updated = await tx.update(schema.profiles)
        .set({
          loyaltyPoints: sql`${schema.profiles.loyaltyPoints} - ${reward.pointsRequired}`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(schema.profiles.id, req.user.id),
          gte(schema.profiles.loyaltyPoints, reward.pointsRequired),
        ))
        .returning({ id: schema.profiles.id });
      if (updated.length === 0) {
        throw new Error('INSUFFICIENT_POINTS');
      }
      await tx.insert(schema.loyaltyRedemptions).values({
        id: redemptionId,
        clientId: req.user.id,
        rewardId,
        points: reward.pointsRequired,
        status: 'completed',
      });
      await tx.insert(schema.pointTransactions).values({
        id: `pt_${redemptionId}`,
        clientId: req.user.id,
        amount: -reward.pointsRequired,
        type: 'redemption',
        description: `Resgate: ${reward.title}`,
        sourceKey: `redemption:${redemptionId}`,
      });
    });
    res.json({ success: true, message: 'Recompensa resgatada com sucesso', redemptionId });
  } catch (e: any) {
    if (e?.message === 'INSUFFICIENT_POINTS') return res.status(400).json({ error: 'Pontos insuficientes' });
    if (e?.code === '23505') return res.status(409).json({ error: 'Este resgate já foi processado.' });
    console.error('[LOYALTY] Failed to redeem reward:', e);
    res.status(500).json({ error: 'Não foi possível concluir o resgate.' });
  }
});

loyaltyRouter.post('/checkin-instagram', requireAuth, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const sourceKey = `instagram-checkin:${req.user.id}:${getTodayStringBRT()}`;
    let inserted = false;
    await db.transaction(async (tx: any) => {
      const rows = await tx.insert(schema.pointTransactions).values({
        id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        clientId: req.user.id,
        amount: 10,
        type: 'checkin',
        description: 'Check-in Instagram',
        sourceKey,
      }).onConflictDoNothing({ target: schema.pointTransactions.sourceKey }).returning({ id: schema.pointTransactions.id });
      if (rows.length === 0) return;
      inserted = true;
      await tx.update(schema.profiles)
        .set({ loyaltyPoints: sql`${schema.profiles.loyaltyPoints} + 10`, updatedAt: new Date() })
        .where(eq(schema.profiles.id, req.user.id));
    });
    if (!inserted) return res.status(409).json({ error: 'O check-in de hoje já foi registrado.' });
    res.json({ success: true, pointsEarned: 10, message: 'Check-in realizado com sucesso!' });
  } catch (e) {
    console.error('[LOYALTY] Failed to register check-in:', e);
    res.status(500).json({ error: 'Não foi possível registrar o check-in.' });
  }
});

loyaltyRouter.get('/admin/dashboard', requireAuth, requireAdmin, async (_req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const rows = await db.select().from(schema.pointTransactions);
    const redemptions = await db.select().from(schema.loyaltyRedemptions);
    const issued = rows.filter((row: any) => row.amount > 0).reduce((sum: number, row: any) => sum + row.amount, 0);
    const redeemed = redemptions.reduce((sum: number, row: any) => sum + row.points, 0);
    res.json({
      recentRedemptions: redemptions.slice(-20).reverse(),
      stats: { totalPointsIssued: issued, totalPointsRedeemed: redeemed, topClients: [] },
    });
  } catch (e) {
    console.error('[LOYALTY] Failed to load admin dashboard:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

loyaltyRouter.post('/admin/campaign-inactives', requireAuth, requireAdmin, (_req: any, res: any) => {
  res.status(501).json({ error: 'Campanha ainda não possui integração de envio persistente.' });
});

loyaltyRouter.post('/admin/manual-points', requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const clientId = typeof req.body?.clientId === 'string' ? req.body.clientId.trim() : '';
    const points = pointsSchema(req.body?.points);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!clientId || points === null || points === 0 || !reason || reason.length > 500) {
      return res.status(400).json({ error: 'Cliente, pontos diferentes de zero e motivo são obrigatórios.' });
    }
    const user = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, clientId) });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const adjustmentId = `adj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.transaction(async (tx: any) => {
      await tx.update(schema.profiles)
        .set({ loyaltyPoints: sql`${schema.profiles.loyaltyPoints} + ${points}`, updatedAt: new Date() })
        .where(eq(schema.profiles.id, clientId));
      await tx.insert(schema.pointTransactions).values({
        id: `pt_${adjustmentId}`,
        clientId,
        amount: points,
        type: 'manual_adjustment',
        description: reason,
        sourceKey: `manual:${adjustmentId}`,
      });
    });
    res.json({ success: true, message: 'Pontos ajustados', adjustmentId });
  } catch (e) {
    console.error('[LOYALTY] Failed to adjust points:', e);
    res.status(500).json({ error: 'Não foi possível ajustar os pontos.' });
  }
});
