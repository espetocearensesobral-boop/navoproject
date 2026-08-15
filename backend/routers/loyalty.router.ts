import express from 'express';
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { getTodayStringBRT } from '../utils/datetime.js';
import { handleError } from '../utils/index.js';
import {
  expirePointsForClient,
  expirePointsInTransaction,
  getLoyaltyConfig,
  listLoyaltyTiers,
  refreshProfileTierInTransaction,
  resolveNextTier,
  resolveTier,
} from '../services/loyalty-engine.service.js';

export const loyaltyRouter = express.Router();

const pointsSchema = (value: unknown) => {
  const points = Number(value);
  return Number.isInteger(points) && Math.abs(points) <= 100000000 ? points : null;
};

const tierPayloadSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(60),
  minimumPoints: z.coerce.number().int().min(0).max(100000000),
  multiplier: z.coerce.number().min(0.1).max(20),
  displayOrder: z.coerce.number().int().min(0).max(1000),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  isActive: z.coerce.boolean().default(true),
});

const configPayloadSchema = z.object({
  currencyPerPoint: z.coerce.number().min(0.01).max(100000).optional(),
  pointsValidityDays: z.coerce.number().int().min(0).max(3650).optional(),
  tierMultipliers: z.record(z.string(), z.coerce.number().min(0.1).max(20)).optional(),
  referralPoints: z.object({
    referrerBonus: z.coerce.number().int().min(0).max(100000000).optional(),
    referredBonus: z.coerce.number().int().min(0).max(100000000).optional(),
    milestoneCount: z.coerce.number().int().min(1).max(100000).optional(),
    milestoneBonus: z.coerce.number().int().min(0).max(100000000).optional(),
  }).partial().optional(),
  reviewPoints: z.object({
    baseReview: z.coerce.number().int().min(0).max(100000000).optional(),
    withPhotoBonus: z.coerce.number().int().min(0).max(100000000).optional(),
    fiveStarBonus: z.coerce.number().int().min(0).max(100000000).optional(),
  }).partial().optional(),
  birthdayBonus: z.coerce.number().int().min(0).max(100000000).optional(),
}).strict();

const refreshClientTier = async (clientId: string) => {
  await expirePointsForClient(db, clientId);
  return db.transaction((tx: any) => refreshProfileTierInTransaction(tx, clientId));
};

loyaltyRouter.get('/me', requireAuth, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    await refreshClientTier(req.user.id);
    const user = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, req.user.id) });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    const tiers = await listLoyaltyTiers(db);
    const config = await getLoyaltyConfig(db);
    const currentPoints = Number(user.loyaltyPoints || 0);
    const currentTier = resolveTier(tiers, currentPoints);
    const nextTier = resolveNextTier(tiers, currentPoints);
    const completedReferrals = await db.select().from(schema.referrals).where(and(
      eq(schema.referrals.referrerId, req.user.id),
      eq(schema.referrals.status, 'completed'),
    ));
    const transactions = await db.select().from(schema.pointTransactions)
      .where(eq(schema.pointTransactions.clientId, req.user.id))
      .orderBy(desc(schema.pointTransactions.createdAt));
    const pendingReviews = await db.select().from(schema.appointments).where(and(
      eq(schema.appointments.clientId, req.user.id),
      eq(schema.appointments.status, 'completed'),
      eq(schema.appointments.isReviewed, false),
    ));
    const tierProgress = nextTier
      ? Math.min(100, Math.max(0, Math.round(((currentPoints - currentTier.minimumPoints) / Math.max(1, nextTier.minimumPoints - currentTier.minimumPoints)) * 100)))
      : 100;

    res.json({
      loyaltyPoints: currentPoints,
      loyaltyTier: currentTier.name,
      tierMultiplier: config.tierMultipliers[currentTier.name] ?? currentTier.multiplier,
      currentTier,
      nextTier,
      pointsToNextTier: nextTier ? Math.max(0, nextTier.minimumPoints - currentPoints) : 0,
      tierProgress,
      referralCode: user.referralCode || '',
      birthday: user.birthday || null,
      tiers,
      transactions: transactions.map((item: any) => ({
        id: item.id,
        amount: item.amount,
        type: item.type,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        description: item.description,
        expiresAt: item.expiresAt,
        createdAt: item.createdAt,
      })),
      pendingReviews,
      referralStats: {
        totalInvited: (await db.select().from(schema.referrals).where(eq(schema.referrals.referrerId, req.user.id))).length,
        completedCount: completedReferrals.length,
        pointsEarned: completedReferrals.reduce((acc: number, item: any) => acc + Number(item.pointsAwarded || 0), 0),
      },
    });
  } catch (e: any) {
    return handleError(res, e, 'GET /api/loyalty/me');
  }
});

