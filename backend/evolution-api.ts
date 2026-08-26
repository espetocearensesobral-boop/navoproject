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
};

function normalizeBaseUrl(value: string): string {
  const raw = value.trim().replace(/\/+$/, '');
  if (!raw) return '';
  const parsed = new URL(raw);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('A URL da Evolution API deve usar HTTP ou HTTPS.');
  }
  return parsed.toString().replace(/\/+$/, '');
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

async function evolutionRequest(baseUrl: string, apiKey: string, path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = body?.message || body?.error || `Evolution API respondeu HTTP ${response.status}.`;
      const error = new Error(message) as Error & { status?: number; body?: unknown };
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

export function createEvolutionApiModule({ getDb, schema, eq, onWebhook, onInactivitySweep }: EvolutionModuleDeps) {
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
    const payload = {
      id: 'default',
      enabled: data.enabled !== undefined ? !!data.enabled : !!existing?.enabled,
      baseUrl: normalizeBaseUrl(String(data.baseUrl ?? existing?.baseUrl ?? '')),
      instanceName: String(data.instanceName ?? existing?.instanceName ?? '').trim(),
      apiKey,
      webhookEnabled: data.webhookEnabled !== undefined ? !!data.webhookEnabled : !!existing?.webhookEnabled,
      webhookUrl: String(data.webhookUrl ?? existing?.webhookUrl ?? '').trim(),
      webhookSecret: typeof data.webhookSecret === 'string' && data.webhookSecret.trim() && data.webhookSecret !== '••••••••'
        ? data.webhookSecret.trim()
        : (existing?.webhookSecret || ''),
      navoBotEnabled: data.navoBotEnabled !== undefined ? !!data.navoBotEnabled : !!existing?.navoBotEnabled,
      whatsappAccountType: data.whatsappAccountType === 'business_qr' || existing?.whatsappAccountType === 'business_qr' ? 'business_qr' : 'personal_qr',
      useInteractiveMessages: data.useInteractiveMessages !== undefined ? !!data.useInteractiveMessages : existing?.useInteractiveMessages === true,
      updatedAt: new Date(),
    };

    if (payload.webhookUrl) {
      const webhookUrl = new URL(payload.webhookUrl);
      if (!['http:', 'https:'].includes(webhookUrl.protocol)) {
        throw new Error('A URL do webhook deve usar HTTP ou HTTPS.');
      }
    }
    if (payload.webhookEnabled && !payload.webhookUrl) {
      throw new Error('Informe a URL do webhook ou desative o webhook.');
    }
    if (payload.webhookEnabled && !payload.webhookSecret) {
      throw new Error('Informe um segredo para autenticar os eventos do webhook.');
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
        const instances = await evolutionRequest(settings.baseUrl, settings.apiKey, '/instance/fetchInstances');
        const instance = Array.isArray(instances)
          ? instances.find((item: any) => item?.name === settings.instanceName || item?.instance?.instanceName === settings.instanceName)
          : null;
        return res.json({
          configured: true,
          reachable: true,
          instanceName: settings.instanceName,
          instanceStatus: instance?.connectionStatus || instance?.status || 'not_created',
          instanceExists: !!instance,
          message: 'Evolution API conectada.',
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
      const instances = await evolutionRequest(settings.baseUrl, settings.apiKey, '/instance/fetchInstances');
      const instanceExists = Array.isArray(instances) && instances.some((item: any) => item?.name === settings.instanceName || item?.instance?.instanceName === settings.instanceName);
      return res.json({ success: true, instanceExists, message: instanceExists ? 'Conexão testada e instância encontrada.' : 'Conexão testada. A instância configurada ainda não foi criada.' });
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
      await evolutionRequest(settings.baseUrl, settings.apiKey, `/webhook/set/${encodeURIComponent(settings.instanceName)}`, {
        method: 'POST',
        body: JSON.stringify({
          webhook: {
            enabled: !!settings.webhookEnabled,
            url: settings.webhookUrl || '',
            byEvents: false,
            base64: false,
            headers: { Authorization: `Bearer ${settings.webhookSecret}` },
            events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
          },
        }),
      });
      return res.json({ success: true, message: settings.webhookEnabled ? 'Webhook aplicado à instância.' : 'Webhook desativado na instância.' });
    } catch (error: any) {
      return res.status(error?.status || 400).json({ error: error?.message || 'Não foi possível aplicar o webhook.' });
    }
  });

  router.get('/webhook', async (_req, res) => {
    const settings = await getSettings();
    return res.status(200).json({
      ok: true,
      endpoint: '/api/evolution/webhook',
      accepts: 'POST',
      configured: !!(settings?.webhookEnabled && settings?.webhookSecret),
      navobotEnabled: !!settings?.navoBotEnabled,
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

  router.post('/webhook', async (req, res) => {
    try {
      const settings = await getSettings();
      if (!settings?.webhookEnabled || !settings.webhookSecret) return res.status(403).json({ error: 'Webhook não configurado.' });
      const authorization = String(req.headers.authorization || '');
      if (authorization !== `Bearer ${settings.webhookSecret}`) return res.status(401).json({ error: 'Webhook não autorizado.' });
      const event = String(req.body?.event || 'UNKNOWN');
      const instance = String(req.body?.instance || settings.instanceName || 'unknown');
      if (settings.instanceName && instance !== settings.instanceName) return res.status(403).json({ error: 'Instância não autorizada.' });
      console.log(`[Evolution Webhook] ${event} recebido para ${instance}`);
      // Aguarda o processamento para que ambientes serverless não encerrem a execução antes do envio da resposta.
      if (settings.navoBotEnabled && onWebhook) {
        try {
          await onWebhook(req.body);
        } catch (error) {
          console.error('[NavoBot] Falha ao processar webhook:', error);
        }
      }
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error('[Evolution Webhook] Falha ao processar evento:', error);
      return res.status(200).json({ received: true });
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
      if (number.length < 8 || number.length > 15) return false;
      await evolutionRequest(settings.baseUrl, settings.apiKey, `/message/sendText/${encodeURIComponent(settings.instanceName)}`, {
        method: 'POST',
        body: JSON.stringify({ number, text }),
      });
      return true;
    } catch (error) {
      console.error('[Evolution API] Falha ao enviar mensagem:', error);
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
