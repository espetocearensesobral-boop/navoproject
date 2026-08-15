import { and, asc, eq, sql } from 'drizzle-orm';
import * as schema from '../../src/db/schema.js';

export type LoyaltyTierRecord = {
  id: string;
  name: string;
  minimumPoints: number;
  multiplier: number;
  displayOrder: number;
  color: string | null;
  isActive: boolean;
};

export type LoyaltyConfig = {
  currencyPerPoint: number;
  pointsValidityDays: number;
  tierMultipliers: Record<string, number>;
  referralPoints: {
    referrerBonus: number;
    referredBonus: number;
    milestoneCount: number;
    milestoneBonus: number;
  };
  reviewPoints: {
    baseReview: number;
    withPhotoBonus: number;
    fiveStarBonus: number;
  };
  birthdayBonus: number;
};

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  currencyPerPoint: 1,
  pointsValidityDays: 365,
  tierMultipliers: {
    Bronze: 1,
    Prata: 1.2,
    Ouro: 1.5,
    Diamante: 2,
  },
  referralPoints: {
    referrerBonus: 100,
    referredBonus: 50,
    milestoneCount: 5,
    milestoneBonus: 1000,
  },
  reviewPoints: {
    baseReview: 20,
    withPhotoBonus: 30,
    fiveStarBonus: 10,
  },
  birthdayBonus: 100,
};

const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export const normalizeLoyaltyConfig = (incoming: any = {}): LoyaltyConfig => ({
  currencyPerPoint: clampNumber(incoming.currencyPerPoint, DEFAULT_LOYALTY_CONFIG.currencyPerPoint, 0.01, 100000),
  pointsValidityDays: Math.round(clampNumber(incoming.pointsValidityDays, DEFAULT_LOYALTY_CONFIG.pointsValidityDays, 0, 3650)),
  tierMultipliers: Object.fromEntries(
    Object.entries({ ...DEFAULT_LOYALTY_CONFIG.tierMultipliers, ...(incoming.tierMultipliers || {}) })
      .map(([name, multiplier]) => [name, clampNumber(multiplier, 1, 0.1, 20)]),
  ),
  referralPoints: {
    referrerBonus: Math.round(clampNumber(incoming.referralPoints?.referrerBonus, DEFAULT_LOYALTY_CONFIG.referralPoints.referrerBonus, 0, 100000000)),
    referredBonus: Math.round(clampNumber(incoming.referralPoints?.referredBonus, DEFAULT_LOYALTY_CONFIG.referralPoints.referredBonus, 0, 100000000)),
    milestoneCount: Math.round(clampNumber(incoming.referralPoints?.milestoneCount, DEFAULT_LOYALTY_CONFIG.referralPoints.milestoneCount, 1, 100000)),
    milestoneBonus: Math.round(clampNumber(incoming.referralPoints?.milestoneBonus, DEFAULT_LOYALTY_CONFIG.referralPoints.milestoneBonus, 0, 100000000)),
  },
  reviewPoints: {
    baseReview: Math.round(clampNumber(incoming.reviewPoints?.baseReview, DEFAULT_LOYALTY_CONFIG.reviewPoints.baseReview, 0, 100000000)),
    withPhotoBonus: Math.round(clampNumber(incoming.reviewPoints?.withPhotoBonus, DEFAULT_LOYALTY_CONFIG.reviewPoints.withPhotoBonus, 0, 100000000)),
    fiveStarBonus: Math.round(clampNumber(incoming.reviewPoints?.fiveStarBonus, DEFAULT_LOYALTY_CONFIG.reviewPoints.fiveStarBonus, 0, 100000000)),
  },
  birthdayBonus: Math.round(clampNumber(incoming.birthdayBonus, DEFAULT_LOYALTY_CONFIG.birthdayBonus, 0, 100000000)),
});

export async function getLoyaltyConfig(dbLike: any): Promise<LoyaltyConfig> {
  const saved = await dbLike.select().from(schema.loyaltySettings)
    .where(eq(schema.loyaltySettings.id, 'default'))
    .limit(1);
  return normalizeLoyaltyConfig(saved[0]?.config || {});
}

export async function listLoyaltyTiers(dbLike: any, includeInactive = false): Promise<LoyaltyTierRecord[]> {
  const rows = await dbLike.select().from(schema.loyaltyTiers)
    .orderBy(asc(schema.loyaltyTiers.displayOrder), asc(schema.loyaltyTiers.minimumPoints));
  return rows
    .filter((tier: any) => includeInactive || tier.isActive)
    .map((tier: any) => ({
      id: tier.id,
      name: tier.name,
      minimumPoints: Number(tier.minimumPoints || 0),
      multiplier: Number(tier.multiplier || 1),
      displayOrder: Number(tier.displayOrder || 0),
      color: tier.color || null,
      isActive: Boolean(tier.isActive),
    }));
}

export function resolveTier(tiers: LoyaltyTierRecord[], points: number): LoyaltyTierRecord {
  const active = tiers.filter((tier) => tier.isActive).sort((a, b) => a.minimumPoints - b.minimumPoints || a.displayOrder - b.displayOrder);
  return [...active].reverse().find((tier) => points >= tier.minimumPoints) || active[0] || {
    id: 'tier_bronze',
    name: 'Bronze',
    minimumPoints: 0,
    multiplier: 1,
    displayOrder: 0,
    color: '#A97142',
    isActive: true,
  };
}

export function resolveNextTier(tiers: LoyaltyTierRecord[], points: number): LoyaltyTierRecord | null {
  return tiers
    .filter((tier) => tier.isActive && tier.minimumPoints > points)
    .sort((a, b) => a.minimumPoints - b.minimumPoints)[0] || null;
}