loyaltyRouter.get('/tiers', async (_req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    res.json(await listLoyaltyTiers(db));
  } catch (e: any) {
    return handleError(res, e, 'GET /api/loyalty/tiers');
  }
});

loyaltyRouter.get('/admin/tiers', requireAuth, requireAdmin, async (_req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    res.json(await listLoyaltyTiers(db, true));
  } catch (e: any) {
    return handleError(res, e, 'GET /api/loyalty/admin/tiers');
  }
});

loyaltyRouter.put('/admin/tiers', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    const parsed = z.object({ tiers: z.array(tierPayloadSchema).min(1).max(20) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados de níveis inválidos.', details: parsed.error.flatten() });
    const tiers = parsed.data.tiers;
    if (!tiers.some((tier) => tier.isActive && tier.minimumPoints === 0)) return res.status(400).json({ error: 'Mantenha pelo menos um nível ativo começando em zero pontos.' });
    if (new Set(tiers.map((tier) => tier.name.toLowerCase())).size !== tiers.length) return res.status(400).json({ error: 'Os nomes dos níveis não podem se repetir.' });
    if (new Set(tiers.filter((tier) => tier.isActive).map((tier) => tier.minimumPoints)).size !== tiers.filter((tier) => tier.isActive).length) return res.status(400).json({ error: 'Os limites de pontos dos níveis ativos não podem se repetir.' });

    await db.transaction(async (tx: any) => {
      for (const tier of tiers) {
        const id = tier.id || `tier_${tier.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        await tx.insert(schema.loyaltyTiers).values({
          id,
          name: tier.name,
          minimumPoints: tier.minimumPoints,
          multiplier: tier.multiplier.toFixed(2),
          displayOrder: tier.displayOrder,
          color: tier.color || null,
          isActive: tier.isActive,
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: schema.loyaltyTiers.id,
          set: {
            name: tier.name,
            minimumPoints: tier.minimumPoints,
            multiplier: tier.multiplier.toFixed(2),
            displayOrder: tier.displayOrder,
            color: tier.color || null,
            isActive: tier.isActive,
            updatedAt: new Date(),
          },
        });
      }
    });
    res.json({ success: true, tiers: await listLoyaltyTiers(db, true) });
  } catch (e: any) {
    return handleError(res, e, 'PUT /api/loyalty/admin/tiers');
  }
});

loyaltyRouter.post('/redeem', requireAuth, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    const rewardId = typeof req.body?.rewardId === 'string' ? req.body.rewardId.trim() : '';
    if (!rewardId) return res.status(400).json({ error: 'Recompensa inválida.' });
    const reward = await db.query.rewards.findFirst({ where: eq(schema.rewards.id, rewardId) });
    if (!reward || !reward.isActive) return res.status(404).json({ error: 'Recompensa não encontrada ou inativa.' });

    const redemptionId = `red_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.transaction(async (tx: any) => {
      await expirePointsInTransaction(tx, req.user.id);
      const updated = await tx.update(schema.profiles)
        .set({ loyaltyPoints: sql`${schema.profiles.loyaltyPoints} - ${reward.pointsRequired}`, updatedAt: new Date() })
        .where(and(eq(schema.profiles.id, req.user.id), gte(schema.profiles.loyaltyPoints, reward.pointsRequired)))
        .returning({ id: schema.profiles.id });
      if (updated.length === 0) throw new Error('INSUFFICIENT_POINTS');
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
        sourceType: 'redemption',
        sourceId: redemptionId,
        description: `Resgate: ${reward.title}`,
        sourceKey: `redemption:${redemptionId}`,
        expiresAt: null,
      });
      await refreshProfileTierInTransaction(tx, req.user.id);
    });
    res.json({ success: true, message: 'Recompensa resgatada com sucesso.', redemptionId, redemptionCode: redemptionId });
  } catch (e: any) {
    if (e?.message === 'INSUFFICIENT_POINTS') return res.status(400).json({ error: 'Pontos insuficientes.' });
    if (e?.code === '23505') return res.status(409).json({ error: 'Este resgate já foi processado.' });
    return handleError(res, e, 'POST /api/loyalty/redeem');
  }
});

loyaltyRouter.post('/checkin-instagram', requireAuth, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    const sourceKey = `instagram-checkin:${req.user.id}:${getTodayStringBRT()}`;
    let inserted = false;
    await db.transaction(async (tx: any) => {
      await expirePointsInTransaction(tx, req.user.id);
      const rows = await tx.insert(schema.pointTransactions).values({
        id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        clientId: req.user.id,
        amount: 10,
        type: 'checkin',
        sourceType: 'engagement',
        sourceId: sourceKey,
        description: 'Check-in Instagram',
        sourceKey,
        expiresAt: null,
      }).onConflictDoNothing({ target: schema.pointTransactions.sourceKey }).returning({ id: schema.pointTransactions.id });
      if (rows.length === 0) return;
      inserted = true;
      await tx.update(schema.profiles)
        .set({ loyaltyPoints: sql`${schema.profiles.loyaltyPoints} + 10`, updatedAt: new Date() })
        .where(eq(schema.profiles.id, req.user.id));
      await refreshProfileTierInTransaction(tx, req.user.id);
    });
    if (!inserted) return res.status(409).json({ error: 'O check-in de hoje já foi registrado.' });
    res.json({ success: true, pointsEarned: 10, message: 'Check-in realizado com sucesso!' });
  } catch (e: any) {
    return handleError(res, e, 'POST /api/loyalty/checkin-instagram');
  }
});

