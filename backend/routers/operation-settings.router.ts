import express from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { db, isDbConnected } from '../index.js';
import { handleError } from '../utils/index.js';
import { invalidateAvailabilityCache } from './availability.router.js';
import {
  DEFAULT_OPERATION_SETTINGS,
  getOperationSettings,
  invalidateOperationSettingsCache,
  mapOperationSettings,
} from '../services/operation-settings.service.js';
import * as schema from '../../src/db/schema.js';

export const operationSettingsRouter = express.Router();

const operationSettingsSchema = z.object({
  slotIntervalMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(60)]),
  minimumBookingLeadMinutes: z.number().int().min(0).max(10080),
  maximumBookingHorizonDays: z.number().int().min(1).max(730),
  sameDayBookingCutoffMinutes: z.number().int().min(0).max(1440),
  bufferBetweenAppointmentsMinutes: z.number().int().min(0).max(120),
  availabilityCacheTtlSeconds: z.number().int().min(5).max(300),
});

operationSettingsRouter.get('/', async (_req, res) => {
  try {
    if (!isDbConnected || !db) return res.status(503).json({ error: 'Banco de dados indisponível.' });
    return res.json(await getOperationSettings(db));
  } catch (error) {
    return handleError(res, error, '/api/operation-settings');
  }
});

operationSettingsRouter.put('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!isDbConnected || !db) return res.status(503).json({ error: 'Banco de dados indisponível.' });
    const parsed = operationSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Parâmetros de Agenda inválidos.', details: parsed.error.flatten() });
    }

    const [updated] = await db.insert(schema.operationSettings)
      .values({ id: 'default', ...parsed.data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.operationSettings.id,
        set: { ...parsed.data, updatedAt: new Date() },
      })
      .returning();

    invalidateOperationSettingsCache();
    invalidateAvailabilityCache();
    return res.json(mapOperationSettings(updated || { ...DEFAULT_OPERATION_SETTINGS, ...parsed.data }));
  } catch (error) {
    return handleError(res, error, '/api/operation-settings');
  }
});
