import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { requireAdmin, requireAuth } from './middleware/index.js';
import { handleError } from './utils/index.js';
import type { WhatsAppButtonsPayload, WhatsAppListPayload } from './services/whatsapp-provider.js';

const DEFAULT_SETTINGS = {
  id: 'default',
  enabled: false,
  baseUrl: '',
  instanceName: '',
  apiKey: '',
  webhookEnabled: false,
  webhookUrl: '',
  webhookSecret: '',
  navoBotEnabled: false,
  whatsappAccountType: 'personal_qr',
  useInteractiveMessages: false,
  managerNotificationPhone: '',
  notifyBarberOnHandoff: true,
  notifyManagerOnHandoff: true,
};

const configSchema = z.object({
  enabled: z.boolean().optional(),
  baseUrl: z.string().trim().max(300).optional(),
  instanceName: z.string().trim().min(1).max(80).optional(),
  apiKey: z.string().max(300).optional(),
  webhookEnabled: z.boolean().optional(),
  webhookUrl: z.string().trim().max(500).optional(),
  webhookSecret: z.string().max(300).optional(),
  navoBotEnabled: z.boolean().optional(),
  whatsappAccountType: z.enum(['personal_qr', 'business_qr']).optional(),
  useInteractiveMessages: z.boolean().optional(),
  managerNotificationPhone: z.string().trim().max(50).optional(),
  notifyBarberOnHandoff: z.boolean().optional(),
  notifyManagerOnHandoff: z.boolean().optional(),
}).strict();

const testMessageSchema = z.object({
  number: z.string().trim().min(8).max(30),
  text: z.string().trim().min(1).max(4000),
}).strict();

type EvolutionConfig = typeof DEFAULT_SETTINGS;

type EvolutionModuleDeps = {
  getDb: () => any;
  schema: any;
  eq: any;
  onWebhook?: (payload: any) => Promise<unknown>;
  onInactivitySweep?: () => Promise<unknown>;
  onTestAi?: () => Promise<unknown>;
};

function normalizeBaseUrl(value: string): string {
  let raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) {
    if (/^(localhost|127\.0\.0\.1|192\.168|10\.)/i.test(raw)) {
      raw = `http://${raw}`;
    } else {
      raw = `https://${raw}`;
    }
  }
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('A URL deve usar HTTP ou HTTPS.');
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch (err: any) {
    throw new Error(err?.message || 'A URL informada é inválida.');
  }
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

function publicConfig(row: any) {
  return {
    enabled: !!row?.enabled,
    baseUrl: row?.baseUrl || '',
    instanceName: row?.instanceName || '',
    webhookEnabled: !!row?.webhookEnabled,
    webhookUrl: row?.webhookUrl || '',
    hasWebhookSecret: !!row?.webhookSecret,
    hasApiKey: !!row?.apiKey,
    navoBotEnabled: !!row?.navoBotEnabled,
    whatsappAccountType: row?.whatsappAccountType === 'business_qr' ? 'business_qr' : 'personal_qr',
    useInteractiveMessages: row?.useInteractiveMessages === true,
    managerNotificationPhone: row?.managerNotificationPhone || '',
    notifyBarberOnHandoff: row?.notifyBarberOnHandoff !== false,
    notifyManagerOnHandoff: row?.notifyManagerOnHandoff !== false,
  };
}

function configIsComplete(row: any): boolean {
  return !!(row?.enabled && row?.baseUrl && row?.instanceName && row?.apiKey);
}

