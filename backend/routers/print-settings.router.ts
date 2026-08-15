import express from 'express';
import { z } from 'zod';
import { db, isDbConnected } from '../index.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { DEFAULT_PRINT_SETTINGS, getPrintSettings, invalidatePrintSettingsCache, savePrintSettings } from '../services/print-settings.service.js';

export const printSettingsRouter = express.Router();

const printSettingsSchema = z.object({
  receiptFormat: z.enum(['thermal', 'a4']),
  reportFormat: z.enum(['thermal', 'a4']),
  qrFormat: z.enum(['thermal', 'a4']),
  thermalWidthMm: z.union([z.literal(58), z.literal(80)]),
  a4Orientation: z.enum(['portrait', 'landscape']),
  fontSize: z.number().int().min(9).max(18),
  density: z.enum(['compact', 'comfortable', 'spacious']),
  marginMm: z.number().int().min(0).max(30),
  showLogo: z.boolean(),
  showClientData: z.boolean(),
  showProfessional: z.boolean(),
  showService: z.boolean(),
  showPayment: z.boolean(),
  showObservations: z.boolean(),
  showQr: z.boolean(),
  showFooter: z.boolean(),
  footerText: z.string().trim().min(1).max(180),
  reportIncludeCharts: z.boolean(),
  reportIncludeDetails: z.boolean(),
}).strict();

printSettingsRouter.get('/', async (_req, res) => {
  try {
    if (!isDbConnected || !db) return res.status(503).json({ error: 'Banco de dados indisponível.' });
    return res.json(await getPrintSettings(db));
  } catch (error) {
    return handleError(res, error, 'GET /api/print-settings');
  }
});

printSettingsRouter.put('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!isDbConnected || !db) return res.status(503).json({ error: 'Banco de dados indisponível.' });
    const parsed = printSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Configurações de impressão inválidas.', details: parsed.error.flatten() });
    const saved = await savePrintSettings(db, { ...DEFAULT_PRINT_SETTINGS, ...parsed.data });
    invalidatePrintSettingsCache();
    return res.json(saved || { ...DEFAULT_PRINT_SETTINGS, ...parsed.data });
  } catch (error) {
    return handleError(res, error, 'PUT /api/print-settings');
  }
});
