import express from 'express';

const router = express.Router();

const WHATSAPP_TOKEN = process.env.WHATSAPP_CLOUD_API_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const GRAPH_API_VERSION = 'v20.0';

let connectionState: 'open' | 'close' = WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID ? 'open' : 'close';

if (connectionState === 'close') {
  console.warn('[WhatsApp] WHATSAPP_CLOUD_API_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurados. Envios ficarão desativados até configurar as variáveis de ambiente.');
}

/**
 * Sends a real WhatsApp message via Meta's WhatsApp Cloud API.
 * Requires WHATSAPP_CLOUD_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID env vars
 * (from developers.facebook.com > your app > WhatsApp > API Setup).
 *
 * Note: outside the 24h customer-service window, Meta only allows sending
 * pre-approved Message Templates, not free-form text. This function sends
 * free-form text — fine for replies within 24h of the user's last message
 * (e.g. right after they book), but for proactive resets/confirmations
 * you may need to create and use an approved template instead.
 */
export async function sendWhatsAppMessage(phone: string, message: string) {
  if (connectionState !== 'open') {
    console.warn(`[WhatsApp] Não foi possível enviar para ${phone}: credenciais da Cloud API não configuradas.`);
    return false;
  }

  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10 || cleanPhone.length === 11) {
    cleanPhone = '55' + cleanPhone;
  }

  const maskedPhone = cleanPhone.slice(0, 4) + '****' + cleanPhone.slice(-4);

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: { body: message, preview_url: false },
        }),
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`[WhatsApp] Falha ao enviar para ${maskedPhone}:`, JSON.stringify(data));
      return false;
    }

    console.log(`[WhatsApp] Mensagem enviada para ${maskedPhone}.`);
    return true;
  } catch (err) {
    console.error(`[WhatsApp] Erro ao enviar para ${maskedPhone}:`, err);
    return false;
  }
}

// API Endpoints para o Frontend
import { requireAuth, requireAdmin } from './middleware/auth.js';

router.get('/status', requireAuth, requireAdmin, (req, res) => {
  res.json({
    state: connectionState,
    configured: connectionState === 'open',
    message: connectionState === 'open'
      ? 'WhatsApp Cloud API configurada.'
      : 'WHATSAPP_CLOUD_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID ausentes.'
  });
});

router.post('/reconnect', (req, res) => {
  connectionState = WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID ? 'open' : 'close';
  res.json({ success: connectionState === 'open', state: connectionState });
});

router.post('/logout', (req, res) => {
  connectionState = 'close';
  res.json({ success: true, message: 'Envio de WhatsApp desativado nesta instância.' });
});

export default router;
