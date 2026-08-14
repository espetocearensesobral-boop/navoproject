import express from 'express';
import { sql } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { db, isDbConnected } from '../index.js';

export const systemRouter = express.Router();

systemRouter.get('/status', requireAuth, requireAdmin, (req, res) => {
  res.json({
    databaseConnected: isDbConnected,
    timestamp: new Date().toISOString()
  });
});

// Read-only schema diagnostic used to verify production migrations without
// exposing row data. It is intentionally protected by the admin middleware.
systemRouter.get('/diagnostics/appointments-status', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!db || !isDbConnected) {
      return res.status(503).json({ error: 'Banco de dados indisponível.' });
    }

    const columnRows = await db.execute(sql`
      SELECT column_name, data_type, udt_schema, udt_name, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'appointments'
      ORDER BY ordinal_position
    `);

    const constraintRows = await db.execute(sql`
      SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint AS c
      JOIN pg_class AS t ON t.oid = c.conrelid
      JOIN pg_namespace AS n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'appointments'
        AND (c.contype = 'c' OR c.contype = 'f')
    `);

    const indexRows = await db.execute(sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'appointments'
    `);

    const triggerRows = await db.execute(sql`
      SELECT tgname, pg_get_triggerdef(pg_trigger.oid) AS definition
      FROM pg_trigger
      JOIN pg_class AS t ON t.oid = pg_trigger.tgrelid
      JOIN pg_namespace AS n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'appointments'
        AND NOT pg_trigger.tgisinternal
    `);

    const enumRows = await db.execute(sql`
      SELECT ty.typname, array_agg(en.enumlabel ORDER BY en.enumsortorder) AS labels
      FROM pg_attribute AS a
      JOIN pg_class AS t ON t.oid = a.attrelid
      JOIN pg_namespace AS n ON n.oid = t.relnamespace
      JOIN pg_type AS ty ON ty.oid = a.atttypid
      JOIN pg_enum AS en ON en.enumtypid = ty.oid
      WHERE n.nspname = 'public'
        AND t.relname = 'appointments'
        AND a.attname = 'status'
        AND a.attnum > 0
        AND NOT a.attisdropped
      GROUP BY ty.typname
    `);

    return res.json({
      columns: columnRows || [],
      constraints: constraintRows || [],
      indexes: indexRows || [],
      triggers: triggerRows || [],
      enum: enumRows?.[0] || null
    });
  } catch (error: any) {
    console.error('[API] Appointment status diagnostic failed:', error);
    return res.status(500).json({ error: 'Não foi possível consultar a estrutura do status.' });
  }
});
