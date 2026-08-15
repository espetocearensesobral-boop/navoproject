import express from 'express';
import crypto from 'crypto';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
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

const benefitTypes = ['discount_percent', 'discount_fixed', 'free_service', 'free_product', 'points_bonus', 'priority_queue', 'custom'] as const;
const billingPeriods = ['none', 'monthly', 'quarterly', 'annual'] as const;
const planStatuses = ['draft', 'active', 'archived'] as const;

const benefitPayloadSchema = z.object({
  id: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  benefitType: z.enum(benefitTypes),
  valueAmount: z.number().min(0).max(100000000).nullable().optional(),
  valueText: z.string().trim().max(240).nullable().optional(),
  serviceId: z.string().trim().min(1).max(160).nullable().optional(),
  productId: z.string().trim().min(1).max(160).nullable().optional(),
  usageLimit: z.number().int().min(1).max(1000000).nullable().optional(),
  validityDays: z.number().int().min(1).max(3650).nullable().optional(),
  displayOrder: z.number().int().min(0).max(10000).default(0),
  isActive: z.boolean().default(true),
  tierIds: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
}).strict();

const planPayloadSchema = z.object({
  id: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  price: z.number().min(0).max(100000000).default(0),
  billingPeriod: z.enum(billingPeriods).default('none'),
  pointsBonus: z.number().int().min(0).max(100000000).default(0),
  status: z.enum(planStatuses).default('draft'),
  displayOrder: z.number().int().min(0).max(10000).default(0),
  isFeatured: z.boolean().default(false),
  benefitIds: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
}).strict();

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

const validateBenefitBusinessRules = (payload: any) => {
  if (payload.serviceId && payload.productId) throw new Error('BENEFIT_MULTIPLE_TARGETS');
  if (payload.benefitType === 'discount_percent' && (payload.valueAmount === null || payload.valueAmount === undefined || payload.valueAmount > 100)) throw new Error('BENEFIT_PERCENT_INVALID');
  if (payload.benefitType === 'free_service' && !payload.serviceId) throw new Error('BENEFIT_SERVICE_REQUIRED');
  if (payload.benefitType === 'free_product' && !payload.productId) throw new Error('BENEFIT_PRODUCT_REQUIRED');
  if (payload.benefitType === 'points_bonus' && (!Number.isInteger(payload.valueAmount) || Number(payload.valueAmount) <= 0)) throw new Error('BENEFIT_POINTS_INVALID');
};

const serializeBenefit = (benefit: any, tierIds: string[] = []) => ({
  id: benefit.id,
  name: benefit.name,
  description: benefit.description,
  benefitType: benefit.benefitType,
  valueAmount: benefit.valueAmount === null || benefit.valueAmount === undefined ? null : Number(benefit.valueAmount),
  valueText: benefit.valueText || null,
  serviceId: benefit.serviceId || null,
  productId: benefit.productId || null,
  usageLimit: benefit.usageLimit === null || benefit.usageLimit === undefined ? null : Number(benefit.usageLimit),
  validityDays: benefit.validityDays === null || benefit.validityDays === undefined ? null : Number(benefit.validityDays),
  displayOrder: Number(benefit.displayOrder || 0),
  isActive: Boolean(benefit.isActive),
  tierIds,
});

const loadLoyaltyCatalog = async (dbLike: any, includeInactive = false) => {
  const [benefitRows, planRows, tierBenefitRows, planBenefitRows, tiers] = await Promise.all([
    dbLike.select().from(schema.loyaltyBenefits).orderBy(asc(schema.loyaltyBenefits.displayOrder), asc(schema.loyaltyBenefits.name)),
    dbLike.select().from(schema.loyaltyPlans).orderBy(asc(schema.loyaltyPlans.displayOrder), asc(schema.loyaltyPlans.name)),
    dbLike.select().from(schema.loyaltyTierBenefits),
    dbLike.select().from(schema.loyaltyPlanBenefits),
    listLoyaltyTiers(dbLike, includeInactive),
  ]);
  const benefitTierMap = new Map<string, string[]>();
  for (const link of tierBenefitRows) benefitTierMap.set(link.benefitId, [...(benefitTierMap.get(link.benefitId) || []), link.tierId]);
  const benefits = benefitRows
    .filter((benefit: any) => includeInactive || benefit.isActive)
    .map((benefit: any) => serializeBenefit(benefit, benefitTierMap.get(benefit.id) || []));
  const planBenefitMap = new Map<string, string[]>();
  for (const link of planBenefitRows) planBenefitMap.set(link.planId, [...(planBenefitMap.get(link.planId) || []), link.benefitId]);
  const plans = planRows
    .filter((plan: any) => includeInactive || plan.status === 'active')
    .map((plan: any) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: Number(plan.price || 0),
      billingPeriod: plan.billingPeriod,
      pointsBonus: Number(plan.pointsBonus || 0),
      status: plan.status,
      displayOrder: Number(plan.displayOrder || 0),
      isFeatured: Boolean(plan.isFeatured),
      benefitIds: planBenefitMap.get(plan.id) || [],
    }));
  return { tiers, benefits, plans };
};

