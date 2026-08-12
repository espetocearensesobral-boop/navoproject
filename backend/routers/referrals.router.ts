import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth } from '../middleware/index.js';

export const referralsRouter = express.Router();

referralsRouter.get('/my-info', requireAuth, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    
    const user = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, req.user.id) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json({
      referralCode: user.referralCode || '',
      referralUrl: user.referralCode ? `https://navo.com.br/ref/${user.referralCode}` : ''
    });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

referralsRouter.post('/apply-code', requireAuth, async (req: any, res: any) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    
    const { referralCode } = req.body;
    if (!referralCode) return res.status(400).json({ error: 'Código de indicação é obrigatório' });
    
    // Check if code exists and is not the user's own code
    const referrer = await db.query.profiles.findFirst({ where: eq(schema.profiles.referralCode, referralCode) });
    if (!referrer) return res.status(404).json({ error: 'Código de indicação inválido' });
    if (referrer.id === req.user.id) return res.status(400).json({ error: 'Você não pode usar seu próprio código' });
    
    // Check if user already used a code
    const existingRef = await db.query.referrals.findFirst({ where: eq(schema.referrals.referredId, req.user.id) });
    if (existingRef) return res.status(400).json({ error: 'Você já utilizou um código de indicação' });
    
    await db.insert(schema.referrals).values({
      id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      referrerId: referrer.id,
      referredId: req.user.id,
      status: 'pending',
      pointsAwarded: 0,
      createdAt: new Date(),
    });
    
    res.json({ success: true, message: 'Código aplicado com sucesso!' });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