async function evolutionRequest(baseUrl: string, apiKey: string, path: string, init: RequestInit = {}, timeoutMs = 10_000) {
  const cleanBase = normalizeBaseUrl(baseUrl);
  if (!cleanBase) {
    throw new Error('URL da Evolution API não está configurada. Configure o endereço em Sistema > WhatsApp.');
  }
  const cleanApiKey = String(apiKey || '').trim();
  if (!cleanApiKey) {
    throw new Error('Chave da API (apikey) não informada.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${cleanBase}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        apikey: cleanApiKey,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const msg = body?.message || body?.error || (Array.isArray(body?.response?.message) ? body.response.message.join(', ') : `Evolution API respondeu HTTP ${response.status}.`);
      const errorMsg = typeof msg === 'string' ? msg : JSON.stringify(msg);
      const error = new Error(errorMsg) as Error & { status?: number; body?: unknown };
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      const error = new Error(`Tempo limite excedido (${timeoutMs / 1000}s) ao conectar à Evolution API em ${cleanBase}. Verifique se a porta está liberada no firewall do seu servidor/provedor (ex: Oracle Cloud, AWS, VPS) e se o serviço está ativo.`);
      throw error;
    }
    if (err.message === 'fetch failed' || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.cause) {
      const causeMsg = err.cause?.message || err.cause?.code || err.code || '';
      const error = new Error(`Falha de conexão com a Evolution API (${cleanBase}): Servidor inacessível ou endereço incorreto${causeMsg ? ` [${causeMsg}]` : ''}. Verifique se a URL e a porta estão corretas e se a Evolution API está online.`);
      throw error;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export function createEvolutionApiModule({ getDb, schema, eq, onWebhook, onInactivitySweep, onTestAi }: EvolutionModuleDeps) {
  const router = express.Router();

  async function getSettings(): Promise<any> {
    const db = getDb();
    if (!db) return null;
    const rows = await db.select().from(schema.evolutionApiSettings).where(eq(schema.evolutionApiSettings.id, 'default'));
    return rows[0] || null;
  }

  async function saveSettings(data: Record<string, unknown>) {
    const db = getDb();
    if (!db) throw new Error('Banco de dados indisponível no momento.');
    const existing = await getSettings();
    const apiKeyInput = typeof data.apiKey === 'string' ? data.apiKey.trim() : undefined;
    const apiKey = apiKeyInput === undefined || apiKeyInput === '••••••••'
      ? (existing?.apiKey || '')
      : apiKeyInput;

    let baseUrl = '';
    const rawBaseUrl = String(data.baseUrl ?? existing?.baseUrl ?? '').trim();
    if (rawBaseUrl) {
      try {
        baseUrl = normalizeBaseUrl(rawBaseUrl);
      } catch (err: any) {
        throw new Error(err?.message || 'A URL da Evolution API informada é inválida.');
      }
    }

    let webhookUrl = '';
    const rawWebhookUrl = String(data.webhookUrl ?? existing?.webhookUrl ?? '').trim();
    if (rawWebhookUrl) {
      try {
        webhookUrl = normalizeBaseUrl(rawWebhookUrl);
      } catch (err: any) {
        throw new Error(err?.message || 'A URL do webhook informada é inválida.');
      }
    }

    const payload = {
      id: 'default',
      enabled: data.enabled !== undefined ? !!data.enabled : !!existing?.enabled,
      baseUrl,
      instanceName: String(data.instanceName ?? existing?.instanceName ?? '').trim(),
      apiKey,
      webhookEnabled: data.webhookEnabled !== undefined ? !!data.webhookEnabled : !!existing?.webhookEnabled,
      webhookUrl,
      webhookSecret: typeof data.webhookSecret === 'string' && data.webhookSecret.trim() && data.webhookSecret !== '••••••••'
        ? data.webhookSecret.trim()
        : (existing?.webhookSecret || ''),
      navoBotEnabled: data.navoBotEnabled !== undefined ? !!data.navoBotEnabled : !!existing?.navoBotEnabled,
      whatsappAccountType: data.whatsappAccountType === 'business_qr' || existing?.whatsappAccountType === 'business_qr' ? 'business_qr' : 'personal_qr',
      useInteractiveMessages: data.useInteractiveMessages !== undefined ? !!data.useInteractiveMessages : existing?.useInteractiveMessages === true,
      managerNotificationPhone: typeof data.managerNotificationPhone === 'string' ? data.managerNotificationPhone.trim() : (existing?.managerNotificationPhone || ''),
      notifyBarberOnHandoff: data.notifyBarberOnHandoff !== undefined ? !!data.notifyBarberOnHandoff : (existing?.notifyBarberOnHandoff !== false),
      notifyManagerOnHandoff: data.notifyManagerOnHandoff !== undefined ? !!data.notifyManagerOnHandoff : (existing?.notifyManagerOnHandoff !== false),
      updatedAt: new Date(),
    };

    if (payload.webhookEnabled && !payload.webhookUrl) {
      throw new Error('Informe a URL do webhook ou desative o webhook.');
    }
    if (payload.webhookEnabled && !payload.webhookSecret) {
      payload.webhookSecret = crypto.randomBytes(16).toString('hex');
    }
    if (payload.enabled && (!payload.baseUrl || !payload.instanceName || !payload.apiKey)) {
      throw new Error('Preencha URL, nome da instância e chave da API antes de ativar a integração.');
    }

    const [saved] = await db.insert(schema.evolutionApiSettings)
      .values(payload)
      .onConflictDoUpdate({
        target: schema.evolutionApiSettings.id,
        set: {
          enabled: payload.enabled,
          baseUrl: payload.baseUrl,
          instanceName: payload.instanceName,
          apiKey: payload.apiKey,
          webhookEnabled: payload.webhookEnabled,
          webhookUrl: payload.webhookUrl,
          webhookSecret: payload.webhookSecret,
          navoBotEnabled: payload.navoBotEnabled,
          whatsappAccountType: payload.whatsappAccountType,
          useInteractiveMessages: payload.useInteractiveMessages,
          managerNotificationPhone: payload.managerNotificationPhone,
          notifyBarberOnHandoff: payload.notifyBarberOnHandoff,
          notifyManagerOnHandoff: payload.notifyManagerOnHandoff,
          updatedAt: payload.updatedAt,
        },
      })
      .returning();
    return saved || payload;
  }

  async function requireConfigured() {
    const settings = await getSettings();
    if (!configIsComplete(settings)) {
      const error = new Error('Configure e ative a Evolution API em Sistema > WhatsApp antes de continuar.') as Error & { status?: number };
      error.status = 400;
      throw error;
    }
    return settings;
  }

  router.get('/config', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const settings = await getSettings();
      return res.json(publicConfig(settings || DEFAULT_SETTINGS));
    } catch (error) {
      return handleError(res, error, 'GET /api/evolution/config');
    }
  });

  router.put('/config', requireAuth, requireAdmin, async (req, res) => {
    try {
      const parsed = configSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: 'Configuração da Evolution API inválida.' });
      const saved = await saveSettings(parsed.data);
      return res.json({ success: true, config: publicConfig(saved), message: 'Configurações da Evolution API salvas.' });
    } catch (error) {
      return handleError(res, error, 'PUT /api/evolution/config');
    }
  });

  router.get('/status', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const settings = await getSettings();
      if (!configIsComplete(settings)) {
        return res.json({ configured: false, reachable: false, instanceName: settings?.instanceName || '', instanceStatus: 'not_configured', message: 'Integração desativada ou incompleta.' });
      }
      try {
        const instances = await evolutionRequest(settings.baseUrl, settings.apiKey, '/instance/fetchInstances', {}, 4_000);
        const instance = Array.isArray(instances)
          ? instances.find((item: any) => item?.name === settings.instanceName || item?.instance?.instanceName === settings.instanceName || item?.instanceName === settings.instanceName)
          : null;
        return res.json({
          configured: true,
          reachable: true,
          instanceName: settings.instanceName,
          instanceStatus: instance?.connectionStatus || instance?.status || (instance ? 'created' : 'not_created'),
          instanceExists: !!instance,
          message: instance ? 'Evolution API conectada e instância localizada.' : 'Evolution API acessível, mas a instância ainda não foi criada no painel.',
        });
      } catch (error: any) {
        return res.json({ configured: true, reachable: false, instanceName: settings.instanceName, instanceStatus: 'unreachable', message: error?.message || 'Não foi possível alcançar a Evolution API.' });
      }
    } catch (error) {
      return handleError(res, error, 'GET /api/evolution/status');
    }
  });

  router.post('/test', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const settings = await requireConfigured();
      const instances = await evolutionRequest(settings.baseUrl, settings.apiKey, '/instance/fetchInstances', {}, 6_000);
      const instanceExists = Array.isArray(instances) && instances.some((item: any) => item?.name === settings.instanceName || item?.instance?.instanceName === settings.instanceName || item?.instanceName === settings.instanceName);
      return res.json({
        success: true,
        instanceExists,
        message: instanceExists
          ? `Conexão bem-sucedida! Instância "${settings.instanceName}" encontrada e respondendo na Evolution API.`
          : `Conexão bem-sucedida com a Evolution API! No entanto, a instância "${settings.instanceName}" ainda não foi criada no painel.`,
      });
    } catch (error: any) {
      return res.status(error?.status || 400).json({ error: error?.message || 'Não foi possível testar a Evolution API.' });
    }
  });

  router.post('/webhook/apply', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const settings = await requireConfigured();
      if (settings.webhookEnabled && !settings.webhookUrl) {
        return res.status(400).json({ error: 'Informe a URL do webhook antes de aplicar.' });
      }

      const events = [
        'MESSAGES_UPSERT',
        'messages.upsert',
        'CONNECTION_UPDATE',
        'connection.update',
        'QRCODE_UPDATED',
        'qrcode.updated',
        'SEND_MESSAGE',
        'send.message',
        'MESSAGES_UPDATE',
        'messages.update',
      ];

      const webhookPayload = {
        webhook: {
          enabled: !!settings.webhookEnabled,
          url: settings.webhookUrl || '',
          byEvents: false,
          base64: false,
          headers: settings.webhookSecret
            ? {
                Authorization: `Bearer ${settings.webhookSecret}`,
                apikey: settings.webhookSecret,
                'x-api-key': settings.webhookSecret,
              }
            : {},
          events,
        },
        // Estrutura plana para versões da Evolution API que esperam propriedades na raiz
        enabled: !!settings.webhookEnabled,
        url: settings.webhookUrl || '',
        webhookByEvents: false,
        events,
      };

      try {
        await evolutionRequest(settings.baseUrl, settings.apiKey, `/webhook/set/${encodeURIComponent(settings.instanceName)}`, {
          method: 'POST',
          body: JSON.stringify(webhookPayload),
        });
      } catch (err: any) {
        // Tenta endpoint alternativo da Evolution API v2 se o padrão falhar
        try {
          await evolutionRequest(settings.baseUrl, settings.apiKey, `/webhook/instance/${encodeURIComponent(settings.instanceName)}`, {
            method: 'POST',
            body: JSON.stringify(webhookPayload),
          });
        } catch {
          throw err;
        }
      }

      return res.json({ success: true, message: settings.webhookEnabled ? 'Webhook aplicado com sucesso à instância da Evolution API.' : 'Webhook desativado na instância.' });
    } catch (error: any) {
      console.error('[Evolution API] Erro ao aplicar webhook:', error);
      return res.status(error?.status || 400).json({ error: error?.message || 'Não foi possível aplicar o webhook na Evolution API.' });
    }
  });

  router.get('/webhook', async (_req, res) => {
    const settings = await getSettings();
    return res.status(200).json({
      ok: true,
      endpoint: '/api/evolution/webhook',
      accepts: 'POST',
      configured: !!(settings?.webhookEnabled && settings?.webhookUrl),
      hasSecret: !!settings?.webhookSecret,
      navobotEnabled: !!settings?.navoBotEnabled,
      instanceName: settings?.instanceName || '',
    });
  });

  router.post('/inactivity-sweep', async (req, res) => {
    try {
      const settings = await getSettings();
      if (!settings?.enabled || !settings.apiKey) return res.status(503).json({ error: 'Evolution API não configurada.' });
      const authorization = String(req.headers.authorization || '');
      if (authorization !== `Bearer ${settings.apiKey}`) return res.status(401).json({ error: 'Monitor não autorizado.' });
      if (!settings.navoBotEnabled || !onInactivitySweep) return res.json({ skipped: true, reason: 'navobot_disabled', reminded: 0, reset: 0 });
      const result = await onInactivitySweep();
      return res.json({ ok: true, ...(result as Record<string, unknown>) });
    } catch (error) {
      console.error('[NavoBot] Falha no monitor de inatividade:', error);
      return res.status(500).json({ error: 'Não foi possível processar o monitor de inatividade.' });
    }
  });

  function validateWebhookAuth(req: express.Request, settings: any): boolean {
    // Se não há segredo configurado, permite a requisição se a integração estiver ativa
    if (!settings?.webhookSecret || !String(settings.webhookSecret).trim()) {
      return true;
    }
    const secret = String(settings.webhookSecret).trim();

    const authHeader = String(req.headers.authorization || '').trim();
    if (authHeader === `Bearer ${secret}` || authHeader === secret) return true;

    const apiKeyHeader = String(req.headers.apikey || req.headers['x-api-key'] || req.headers['x-webhook-secret'] || '').trim();
    if (apiKeyHeader === secret) return true;

    // Também aceita a chave mestra global da Evolution API
    if (settings.apiKey && apiKeyHeader === String(settings.apiKey).trim()) return true;

    const querySecret = String(req.query.secret || req.query.token || req.query.apikey || '').trim();
    if (querySecret === secret) return true;

    return false;
  }

  router.post('/webhook', async (req, res) => {
    try {
      const settings = await getSettings();
      if (!settings?.enabled && !settings?.navoBotEnabled && !settings?.webhookEnabled) {
        return res.status(200).json({ received: true, note: 'integration_disabled' });
      }

      if (!validateWebhookAuth(req, settings)) {
        console.warn('[Evolution Webhook] Falha de autenticação no webhook: segredo incorreto ou ausente.');
        return res.status(401).json({ error: 'Webhook não autorizado. Verifique o segredo/token configurado.' });
      }

      const event = String(req.body?.event || req.body?.eventType || 'UNKNOWN');
      const rawInstance = req.body?.instance || req.body?.instanceName;
      const instance = typeof rawInstance === 'object' && rawInstance !== null
        ? String(rawInstance.instanceName || rawInstance.name || '')
        : String(rawInstance || settings?.instanceName || 'unknown');

      // Se a instância foi explicitamente configurada e vier diferente, loga aviso
      if (settings?.instanceName && instance && instance !== 'unknown') {
        const configuredInst = String(settings.instanceName).trim().toLowerCase();
        const incomingInst = instance.trim().toLowerCase();
        if (configuredInst !== incomingInst) {
          console.warn(`[Evolution Webhook] Instância diferente do configurado: recebido "${instance}", configurado "${settings.instanceName}". Processando mesmo assim.`);
        }
      }

      console.log(`[Evolution Webhook] [${new Date().toISOString()}] Evento "${event}" recebido para instância "${instance}"`);

      // Processa a mensagem com o NavoBot
      if (settings?.navoBotEnabled !== false && onWebhook) {
        try {
          const result = await onWebhook(req.body);
          console.log(`[Evolution Webhook] Resultado do processamento NavoBot:`, result);
        } catch (error) {
          console.error('[NavoBot] Falha ao processar evento do webhook:', error);
        }
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error('[Evolution Webhook] Falha geral ao processar evento:', error);
      return res.status(200).json({ received: true });
    }
  });

  // Simulador de webhook para testes no painel administrativo
  router.post('/webhook/test-inbound', requireAuth, requireAdmin, async (req, res) => {
    try {
      const phone = normalizePhone(String(req.body?.phone || '5511999999999'));
      const text = String(req.body?.text || '').trim();
      const pushName = String(req.body?.pushName || 'Cliente Teste').trim();
      const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.trim() : undefined;
      const audioUrl = typeof req.body?.audioUrl === 'string' ? req.body.audioUrl.trim() : undefined;
      const audioMimeType = typeof req.body?.audioMimeType === 'string' ? req.body.audioMimeType.trim() : 'audio/ogg; codecs=opus';
      const settings = await getSettings();

      if (!onWebhook) {
        return res.status(503).json({ error: 'NavoBot não está ativo no servidor.' });
      }

      let messagePayload: any = {
        conversation: text || 'Oi',
      };

      if (audioBase64 || audioUrl) {
        messagePayload = {
          audioMessage: {
            base64: audioBase64,
            url: audioUrl,
            mimetype: audioMimeType,
            seconds: Number(req.body?.audioSeconds || 5),
          },
        };
      }

      const mockPayload = {
        event: 'messages.upsert',
        instance: settings?.instanceName || 'navo-bot',
        data: {
          key: {
            remoteJid: `${phone}@s.whatsapp.net`,
            fromMe: false,
            id: `test_${Date.now()}`,
          },
          pushName,
          message: messagePayload,
          messageTimestamp: Math.floor(Date.now() / 1000),
        },
      };

      const result = await onWebhook(mockPayload);
      return res.json({ success: true, simulatedPayload: mockPayload, botResult: result });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Falha ao simular recebimento de webhook.' });
    }
  });

  router.post('/ai-test', requireAuth, requireAdmin, async (req, res) => {
    try {
      if (!onTestAi) {
        return res.status(503).json({
          ok: false,
          configured: false,
          usedGemini: false,
          model: 'gemini-2.5-flash',
          latencyMs: 0,
          message: 'Serviço de IA do NavoBot não inicializado.',
        });
      }
      const result: any = await onTestAi();
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({
        ok: false,
        configured: false,
        usedGemini: false,
        model: 'gemini-2.5-flash',
        latencyMs: 0,
        message: error?.message || 'Falha ao testar conexão com o Gemini.',
      });
    }
  });

  async function sendEvolutionPayload(path: string, phone: string, payload: Record<string, unknown>): Promise<boolean> {
    try {
      const settings = await requireConfigured();
      const number = normalizePhone(phone);
      if (number.length < 8 || number.length > 15) return false;
      await evolutionRequest(settings.baseUrl, settings.apiKey, `${path}/${encodeURIComponent(settings.instanceName)}`, {
        method: 'POST',
        body: JSON.stringify({ number, ...payload }),
      });
      return true;
    } catch (error) {
      console.error(`[Evolution API] Falha ao enviar mensagem interativa (${path}):`, error);
      return false;
    }
  }

  async function sendText(phone: string, text: string): Promise<boolean> {
    try {
      const settings = await requireConfigured();
      const number = normalizePhone(phone);
      if (number.length < 8 || number.length > 15) {
        console.warn(`[Evolution API] Número de telefone inválido para envio: "${phone}"`);
        return false;
      }
      const payload = {
        number,
        text,
        textMessage: { text },
        options: {
          delay: 100,
          presence: 'composing',
        },
      };
      await evolutionRequest(settings.baseUrl, settings.apiKey, `/message/sendText/${encodeURIComponent(settings.instanceName)}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      console.log(`[Evolution API] Mensagem de texto enviada com sucesso para ${number}.`);
      return true;
    } catch (error: any) {
      console.error(`[Evolution API] Falha ao enviar mensagem para ${phone}:`, error?.message || error);
      return false;
    }
  }

  async function sendButtons(phone: string, payload: WhatsAppButtonsPayload): Promise<boolean> {
    const normalizedPayload = {
      title: payload.title || 'NavoBot',
      description: payload.description || payload.text || 'Escolha uma opção',
      footerText: payload.footerText || 'NavoBot',
      buttons: payload.buttons.map((button) => ({
        type: 'reply' as const,
        displayText: button.displayText || button.buttonText?.displayText || 'Escolher',
        id: button.id || button.buttonId || 'option',
      })),
    };
    return sendEvolutionPayload('/message/sendButtons', phone, normalizedPayload);
  }

  async function sendList(phone: string, payload: WhatsAppListPayload): Promise<boolean> {
    return sendEvolutionPayload('/message/sendList', phone, {
      ...payload,
      footerText: payload.footerText || 'NavoBot',
    });
  }

  router.get('/conversations', requireAuth, requireAdmin, async (req, res) => {
    try {
      const db = getDb();
      const conversations = await db.query.navoBotConversations.findMany({
        orderBy: [desc(schema.navoBotConversations.lastInboundAt), desc(schema.navoBotConversations.updatedAt)],
        limit: 100,
      });

      const profiles = await db.query.profiles.findMany();
      const professionals = await db.query.professionals.findMany();

      const enriched = await Promise.all(conversations.map(async (conv: any) => {
        const cleanPhone = normalizePhone(conv.phone);
        const profile = profiles.find((p: any) => p.phone && normalizePhone(p.phone).endsWith(cleanPhone.slice(-8)));
        const clientName = (conv.context && typeof conv.context === 'object' && conv.context.clientName) || profile?.name || 'Cliente WhatsApp';

        // Get latest 5 messages
        const messages = await db.query.navoBotMessages.findMany({
          where: eq(schema.navoBotMessages.conversationId, conv.id),
          orderBy: [desc(schema.navoBotMessages.createdAt)],
          limit: 10,
        });

        return {
          id: conv.id,
          phone: conv.phone,
          cleanPhone,
          state: conv.state,
          handoffRequested: !!conv.handoffRequested,
          handoffReason: conv.handoffReason || null,
          assignedProfessionalId: conv.assignedProfessionalId || null,
          assignedProfessionalName: conv.assignedProfessionalName || null,
          clientName,
          clientEmail: profile?.email || null,
          lastInboundAt: conv.lastInboundAt,
          lastOutboundAt: conv.lastOutboundAt,
          resolvedAt: conv.resolvedAt,
          context: conv.context,
          messages: messages.reverse(),
        };
      }));

      res.json(enriched);
    } catch (error: any) {
      console.error('[Evolution API] Falha ao listar conversas:', error);
      return res.status(500).json({ error: error?.message || 'Não foi possível listar as conversas.' });
    }
  });

  router.post('/conversations/:id/resolve', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const db = getDb();
      const conversationId = req.params.id;
      const userName = req.user?.name || req.user?.email || 'Administrador';

      const [updated] = await db.update(schema.navoBotConversations).set({
        state: 'idle',
        handoffRequested: false,
        resolvedAt: new Date(),
        resolvedBy: userName,
        updatedAt: new Date(),
      }).where(eq(schema.navoBotConversations.id, conversationId)).returning();

      if (!updated) return res.status(404).json({ error: 'Conversa não encontrada.' });
      res.json({ success: true, conversation: updated });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Não foi possível resolver a conversa.' });
    }
  });

  router.post('/conversations/:id/resume-bot', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const db = getDb();
      const conversationId = req.params.id;
      const shouldNotifyClient = req.body?.notifyClient !== false;

      const conversation = await db.query.navoBotConversations.findFirst({
        where: eq(schema.navoBotConversations.id, conversationId),
      });

      if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada.' });

      await db.update(schema.navoBotConversations).set({
        state: 'idle',
        handoffRequested: false,
        updatedAt: new Date(),
      }).where(eq(schema.navoBotConversations.id, conversationId));

      if (shouldNotifyClient) {
        const resumeText = 'Olá! O atendimento com a nossa equipe foi concluído. Nosso assistente virtual voltou a ficar ativo. Se precisar de algo, envie *MENU* ou *AGENDAR*!';
        await sendText(conversation.phone, resumeText);
        await db.insert(schema.navoBotMessages).values({
          id: `nbm_out_${crypto.randomUUID()}`,
          conversationId: conversation.id,
          messageId: `out_${crypto.randomUUID()}`,
          phone: conversation.phone,
          direction: 'outbound',
          text: resumeText,
          intent: 'bot_resumed',
        }).onConflictDoNothing();
      }

      res.json({ success: true, message: 'Bot reativado para esta conversa.' });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Não foi possível reativar o bot.' });
    }
  });

  router.post('/conversations/:id/send-manual', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const text = String(req.body?.text || '').trim();
      if (!text) return res.status(400).json({ error: 'Informe a mensagem para envio.' });

      const db = getDb();
      const conversationId = req.params.id;

      const conversation = await db.query.navoBotConversations.findFirst({
        where: eq(schema.navoBotConversations.id, conversationId),
      });

      if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada.' });

      const sent = await sendText(conversation.phone, text);
      if (!sent) return res.status(502).json({ error: 'Falha ao despachar mensagem pelo WhatsApp.' });

      await db.insert(schema.navoBotMessages).values({
        id: `nbm_out_${crypto.randomUUID()}`,
        conversationId: conversation.id,
        messageId: `out_manual_${crypto.randomUUID()}`,
        phone: conversation.phone,
        direction: 'outbound',
        text,
        intent: 'manual_staff_reply',
      }).onConflictDoNothing();

      await db.update(schema.navoBotConversations).set({
        lastOutboundAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(schema.navoBotConversations.id, conversationId));

      res.json({ success: true, message: 'Mensagem enviada com sucesso.' });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Não foi possível enviar a mensagem manual.' });
    }
  });

  router.post('/send-test', requireAuth, requireAdmin, async (req, res) => {
    try {
      const parsed = testMessageSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: 'Informe um telefone e uma mensagem para o teste.' });
      const settings = await requireConfigured();
      const number = normalizePhone(parsed.data.number);
      if (number.length < 8 || number.length > 15) return res.status(400).json({ error: 'Informe o telefone com DDD e código do país, somente números.' });
      await evolutionRequest(settings.baseUrl, settings.apiKey, `/message/sendText/${encodeURIComponent(settings.instanceName)}`, {
        method: 'POST',
        body: JSON.stringify({ number, text: parsed.data.text }),
      });
      return res.json({ success: true, message: `Mensagem de teste enviada para ${number}.` });
    } catch (error: any) {
      return res.status(error?.status || 400).json({ error: error?.message || 'Não foi possível enviar a mensagem de teste.' });
    }
  });

  return { router, getSettings, sendText, sendButtons, sendList };
}
