import express from 'express';
import { isDbConnected } from '../index.js';

export const healthRouter = express.Router();

// Endpoint de Health Check
healthRouter.get('/', (req, res) => {
  res.json({
    status: isDbConnected ? 'ok' : 'degraded',
    database: isDbConnected ? 'connected' : 'disconnected',
    message: isDbConnected
      ? 'Banco de dados Supabase conectado e operacional.'
      : 'Sem conexão com o banco de dados Supabase.'
  });
});
