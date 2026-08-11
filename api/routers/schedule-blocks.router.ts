import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';

export const scheduleBlocksRouter = express.Router();

scheduleBlocksRouter.get("/", async (req, res) => {
  try {
    const blocks = await db.query.scheduleBlocks.findMany();
    res.json(blocks);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

scheduleBlocksRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const newBlock = { id: req.body.id || `blk_${Date.now()}`, ...req.body };
    await db.insert(schema.scheduleBlocks).values(newBlock).onConflictDoUpdate({
      target: schema.scheduleBlocks.id,
      set: { ...req.body }
    });
    res.json(newBlock);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

scheduleBlocksRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.delete(schema.scheduleBlocks).where(eq(schema.scheduleBlocks.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});