loyaltyRouter.get('/catalog', async (_req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    res.json(await loadLoyaltyCatalog(db));
  } catch (e: any) {
    return handleError(res, e, 'GET /api/loyalty/catalog');
  }
});

loyaltyRouter.get('/admin/catalog', requireAuth, requireAdmin, async (_req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    res.json(await loadLoyaltyCatalog(db, true));
  } catch (e: any) {
    return handleError(res, e, 'GET /api/loyalty/admin/catalog');
  }
});

const validateRelatedIds = async (tx: any, ids: string[], table: any, label: string) => {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return uniqueIds;
  const rows = await tx.select({ id: table.id }).from(table).where(inArray(table.id, uniqueIds));
  if (rows.length !== uniqueIds.length) throw new Error(`${label.toUpperCase()}_NOT_FOUND`);
  return uniqueIds;
};

loyaltyRouter.post('/admin/benefits', requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    const parsed = benefitPayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados do benefício inválidos.', details: parsed.error.flatten() });
    const payload = parsed.data;
    try { validateBenefitBusinessRules(payload); } catch (error: any) {
      const messages: Record<string, string> = { BENEFIT_MULTIPLE_TARGETS: 'Vincule o benefício a um serviço ou a um produto, não aos dois.', BENEFIT_PERCENT_INVALID: 'O desconto percentual deve estar entre 0 e 100.', BENEFIT_SERVICE_REQUIRED: 'Selecione o serviço do benefício grátis.', BENEFIT_PRODUCT_REQUIRED: 'Selecione o produto do benefício grátis.', BENEFIT_POINTS_INVALID: 'O bônus de pontos deve ser um número inteiro positivo.' };
      return res.status(400).json({ error: messages[error.message] || 'Regra de benefício inválida.' });
    }
    const id = `benefit_${crypto.randomUUID()}`;
    await db.transaction(async (tx: any) => {
      const tierIds = await validateRelatedIds(tx, payload.tierIds, schema.loyaltyTiers, 'tier');
      await tx.insert(schema.loyaltyBenefits).values({ id, name: payload.name, description: payload.description, benefitType: payload.benefitType, valueAmount: payload.valueAmount === null || payload.valueAmount === undefined ? null : payload.valueAmount.toFixed(2), valueText: payload.valueText || null, serviceId: payload.serviceId || null, productId: payload.productId || null, usageLimit: payload.usageLimit ?? null, validityDays: payload.validityDays ?? null, displayOrder: payload.displayOrder, isActive: payload.isActive, updatedAt: new Date() });
      if (tierIds.length) await tx.insert(schema.loyaltyTierBenefits).values(tierIds.map((tierId, index) => ({ tierId, benefitId: id, displayOrder: index })));
    });
    res.status(201).json({ success: true, id, message: 'Benefício criado com sucesso.' });
  } catch (e: any) {
    if (e?.message === 'TIER_NOT_FOUND') return res.status(400).json({ error: 'Um dos níveis selecionados não existe.' });
    return handleError(res, e, 'POST /api/loyalty/admin/benefits');
  }
});

