import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/index.js';

export const loyaltyRouter = express.Router();

loyaltyRouter.get('/me', requireAuth, (req: any, res: any) => {
  res.json({
    loyaltyPoints: 0,
    loyaltyTier: 'Bronze',
    referralCode: 'REF-USER',
    referralStats: { totalInvited: 0, completedCount: 0, pointsEarned: 0 }
  });
});

loyaltyRouter.post('/redeem', requireAuth, (req: any, res: any) => {
  res.json({ success: true, message: 'Recompensa resgatada' });
});

loyaltyRouter.post('/checkin-instagram', requireAuth, (req: any, res: any) => {
  res.json({ success: true, pointsEarned: 10, message: 'Check-in realizado com sucesso!' });
});

loyaltyRouter.get('/admin/dashboard', requireAuth, requireAdmin, (req: any, res: any) => {
  res.json({
    recentRedemptions: [],
    stats: { totalPointsIssued: 0, totalPointsRedeemed: 0, topClients: [] }
  });
});

loyaltyRouter.post('/admin/campaign-inactives', requireAuth, requireAdmin, (req: any, res: any) => {
  res.json({ success: true, message: 'Campanha enviada' });
});

loyaltyRouter.post('/admin/manual-points', requireAuth, requireAdmin, (req: any, res: any) => {
  res.json({ success: true, message: 'Pontos ajustados' });
});
