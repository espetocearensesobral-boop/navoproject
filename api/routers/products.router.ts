import express from 'express';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { JWT_SECRET } from '../config/env.js';

export const productsRouter = express.Router();

productsRouter.get("/", async (req: any, res) => {
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

    let products = await db.query.products.findMany();

    if (!isAdmin) {
      products = products.map((p: any) => {
        const { costPrice, commissionPercentage, ...safeProduct } = p;
        return safeProduct as any;
      });
    }
    res.json(products);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

productsRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const newProd = { id: req.body.id || `prod_${Date.now()}`, ...req.body };
    await db.insert(schema.products).values(newProd).onConflictDoUpdate({
      target: schema.products.id,
      set: { ...req.body, updatedAt: new Date() }
    });
    res.json(newProd);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

productsRouter.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const prodData = { id: req.params.id, ...req.body };
    await db.insert(schema.products).values(prodData).onConflictDoUpdate({
      target: schema.products.id,
      set: { ...req.body, updatedAt: new Date() }
    });
    res.json(prodData);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

productsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.delete(schema.products).where(eq(schema.products.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});