loyaltyRouter.put('/admin/benefits/:id', requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    const parsed = benefitPayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados do benefício inválidos.', details: parsed.error.flatten() });
    const payload = parsed.data;
    try { validateBenefitBusinessRules(payload); } catch (error: any) {
      const messages: Record<string, string> = { BENEFIT_MULTIPLE_TARGETS: 'Vincule o benefício a um serviço ou a um produto, não aos dois.', BENEFIT_PERCENT_INVALID: 'O desconto percentual deve estar entre 0 e 100.', BENEFIT_SERVICE_REQUIRED: 'Selecione o serviço do benefício grátis.', BENEFIT_PRODUCT_REQUIRED: 'Selecione o produto do benefício grátis.', BENEFIT_POINTS_INVALID: 'O bônus de pontos deve ser um número inteiro positivo.' };
      return res.status(400).json({ error: messages[error.message] || 'Regra de benefício inválida.' });
    }
    await db.transaction(async (tx: any) => {
      const tierIds = await validateRelatedIds(tx, payload.tierIds, schema.loyaltyTiers, 'tier');
      const updated = await tx.update(schema.loyaltyBenefits).set({ name: payload.name, description: payload.description, benefitType: payload.benefitType, valueAmount: payload.valueAmount === null || payload.valueAmount === undefined ? null : payload.valueAmount.toFixed(2), valueText: payload.valueText || null, serviceId: payload.serviceId || null, productId: payload.productId || null, usageLimit: payload.usageLimit ?? null, validityDays: payload.validityDays ?? null, displayOrder: payload.displayOrder, isActive: payload.isActive, updatedAt: new Date() }).where(eq(schema.loyaltyBenefits.id, req.params.id)).returning({ id: schema.loyaltyBenefits.id });
      if (!updated.length) throw new Error('BENEFIT_NOT_FOUND');
      await tx.delete(schema.loyaltyTierBenefits).where(eq(schema.loyaltyTierBenefits.benefitId, req.params.id));
      if (tierIds.length) await tx.insert(schema.loyaltyTierBenefits).values(tierIds.map((tierId, index) => ({ tierId, benefitId: req.params.id, displayOrder: index })));
    });
    res.json({ success: true, message: 'Benefício atualizado com sucesso.' });
  } catch (e: any) {
    if (e?.message === 'TIER_NOT_FOUND') return res.status(400).json({ error: 'Um dos níveis selecionados não existe.' });
    if (e?.message === 'BENEFIT_NOT_FOUND') return res.status(404).json({ error: 'Benefício não encontrado.' });
    return handleError(res, e, 'PUT /api/loyalty/admin/benefits');
  }
});

loyaltyRouter.delete('/admin/benefits/:id', requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    const [updated] = await db.update(schema.loyaltyBenefits).set({ isActive: false, updatedAt: new Date() }).where(eq(schema.loyaltyBenefits.id, req.params.id)).returning({ id: schema.loyaltyBenefits.id });
    if (!updated) return res.status(404).json({ error: 'Benefício não encontrado.' });
    res.json({ success: true, message: 'Benefício desativado.' });
  } catch (e: any) {
    return handleError(res, e, 'DELETE /api/loyalty/admin/benefits');
  }
});

loyaltyRouter.post('/admin/plans', requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    const parsed = planPayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados do plano inválidos.', details: parsed.error.flatten() });
    const payload = parsed.data;
    const id = `plan_${crypto.randomUUID()}`;
    await db.transaction(async (tx: any) => {
      const benefitIds = await validateRelatedIds(tx, payload.benefitIds, schema.loyaltyBenefits, 'benefit');
      await tx.insert(schema.loyaltyPlans).values({ id, name: payload.name, description: payload.description, price: payload.price.toFixed(2), billingPeriod: payload.billingPeriod, pointsBonus: payload.pointsBonus, status: payload.status, displayOrder: payload.displayOrder, isFeatured: payload.isFeatured, updatedAt: new Date() });
      if (benefitIds.length) await tx.insert(schema.loyaltyPlanBenefits).values(benefitIds.map((benefitId, index) => ({ planId: id, benefitId, displayOrder: index })));
    });
    res.status(201).json({ success: true, id, message: 'Plano criado com sucesso.' });
  } catch (e: any) {
    if (e?.message === 'BENEFIT_NOT_FOUND') return res.status(400).json({ error: 'Um dos benefícios selecionados não existe.' });
    return handleError(res, e, 'POST /api/loyalty/admin/plans');
  }
});

