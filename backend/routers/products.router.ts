import express from 'express';
import crypto from 'crypto';
import { and, eq, gte, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { JWT_SECRET } from '../config/env.js';
import { productPayloadSchema } from '../utils/validation.js';

export const productsRouter = express.Router();

productsRouter.get('/', async (req: any, res) => {
  try {
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    const token = req.cookies?.token || (authHeader && authHeader.split(' ')[1]);
    if (token) {
      try { isAdmin = (jwt.verify(token, JWT_SECRET) as any).role === 'admin'; } catch {}
    }
    const products = await db.query.products.findMany();
    res.json(isAdmin ? products : products.map((p: any) => {
      const { costPrice, commissionPercentage, ...safeProduct } = p;
      return safeProduct;
    }));
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

productsRouter.post('/', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = productPayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados de produto inválidos.', details: parsed.error.flatten() });
    const id = typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : `prod_${crypto.randomUUID()}`;
    const [created] = await db.insert(schema.products).values({ id, ...parsed.data }).onConflictDoNothing().returning();
    if (!created) return res.status(409).json({ error: 'Já existe um produto com este identificador.' });
    res.status(201).json(created);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

productsRouter.put('/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const parsed = productPayloadSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados de produto inválidos.', details: parsed.error.flatten() });
    const [updated] = await db.update(schema.products)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(schema.products.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Produto não encontrado.' });
    res.json(updated);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

productsRouter.patch('/:id/decrement-stock', requireAuth, requireAdmin, async (req, res) => {
  try {
    const quantity = Number(req.body?.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 1000000) {
      return res.status(400).json({ error: 'Quantidade inválida.' });
    }
    const updated = await db.update(schema.products)
      .set({ stockQuantity: sql`${schema.products.stockQuantity} - ${quantity}`, updatedAt: new Date() })
      .where(and(eq(schema.products.id, req.params.id), gte(schema.products.stockQuantity, quantity)))
      .returning();
    if (updated.length === 0) return res.status(409).json({ error: 'Estoque insuficiente ou produto não encontrado.' });
    res.json(updated[0]);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

productsRouter.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const deleted = await db.delete(schema.products).where(eq(schema.products.id, req.params.id)).returning({ id: schema.products.id });
    if (deleted.length === 0) return res.status(404).json({ error: 'Produto não encontrado.' });
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});