loyaltyRouter.get('/admin/dashboard', requireAuth, requireAdmin, async (_req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    const rows = await db.select().from(schema.pointTransactions);
    const redemptions = await db.select().from(schema.loyaltyRedemptions).orderBy(desc(schema.loyaltyRedemptions.createdAt));
    const issued = rows.filter((row: any) => row.amount > 0).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
    const redeemed = rows.filter((row: any) => row.amount < 0).reduce((sum: number, row: any) => sum + Math.abs(Number(row.amount || 0)), 0);
    const profiles = await db.select().from(schema.profiles).where(eq(schema.profiles.role, 'client'));
    const tiers = await listLoyaltyTiers(db);
    const tierDistribution = profiles.reduce((acc: Record<string, number>, profile: any) => {
      const tier = resolveTier(tiers, Number(profile.loyaltyPoints || 0)).name;
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {});
    const topClients = profiles
      .sort((a: any, b: any) => Number(b.loyaltyPoints || 0) - Number(a.loyaltyPoints || 0))
      .slice(0, 5)
      .map((profile: any) => ({ id: profile.id, name: profile.name, points: Number(profile.loyaltyPoints || 0), tier: resolveTier(tiers, Number(profile.loyaltyPoints || 0)).name }));
    res.json({
      recentRedemptions: redemptions.slice(0, 20),
      stats: { totalPointsIssued: issued, totalPointsRedeemed: redeemed, topClients },
      totalIssued: issued,
      totalRedeemed: redeemed,
      tierDistribution,
      topClients,
    });
  } catch (e: any) {
    return handleError(res, e, 'GET /api/loyalty/admin/dashboard');
  }
});

loyaltyRouter.post('/admin/campaign-inactives', requireAuth, requireAdmin, (_req: any, res: any) => {
  res.status(501).json({ error: 'Campanha ainda não possui integração de envio persistente.' });
});

loyaltyRouter.post('/admin/manual-points', requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    const clientId = typeof req.body?.clientId === 'string' ? req.body.clientId.trim() : '';
    const points = pointsSchema(req.body?.points);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!clientId || points === null || points === 0 || !reason || reason.length > 500) {
      return res.status(400).json({ error: 'Cliente, pontos diferentes de zero e motivo são obrigatórios.' });
    }
    const user = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, clientId) });
    if (!user) return res.status(404).json({ error: 'Cliente não encontrado.' });

    const adjustmentId = `adj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const config = await getLoyaltyConfig(db);
    let nextBalance = 0;
    await db.transaction(async (tx: any) => {
      await expirePointsInTransaction(tx, clientId);
      const currentRows = await tx.select({ points: schema.profiles.loyaltyPoints }).from(schema.profiles).where(eq(schema.profiles.id, clientId)).limit(1);
      const currentPoints = Number(currentRows[0]?.points || 0);
      if (currentPoints + points < 0) throw new Error('INSUFFICIENT_POINTS');
      const validity = points > 0 && config.pointsValidityDays > 0
        ? new Date(Date.now() + config.pointsValidityDays * 86400000)
        : null;
      await tx.update(schema.profiles)
        .set({ loyaltyPoints: sql`${schema.profiles.loyaltyPoints} + ${points}`, updatedAt: new Date() })
        .where(eq(schema.profiles.id, clientId));
      await tx.insert(schema.pointTransactions).values({
        id: `pt_${adjustmentId}`,
        clientId,
        amount: points,
        type: 'manual_adjustment',
        sourceType: 'manual_adjustment',
        sourceId: adjustmentId,
        description: reason,
        sourceKey: `manual:${adjustmentId}`,
        expiresAt: validity,
      });
      await refreshProfileTierInTransaction(tx, clientId);
      nextBalance = currentPoints + points;
    });
    res.json({ success: true, message: 'Pontos ajustados.', adjustmentId, loyaltyPoints: nextBalance });
  } catch (e: any) {
    if (e?.message === 'INSUFFICIENT_POINTS') return res.status(400).json({ error: 'O ajuste não pode deixar o saldo negativo.' });
    return handleError(res, e, 'POST /api/loyalty/admin/manual-points');
  }
});
