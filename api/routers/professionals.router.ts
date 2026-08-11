import express from 'express';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db, isDbConnected } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { JWT_SECRET } from '../config/env.js';

export const professionalsRouter = express.Router();

professionalsRouter.get("/", async (req, res) => {
  try {
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    const token = req.cookies?.token || (authHeader && authHeader.split(' ')[1]);
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        isAdmin = decoded.role === 'admin';
      } catch(e) {}
    }

    let professionals: any[] = [];
    if (isDbConnected && db) {
      professionals = await db.query.professionals.findMany();
    }

    if (!isAdmin && Array.isArray(professionals)) {
      // Allowlist explícito de campos públicos. Evita vazar userId (id interno do
      // perfil vinculado), commissionRate e timestamps internos para visitantes.
      professionals = professionals.map((p: any) => ({
        id: p.id,
        name: p.name,
        nickname: p.nickname,
        roleTitle: p.roleTitle,
        rating: p.rating,
        reviewsCount: p.reviewsCount,
        photoUrl: p.photoUrl,
        specialties: p.specialties,
        isActive: p.isActive,
        workingHours: p.workingHours,
      }));
    }
    res.json(professionals || []);
  } catch (e: any) {
    console.error('Error fetching professionals:', e);
    return res.json([]);
  }
});

professionalsRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const newProf = { id: req.body.id || `prof_${Date.now()}`, ...req.body };
    await db.insert(schema.professionals).values(newProf).onConflictDoUpdate({
      target: schema.professionals.id,
      set: { ...req.body, updatedAt: new Date() }
    });
    res.json(newProf);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

professionalsRouter.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const profData = { id: req.params.id, ...req.body };
    await db.insert(schema.professionals).values(profData).onConflictDoUpdate({
      target: schema.professionals.id,
      set: { ...req.body, updatedAt: new Date() }
    });
    res.json(profData);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

professionalsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.delete(schema.professionals).where(eq(schema.professionals.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    if (e.code === '23503' || (e.message && e.message.includes('violates foreign key constraint') && e.message.includes('professionals'))) {
      return res.status(400).json({ error: 'Não é possível excluir este profissional pois ele possui agendamentos vinculados.' });
    }
    return handleError(res, e, req.path);
  }
});
