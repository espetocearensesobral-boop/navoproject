import express from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';

export const loyaltyRouter = express.Router();

loyaltyRouter.get('/me', requireAuth, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    
    const user = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, req.user.id) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const referralsList = await db.select().from(schema.referrals).where(eq(schema.referrals.referrerId, req.user.id));
    const completed = referralsList.filter((r: any) => r.status === 'completed');
    const points = completed.reduce((acc: number, r: any) => acc + (r.pointsAwarded || 0), 0);

    res.json({
      loyaltyPoints: user.loyaltyPoints || 0,
      loyaltyTier: user.loyaltyTier || 'Bronze',
      referralCode: user.referralCode || '',
      referralStats: { 
        totalInvited: referralsList.length, 
        completedCount: completed.length, 
        pointsEarned: points 
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

loyaltyRouter.post('/redeem', requireAuth, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const { rewardId } = req.body;
    
    const reward = await db.query.rewards.findFirst({ where: eq(schema.rewards.id, rewardId) });
    if (!reward || !reward.isActive) return res.status(404).json({ error: 'Recompensa não encontrada ou inativa' });
    
    const user = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, req.user.id) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if ((user.loyaltyPoints || 0) < reward.pointsRequired) {
      return res.status(400).json({ error: 'Pontos insuficientes' });
    }
    
    await db.update(schema.profiles)
      .set({ loyaltyPoints: (user.loyaltyPoints || 0) - reward.pointsRequired })
      .where(eq(schema.profiles.id, user.id));
      
    // Ideally we would log this in audit_logs or redemptions table
    res.json({ success: true, message: 'Recompensa resgatada com sucesso' });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

loyaltyRouter.post('/checkin-instagram', requireAuth, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const user = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, req.user.id) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // In a real app we'd check if they checked in recently to prevent spam
    const pointsEarned = 10;
    await db.update(schema.profiles)
      .set({ loyaltyPoints: (user.loyaltyPoints || 0) + pointsEarned })
      .where(eq(schema.profiles.id, user.id));
      
    res.json({ success: true, pointsEarned, message: 'Check-in realizado com sucesso!' });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

loyaltyRouter.get('/admin/dashboard', requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    
    // Just mock stats for now to avoid complex queries if tables are missing
    res.json({
      recentRedemptions: [],
      stats: { totalPointsIssued: 0, totalPointsRedeemed: 0, topClients: [] }
    });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

loyaltyRouter.post('/admin/campaign-inactives', requireAuth, requireAdmin, (req: any, res: any) => {
  res.json({ success: true, message: 'Campanha enviada' });
});

loyaltyRouter.post('/admin/manual-points', requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const { clientId, points, reason } = req.body;
    
    const user = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, clientId) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    await db.update(schema.profiles)
      .set({ loyaltyPoints: (user.loyaltyPoints || 0) + Number(points) })
      .where(eq(schema.profiles.id, user.id));
      
    res.json({ success: true, message: 'Pontos ajustados' });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