export function calculateCheckoutPoints(amount: number, currencyPerPoint: number, multiplier: number) {
  const safeAmount = Math.max(0, Number(amount) || 0);
  const safeCurrencyPerPoint = Math.max(0.01, Number(currencyPerPoint) || 1);
  const safeMultiplier = Math.max(0.1, Number(multiplier) || 1);
  return Math.max(0, Math.floor((safeAmount / safeCurrencyPerPoint) * safeMultiplier));
}

const expirationKey = (creditId: string) => `expiration:${creditId}`;

export async function expirePointsInTransaction(tx: any, clientId: string, now = new Date()) {
  const transactions = await tx.select().from(schema.pointTransactions)
    .where(eq(schema.pointTransactions.clientId, clientId))
    .orderBy(asc(schema.pointTransactions.createdAt), asc(schema.pointTransactions.id));
  const lots: Array<{ id: string; remaining: number; expiresAt: Date | null }> = [];

  // Consome créditos FIFO para que a expiração não retire pontos de um lote
  // recente quando um lote antigo já foi usado em um resgate.
  for (const transaction of transactions) {
    const amount = Number(transaction.amount || 0);
    if (amount > 0) {
      lots.push({
        id: transaction.id,
        remaining: amount,
        expiresAt: transaction.expiresAt ? new Date(transaction.expiresAt) : null,
      });
      continue;
    }
    let debit = Math.abs(amount);
    for (const lot of lots) {
      if (debit <= 0) break;
      const consumed = Math.min(lot.remaining, debit);
      lot.remaining -= consumed;
      debit -= consumed;
    }
  }

  let expired = 0;
  for (const credit of lots.filter((lot) => lot.remaining > 0 && lot.expiresAt && lot.expiresAt.getTime() < now.getTime())) {
    const amount = credit.remaining;
    const [inserted] = await tx.insert(schema.pointTransactions).values({
      id: `pt_exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      clientId,
      amount: -amount,
      type: 'expiration',
      sourceType: 'expiration',
      sourceId: credit.id,
      sourceKey: expirationKey(credit.id),
      description: `Expiração de pontos de ${credit.expiresAt!.toLocaleDateString('pt-BR')}`,
      expiresAt: null,
      createdAt: now,
    }).onConflictDoNothing({ target: schema.pointTransactions.sourceKey }).returning({ id: schema.pointTransactions.id });
    if (inserted) expired += amount;
  }

  if (expired > 0) {
    await tx.update(schema.profiles)
      .set({ loyaltyPoints: sql`${schema.profiles.loyaltyPoints} - ${expired}`, updatedAt: now })
      .where(eq(schema.profiles.id, clientId));
  }
  return expired;
}

export async function expirePointsForClient(dbLike: any, clientId: string, now = new Date()) {
  if (!clientId) return 0;
  return dbLike.transaction((tx: any) => expirePointsInTransaction(tx, clientId, now));
}

export async function refreshProfileTierInTransaction(tx: any, clientId: string) {
  const profileRows = await tx.select({ points: schema.profiles.loyaltyPoints })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, clientId))
    .limit(1);
  if (!profileRows[0]) return null;
  const tiers = await listLoyaltyTiers(tx);
  const tier = resolveTier(tiers, Number(profileRows[0].points || 0));
  await tx.update(schema.profiles)
    .set({ loyaltyTier: tier.name, updatedAt: new Date() })
    .where(eq(schema.profiles.id, clientId));
  return tier;
}

export async function awardCheckoutPointsInTransaction(tx: any, input: {
  clientId?: string | null;
  receiptId: string;
  amount: number;
  description: string;
  now?: Date;
}) {
  if (!input.clientId || input.clientId === 'usr_guest' || input.clientId.startsWith('guest_')) return { pointsEarned: 0, tier: null };
  const now = input.now || new Date();
  const profile = await tx.select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, input.clientId))
    .limit(1);
  if (!profile[0]) return { pointsEarned: 0, tier: null };
  await expirePointsInTransaction(tx, input.clientId, now);
  const config = await getLoyaltyConfig(tx);
  const tiers = await listLoyaltyTiers(tx);
  const currentProfile = await tx.select({ points: schema.profiles.loyaltyPoints })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, input.clientId))
    .limit(1);
  const currentPoints = Number(currentProfile[0]?.points || 0);
  const currentTier = resolveTier(tiers, currentPoints);
  const multiplier = currentTier.multiplier;
  const pointsEarned = calculateCheckoutPoints(input.amount, config.currencyPerPoint, multiplier);
  if (pointsEarned <= 0) return { pointsEarned: 0, tier: currentTier };

  const validity = config.pointsValidityDays > 0
    ? new Date(now.getTime() + config.pointsValidityDays * 24 * 60 * 60 * 1000)
    : null;
  const [inserted] = await tx.insert(schema.pointTransactions).values({
    id: `pt_checkout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    clientId: input.clientId,
    amount: pointsEarned,
    type: 'checkout_confirmed',
    sourceType: 'checkout',
    sourceId: input.receiptId,
    sourceKey: `checkout:${input.receiptId}`,
    description: input.description,
    expiresAt: validity,
    createdAt: now,
  }).onConflictDoNothing({ target: schema.pointTransactions.sourceKey }).returning({ id: schema.pointTransactions.id });
  if (!inserted) return { pointsEarned: 0, tier: currentTier, alreadyAwarded: true };

  await tx.update(schema.profiles)
    .set({ loyaltyPoints: sql`${schema.profiles.loyaltyPoints} + ${pointsEarned}`, updatedAt: now })
    .where(eq(schema.profiles.id, input.clientId));
  const tier = await refreshProfileTierInTransaction(tx, input.clientId);
  return { pointsEarned, tier };
}
