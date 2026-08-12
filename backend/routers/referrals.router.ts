import express from 'express';
import { requireAuth } from '../middleware/index.js';

export const referralsRouter = express.Router();

referralsRouter.get('/my-info', requireAuth, (req: any, res: any) => {
  res.json({
    referralCode: 'REF-USER',
    referralUrl: 'https://navo.com.br/ref/REF-USER'
  });
});

referralsRouter.post('/apply-code', requireAuth, (req: any, res: any) => {
  res.json({ success: true, message: 'Código aplicado com sucesso!' });
});
