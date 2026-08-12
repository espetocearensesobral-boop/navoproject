import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { isDbConnected } from '../index.js';

export const systemRouter = express.Router();

systemRouter.get('/status', requireAuth, requireAdmin, (req, res) => {
  res.json({
    databaseConnected: isDbConnected,
    timestamp: new Date().toISOString()
  });
});
