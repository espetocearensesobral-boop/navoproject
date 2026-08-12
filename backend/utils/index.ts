export * from './datetime.js';
export * from './errors.js';
export * from './phone.js';
export * from './booking.js';

export function formatProfile(p: any) {
  if (!p) return null;
  const { password, resetCodeHash, resetCodeExpiresAt, ...safe } = p;
  const avatar = safe.avatarUrl || safe.avatar_url || null;
  const points = safe.loyaltyPoints ?? safe.loyalty_points ?? 0;
  const tier = safe.loyaltyTier || safe.loyalty_tier || 'Bronze';
  return {
    ...safe,
    avatarUrl: avatar,
    avatar_url: avatar,
    loyaltyPoints: points,
    loyalty_points: points,
    loyaltyTier: tier,
    loyalty_tier: tier,
    themePalette: safe.themePalette || safe.theme_palette || 'heritage',
  };
}