loyaltyRouter.put('/admin/plans/:id', requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    const parsed = planPayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados do plano inválidos.', details: parsed.error.flatten() });
    const payload = parsed.data;
    await db.transaction(async (tx: any) => {
      const benefitIds = await validateRelatedIds(tx, payload.benefitIds, schema.loyaltyBenefits, 'benefit');
      const updated = await tx.update(schema.loyaltyPlans).set({ name: payload.name, description: payload.description, price: payload.price.toFixed(2), billingPeriod: payload.billingPeriod, pointsBonus: payload.pointsBonus, status: payload.status, displayOrder: payload.displayOrder, isFeatured: payload.isFeatured, updatedAt: new Date() }).where(eq(schema.loyaltyPlans.id, req.params.id)).returning({ id: schema.loyaltyPlans.id });
      if (!updated.length) throw new Error('PLAN_NOT_FOUND');
      await tx.delete(schema.loyaltyPlanBenefits).where(eq(schema.loyaltyPlanBenefits.planId, req.params.id));
      if (benefitIds.length) await tx.insert(schema.loyaltyPlanBenefits).values(benefitIds.map((benefitId, index) => ({ planId: req.params.id, benefitId, displayOrder: index })));
    });
    res.json({ success: true, message: 'Plano atualizado com sucesso.' });
  } catch (e: any) {
    if (e?.message === 'BENEFIT_NOT_FOUND') return res.status(400).json({ error: 'Um dos benefícios selecionados não existe.' });
    if (e?.message === 'PLAN_NOT_FOUND') return res.status(404).json({ error: 'Plano não encontrado.' });
    return handleError(res, e, 'PUT /api/loyalty/admin/plans');
  }
});

loyaltyRouter.delete('/admin/plans/:id', requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });
    const [updated] = await db.update(schema.loyaltyPlans).set({ status: 'archived', updatedAt: new Date() }).where(eq(schema.loyaltyPlans.id, req.params.id)).returning({ id: schema.loyaltyPlans.id });
    if (!updated) return res.status(404).json({ error: 'Plano não encontrado.' });
    res.json({ success: true, message: 'Plano arquivado.' });
  } catch (e: any) {
    return handleError(res, e, 'DELETE /api/loyalty/admin/plans');
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
    const reviewRows = await db
      .select({
        id: schema.reviews.id,
        rating: schema.reviews.rating,
        understoodRequest: schema.reviews.understoodRequest,
        waitTimeAcceptable: schema.reviews.waitTimeAcceptable,
        serviceExperience: schema.reviews.serviceExperience,
        wouldRecommend: schema.reviews.wouldRecommend,
        comment: schema.reviews.comment,
        serviceTitle: schema.reviews.serviceTitle,
        hasPhoto: schema.reviews.hasPhoto,
        photoUrl: schema.reviews.photoUrl,
        createdAt: schema.reviews.createdAt,
        clientName: schema.profiles.name,
        professionalName: schema.professionals.name,
      })
      .from(schema.reviews)
      .leftJoin(schema.profiles, eq(schema.reviews.clientId, schema.profiles.id))
      .leftJoin(schema.professionals, eq(schema.reviews.professionalId, schema.professionals.id))
      .orderBy(desc(schema.reviews.createdAt))
      .limit(100);
    const npsValues = reviewRows
      .map((review: any) => review.wouldRecommend === 'Com certeza' ? 100 : review.wouldRecommend === 'Talvez' ? 50 : review.wouldRecommend === 'Não' ? 0 : null)
      .filter((value): value is number => value !== null);
    const promoters = npsValues.filter((value) => value === 100).length;
    const detractors = npsValues.filter((value) => value === 0).length;
    const passives = npsValues.filter((value) => value === 50).length;
    const npsScore = npsValues.length > 0 ? Math.round(((promoters - detractors) / npsValues.length) * 100) : 0;
    const averageRating = reviewRows.length > 0
      ? Number((reviewRows.reduce((sum: number, review: any) => sum + Number(review.rating || 0), 0) / reviewRows.length).toFixed(1))
      : 0;
    const reviewsList = reviewRows.map((review: any) => ({
      ...review,
      clientName: review.clientName || 'Cliente anônimo',
      professionalName: review.professionalName || 'Profissional não informado',
      isAnonymous: !review.clientName,
    }));
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
      reviewsList,
      totalReviews: reviewRows.length,
      npsScore,
      promoters,
      detractors,
      passives,
      averageRating,
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
