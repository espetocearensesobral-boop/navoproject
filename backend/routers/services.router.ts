import express from 'express';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db, isDbConnected } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { servicePayloadSchema } from '../utils/validation.js';

export const servicesRouter = express.Router();

servicesRouter.get('/', async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
  try {
    if (!isDbConnected || !db) return res.status(503).json({ error: 'Banco de dados indisponível.' });
    const servicesList = await db.query.services.findMany();
    servicesList.sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));
    res.json(servicesList);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

servicesRouter.delete('/all', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!isDbConnected || !db) return res.status(503).json({ error: 'Banco de dados indisponível.' });
    await db.delete(schema.services);
    res.json({ success: true, message: 'Todos os serviços foram removidos.' });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

servicesRouter.post('/', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = servicePayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados de serviço inválidos.', details: parsed.error.flatten() });
    const id = typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : `srv_${crypto.randomUUID()}`;
    const [created] = await db.insert(schema.services).values({ id, ...parsed.data }).onConflictDoNothing().returning();
    if (!created) return res.status(409).json({ error: 'Já existe um serviço com este identificador.' });
    res.status(201).json(created);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

servicesRouter.put('/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = servicePayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados de serviço inválidos.', details: parsed.error.flatten() });
    const [updated] = await db.update(schema.services)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(schema.services.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Serviço não encontrado.' });
    res.json(updated);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

servicesRouter.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const deleted = await db.delete(schema.services).where(eq(schema.services.id, req.params.id)).returning({ id: schema.services.id });
    if (deleted.length === 0) return res.status(404).json({ error: 'Serviço não encontrado.' });
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});
