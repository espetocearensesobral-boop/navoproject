import express from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';
import { getAdminPushPublicKey, isAdminPushConfigured, sendAdminPush } from '../services/admin-push.service.js';

export const adminPushRouter = express.Router();

adminPushRouter.get('/config', requireAuth, requireAdmin, (_req, res) => {
  return res.json({ enabled: isAdminPushConfigured(), publicKey: getAdminPushPublicKey() });
});

adminPushRouter.get('/subscriptions/status', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const endpoint = typeof req.query?.endpoint === 'string' ? req.query.endpoint.trim() : '';
    const conditions = endpoint
      ? and(eq(schema.adminPushSubscriptions.adminId, req.user.id), eq(schema.adminPushSubscriptions.endpoint, endpoint))
      : eq(schema.adminPushSubscriptions.adminId, req.user.id);
    const [subscription] = await db.select({
      endpoint: schema.adminPushSubscriptions.endpoint,
      enabled: schema.adminPushSubscriptions.enabled,
    }).from(schema.adminPushSubscriptions).where(conditions).limit(1);

    return res.json({
      active: Boolean(subscription?.enabled),
      endpoint: subscription?.endpoint || endpoint || null,
    });
  } catch (error: any) {
    return handleError(res, error, req.path);
  }
});

adminPushRouter.post('/subscriptions', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const subscription = req.body?.subscription || req.body;
    const endpoint = typeof subscription?.endpoint === 'string' ? subscription.endpoint.trim() : '';
    const p256dh = typeof subscription?.keys?.p256dh === 'string' ? subscription.keys.p256dh : '';
    const auth = typeof subscription?.keys?.auth === 'string' ? subscription.keys.auth : '';

    if (!endpoint.startsWith('https://') || !p256dh || !auth) {
      return res.status(400).json({ error: 'Assinatura push inválida.' });
    }

    const now = new Date();
    const id = `push_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 500) : null;

    const [saved] = await db.insert(schema.adminPushSubscriptions)
      .values({
        id,
        adminId: req.user.id,
        endpoint,
        p256dh,
        auth,
        userAgent,
        enabled: true,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.adminPushSubscriptions.endpoint,
        set: {
          adminId: req.user.id,
          p256dh,
          auth,
          userAgent,
          enabled: true,
          lastSeenAt: now,
          updatedAt: now,
        },
      })
      .returning({ id: schema.adminPushSubscriptions.id, enabled: schema.adminPushSubscriptions.enabled });

    return res.json({ success: true, subscription: saved });
  } catch (error: any) {
    return handleError(res, error, req.path);
  }
});

adminPushRouter.delete('/subscriptions', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.trim() : '';
    if (!endpoint) return res.status(400).json({ error: 'Endpoint da assinatura é obrigatório.' });

    await db.update(schema.adminPushSubscriptions)
      .set({ enabled: false, updatedAt: new Date() })
      .where(and(
        eq(schema.adminPushSubscriptions.endpoint, endpoint),
        eq(schema.adminPushSubscriptions.adminId, req.user.id),
      ));

    return res.json({ success: true });
  } catch (error: any) {
    return handleError(res, error, req.path);
  }
});

adminPushRouter.post('/test', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    if (!isAdminPushConfigured()) {
      return res.status(503).json({ error: 'Push em segundo plano ainda não está configurado no ambiente de produção.' });
    }

    const result = await sendAdminPush({
      title: 'Alertas operacionais ativados',
      body: 'O Admin está preparado para avisar sobre Agenda, Fila e recebimentos.',
      tag: 'navo-admin-push-test',
      url: '/admin',
    }, req.user.id);

    return res.json({ success: true, ...result });
  } catch (error: any) {
    return handleError(res, error, req.path);
  }
});
