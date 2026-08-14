import webpush from 'web-push';
import { and, eq } from 'drizzle-orm';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import {
  WEB_PUSH_VAPID_PRIVATE_KEY,
  WEB_PUSH_VAPID_PUBLIC_KEY,
  WEB_PUSH_VAPID_SUBJECT,
} from '../config/env.js';

export type AdminPushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

let configured = false;

const configureWebPush = () => {
  if (configured) return true;
  if (!WEB_PUSH_VAPID_PUBLIC_KEY || !WEB_PUSH_VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(WEB_PUSH_VAPID_SUBJECT, WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY);
  configured = true;
  return true;
};

export const isAdminPushConfigured = () => Boolean(WEB_PUSH_VAPID_PUBLIC_KEY && WEB_PUSH_VAPID_PRIVATE_KEY);
export const getAdminPushPublicKey = () => WEB_PUSH_VAPID_PUBLIC_KEY || null;

export async function sendAdminPush(payload: AdminPushPayload, adminId?: string) {
  if (!configureWebPush() || !db) return { configured: false, sent: 0, removed: 0 };

  const subscriptions = await db
    .select()
    .from(schema.adminPushSubscriptions)
    .where(adminId
      ? and(eq(schema.adminPushSubscriptions.adminId, adminId), eq(schema.adminPushSubscriptions.enabled, true))
      : eq(schema.adminPushSubscriptions.enabled, true));

  let sent = 0;
  let removed = 0;
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag || 'navo-admin-operation',
    url: payload.url || '/admin',
  });

  await Promise.all(subscriptions.map(async (subscription: any) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, body);
      sent += 1;
      await db.update(schema.adminPushSubscriptions)
        .set({ lastSeenAt: new Date(), updatedAt: new Date(), enabled: true })
        .where(eq(schema.adminPushSubscriptions.id, subscription.id));
    } catch (error: any) {
      const statusCode = error?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        removed += 1;
        await db.update(schema.adminPushSubscriptions)
          .set({ enabled: false, updatedAt: new Date() })
          .where(eq(schema.adminPushSubscriptions.id, subscription.id));
      } else {
        console.warn('[Admin Push] Falha ao enviar para uma assinatura:', statusCode || error?.message || error);
      }
    }
  }));

  return { configured: true, sent, removed };
}
