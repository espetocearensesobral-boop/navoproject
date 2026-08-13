import express from 'express';
import { eq } from 'drizzle-orm';
import { db, isDbConnected } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';

export const servicesRouter = express.Router();

servicesRouter.get("/", async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
  try {
    let servicesList: any[] = [];
    if (isDbConnected && db) {
      servicesList = await db.query.services.findMany();
    }
    if (servicesList && servicesList.length > 0) {
      servicesList.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    }
    res.json(servicesList);
  } catch (e: any) {
    console.error('Error fetching services:', e);
    return res.json([]);
  }
});

servicesRouter.delete("/all", requireAuth, requireAdmin, async (req, res) => {
  try {
    if (isDbConnected && db) {
      await db.delete(schema.services);
    }
    res.json({ success: true, message: 'Todos os serviços foram removidos.' });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

servicesRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const newSrv = { id: req.body.id || `srv_${Date.now()}`, ...req.body };
    await db.insert(schema.services).values(newSrv).onConflictDoUpdate({
      target: schema.services.id,
      set: { ...req.body, updatedAt: new Date() }
    });
    res.json(newSrv);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

servicesRouter.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const srvData = { id: req.params.id, ...req.body };
    await db.insert(schema.services).values(srvData).onConflictDoUpdate({
      target: schema.services.id,
      set: { ...req.body, updatedAt: new Date() }
    });
    res.json(srvData);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

servicesRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.delete(schema.services).where(eq(schema.services.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});
