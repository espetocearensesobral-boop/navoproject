import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from './index.js';
import * as schema from '../src/db/schema.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';

const router = express.Router();

const WHATSAPP_TOKEN = process.env.WHATSAPP_CLOUD_API_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const GRAPH_API_VERSION = 'v20.0';
let connectionState: 'open' | 'close' = WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID ? 'open' : 'close';

function normalizePhone(value: string): string {
  let cleanPhone = String(value || '').replace(/\D/g, '');
  if (cleanPhone.length === 10 || cleanPhone.length === 11) cleanPhone = `55${cleanPhone}`;
  return cleanPhone;
}

function maskPhone(phone: string): string {
  return phone.length > 8 ? `${phone.slice(0, 4)}****${phone.slice(-4)}` : '****';
}

async function getEvolutionSettings() {
  try {
    if (!db) return null;
    const rows = await db.select().from(schema.evolutionApiSettings).where(eq(schema.evolutionApiSettings.id, 'default'));
    const settings = rows[0];
    if (!settings?.enabled || !settings.baseUrl || !settings.instanceName || !settings.apiKey) return null;
    return settings;
  } catch (error) {
    console.warn('[WhatsApp] Não foi possível carregar a configuração da Evolution API:', error);
    return null;
  }
}

async function sendViaEvolution(phone: string, message: string): Promise<boolean> {
  const settings = await getEvolutionSettings();
  if (!settings) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/message/sendText/${encodeURIComponent(settings.instanceName)}`, {
      method: 'POST',
      headers: {
        apikey: settings.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ number: phone, text: message }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`[WhatsApp/Evolution] Falha ao enviar para ${maskPhone(phone)}:`, JSON.stringify(body));
      return false;
    }
    connectionState = 'open';
    console.log(`[WhatsApp/Evolution] Mensagem enviada para ${maskPhone(phone)}.`);
    return true;
  } catch (error) {
    console.error(`[WhatsApp/Evolution] Erro ao enviar para ${maskPhone(phone)}:`, error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendViaMeta(phone: string, message: string): Promise<boolean> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return false;
  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message, preview_url: false },
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`[WhatsApp/Meta] Falha ao enviar para ${maskPhone(phone)}:`, JSON.stringify(body));
      return false;
    }
    console.log(`[WhatsApp/Meta] Mensagem enviada para ${maskPhone(phone)}.`);
    return true;
  } catch (error) {
    console.error(`[WhatsApp/Meta] Erro ao enviar para ${maskPhone(phone)}:`, error);
    return false;
  }
}

/** Envia texto pelo canal configurado no Navo, priorizando Evolution API. */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  const cleanPhone = normalizePhone(phone);
  if (cleanPhone.length < 8 || cleanPhone.length > 15 || !message.trim()) return false;
  if (await sendViaEvolution(cleanPhone, message)) return true;
  if (await sendViaMeta(cleanPhone, message)) return true;
  connectionState = 'close';
  console.warn(`[WhatsApp] Nenhum canal configurado para enviar mensagem a ${maskPhone(cleanPhone)}.`);
  return false;
}

router.get('/status', requireAuth, requireAdmin, async (_req, res) => {
  const evolution = await getEvolutionSettings();
  if (evolution) {
    return res.json({
      state: connectionState,
      configured: true,
      provider: 'evolution',
      instanceName: evolution.instanceName,
      message: 'Evolution API configurada para envio.',
    });
  }
  return res.json({
    state: connectionState,
    configured: connectionState === 'open',
    provider: WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID ? 'meta' : 'none',
    message: connectionState === 'open' ? 'WhatsApp configurado.' : 'Nenhum canal de WhatsApp configurado.',
  });
});

router.post('/reconnect', requireAuth, requireAdmin, async (_req, res) => {
  const evolution = await getEvolutionSettings();
  connectionState = evolution || (WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID) ? 'open' : 'close';
  res.json({ success: connectionState === 'open', state: connectionState, provider: evolution ? 'evolution' : 'meta' });
});

router.post('/logout', requireAuth, requireAdmin, (_req, res) => {
  connectionState = 'close';
  res.json({ success: true, message: 'Envio de WhatsApp desativado nesta instância.' });
});

export default router;
