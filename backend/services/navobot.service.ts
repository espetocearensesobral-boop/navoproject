import crypto from 'node:crypto';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { checkSlotAvailability, fetchDaySlotContext, invalidateAvailabilityCache } from './availability.service.js';
import { NAVOBOT_CONVERSATIONAL_PROMPT, NAVOBOT_PROMPT_VERSION, NAVOBOT_SYSTEM_PROMPT } from './navobot-prompt.js';
import { getCurrentTimeBRT, getDayOfWeekKey, getTodayStringBRT, minutesToTime, timeToMinutes } from '../utils/datetime.js';
import { generateBookingCode, matchPhoneNumbers, sanitizePhone } from '../utils/index.js';
import {
  classifyDeterministicIntent,
  humanHandoffMessage,
  extractBookingCode,
  extractEvolutionMessage,
  isNegativeConfirmation,
  isPositiveConfirmation,
  normalizeIntentName,
  parseDateFromText,
  parseTimeFromText,
  findServiceMatches,
  findProfessionalMatches,
  type ExtractedEvolutionAudio,
  type ExtractedEvolutionMessage,
  type NavoBotIntent,
} from './navobot-intent.js';

const ACTIVE_STATUSES = new Set(['confirmed', 'pending', 'pending_approval', 'in_queue', 'in_service']);
const TERMINAL_STATUSES = new Set(['cancelled', 'completed', 'no_show']);
const CONVERSATION_TTL_MS = 30 * 60 * 1000;
const NAVO_CATALOG_URL = 'https://navoproject.vercel.app/?catalog=1';

export type NavoBotDeps = {
  getDb: () => any;
  schema: any;
  sendText: (phone: string, text: string) => Promise<boolean>;
  sendButtons: (phone: string, payload: any) => Promise<boolean>;
  sendList: (phone: string, payload: any) => Promise<boolean>;
  fetchMediaBase64?: (messageId: string, rawMessage?: any) => Promise<{ base64?: string; mimetype?: string } | null>;
  useInteractiveMessages?: () => Promise<boolean>;
};

type BotContext = {
  pendingAction?: 'book' | 'reschedule' | 'cancel' | 'cancel_all';
  appointmentId?: string;
  candidateAppointmentIds?: string[];
  bulkAppointmentIds?: string[];
  serviceId?: string;
  serviceIds?: string[];
  serviceOptions?: string[];
  servicePage?: number;
  professionalOptions?: string[];
  date?: string;
  timeSlot?: string;
  professionalId?: string;
  clientName?: string;
  availabilityDate?: string;
  availabilityOptions?: string[];
  inactivityReminderSentAt?: string;
  humanFollowUpCount?: number;
};

type Conversation = {
  id: string;
  phone: string;
  instanceName: string;
  state: string;
  context: BotContext;
  handoffRequested: boolean;
};

const GEMINI_NAVOBOT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

function normalizeContext(value: unknown): BotContext {
  if (!value || typeof value !== 'object') return {};
  return value as BotContext;
}

function contextForNewIntent(context: BotContext, extra: Partial<BotContext> = {}): BotContext {
  return {
    ...(context.clientName ? { clientName: context.clientName } : {}),
    ...extra,
  };
}

function money(value: unknown): string {
  const amount = Number(value || 0);
  return `R$ ${amount.toFixed(2).replace('.', ',')}`;
}

function dateLabel(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function safeInstanceName(value: string): string {
  return value.trim() || 'navo-bot';
}

function conversationId(phone: string, instanceName: string): string {
  return `nbc_${phone}_${safeInstanceName(instanceName).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function menuText(name?: string): string {
  const greeting = name ? `Olá, *${name}*!` : 'Olá!';
  return `${greeting} Sou o *NavoBot* 🤖\n\n` +
    'Como posso te ajudar?\n\n' +
    '*1*. ✂️ Novo agendamento\n' +
    '*2*. 📅 Meus agendamentos\n' +
    '*3*. 🔄 Reagendar\n' +
    '*4*. ❌ Cancelar\n' +
    '*5*. 👤 Falar com a equipe\n\n' +
    '💡 _Dica: Pode digitar livremente, ex: "reagendar para amanhã às 15h"_';
}

function serviceLabel(service: any): string {
  return `${service.title} · ${service.durationMinutes} min · ${money(service.price)}`;
}

function appointmentLabel(appointment: any): string {
  const service = Array.isArray(appointment.services) && appointment.services[0]
    ? typeof appointment.services[0] === 'string' ? appointment.services[0] : appointment.services[0].title
    : 'Agendamento';
  return `▪️ ${service}\n📅 ${dateLabel(appointment.date)} às ${appointment.timeSlot}`;
}

function confirmationText(action: 'book' | 'reschedule' | 'cancel', appointment: any, context: BotContext, services: any[] = []): string {
  if (action === 'cancel') {
    return `⚠️ Confirma o cancelamento?\n\n${appointmentLabel(appointment)}\n\nResponda *SIM* ou *NÃO*.`;
  }
  if (action === 'reschedule') {
    return `🔄 Confirma o novo horário?\n\n📅 *${dateLabel(context.date || appointment.date)}*\n⏰ *${context.timeSlot || appointment.timeSlot}*\n\nResponda *SIM* ou *NÃO*.`;
  }
  const serviceLines = services.length
    ? services.map((service) => `▪️ ${service.title}\n  └ ${service.durationMinutes}min • ${money(service.price)}`).join('\n')
    : '▪️ Serviço a definir';
  return `✅ *Confira seu agendamento:*\n\n${serviceLines}\n\n📅 Data: *${dateLabel(context.date || '')}*\n⏰ Hora: *${context.timeSlot || ''}*\n👤 Prof: *${appointment?.professionalName || 'Qualquer'}*\n\nTudo certo? Responda *SIM* ou *NÃO*.`;
}

function confirmationPayload(action: 'book' | 'reschedule' | 'cancel', appointment: any, context: BotContext, services: any[] = []) {
  const text = confirmationText(action, appointment, context, services);
  const buttons = action === 'cancel'
    ? [
        { type: 'reply' as const, id: 'confirm:yes', displayText: 'Sim, cancelar' },
        { type: 'reply' as const, id: 'confirm:no', displayText: 'Não' },
      ]
    : [
        { type: 'reply' as const, id: 'confirm:yes', displayText: '👍 Confirmar' },
        { type: 'reply' as const, id: 'confirm:no', displayText: '❌ Cancelar' },
      ];
  return {
    title: action === 'cancel' ? 'Cancelar?' : action === 'reschedule' ? 'Confirmar Novo Horário' : 'Confirmar Agendamento',
    description: text,
    footerText: 'NavoBot',
    buttons,
  };
}

function numericSelection(text: string): number | null {
  const value = Number(text.trim());
  return Number.isInteger(value) && value > 0 ? value - 1 : null;
}

function extractGeminiText(response: any): string {
  const direct = typeof response?.text === 'function' ? response.text() : response?.text;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const parts = (response?.candidates || [])
    .flatMap((candidate: any) => candidate?.content?.parts || [])
    .map((part: any) => typeof part?.text === 'string' ? part.text : '')
    .filter(Boolean);
  return parts.join('').trim();
}

function geminiResponseDiagnostics(response: any): string {
  const finishReason = response?.candidates?.[0]?.finishReason;
  const blockReason = response?.promptFeedback?.blockReason;
  return [finishReason && `finishReason=${finishReason}`, blockReason && `blockReason=${blockReason}`].filter(Boolean).join(', ');
}

async function transcribeAudioWithGemini(
  audio: ExtractedEvolutionAudio,
  messageId?: string,
  fetchMediaBase64?: (messageId: string, rawMessage?: any) => Promise<{ base64?: string; mimetype?: string } | null>
): Promise<string | null> {
  const ai = getAiClient();
  if (!ai) {
    console.warn('[NavoBot][Voice] Transcrição de áudio não realizada: GEMINI_API_KEY ausente.');
    return null;
  }

  let base64Data = audio.base64;
  let mimeType = audio.mimetype || 'audio/ogg; codecs=opus';

  // 1. Se não tiver base64 imediato, tenta obter via Evolution API decrypt endpoint
  if (!base64Data && fetchMediaBase64 && (messageId || audio.rawMessage)) {
    try {
      console.info(`[NavoBot][Voice] Solicitando base64 do áudio decriptografado à Evolution API (id: ${messageId})...`);
      const mediaResult = await fetchMediaBase64(messageId || '', audio.rawMessage);
      if (mediaResult?.base64) {
        base64Data = mediaResult.base64;
        if (mediaResult.mimetype) mimeType = mediaResult.mimetype;
        console.info(`[NavoBot][Voice] Áudio obtido com sucesso da Evolution API (${base64Data.length} chars).`);
      }
    } catch (err: any) {
      console.warn(`[NavoBot][Voice] Erro ao buscar áudio decriptografado via Evolution API: ${err?.message || err}`);
    }
  }

  // 2. Se vier apenas a URL acessível (ex: MinIO/S3/HTTP público), faz o download
  if (!base64Data && audio.url) {
    try {
      console.info(`[NavoBot][Voice] Tentando baixar áudio da URL: ${audio.url.slice(0, 60)}...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(audio.url, {
        headers: { 'User-Agent': 'NavoBot/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        base64Data = Buffer.from(arrayBuffer).toString('base64');
        const detectedMime = response.headers.get('content-type');
        if (detectedMime) mimeType = detectedMime;
      } else {
        console.warn(`[NavoBot][Voice] Falha ao baixar áudio da URL: status ${response.status}`);
      }
    } catch (err: any) {
      console.warn(`[NavoBot][Voice] Erro ao baixar áudio da URL: ${err?.message || err}`);
    }
  }

  // 3. Se o base64 contiver data URL prefix (ex: data:audio/ogg;base64,...), limpa
  if (base64Data && base64Data.includes('base64,')) {
    const parts = base64Data.split('base64,');
    const mimeMatch = parts[0].match(/data:(.*?);/);
    if (mimeMatch?.[1]) mimeType = mimeMatch[1];
    base64Data = parts[1];
  }

  if (!base64Data || base64Data.trim().length < 10) {
    console.warn('[NavoBot][Voice] Mensagem de áudio recebida sem dados base64 nem URL acessível.');
    return null;
  }

  // Normaliza o MIME type para formato suportado pelo Gemini
  let normalizedMimeType = (mimeType || 'audio/ogg').split(';')[0].trim().toLowerCase();
  if (!normalizedMimeType || normalizedMimeType === 'audio/*' || normalizedMimeType.includes('opus') || normalizedMimeType.includes('ogg')) {
    normalizedMimeType = 'audio/ogg';
  } else if (normalizedMimeType.includes('mp3') || normalizedMimeType.includes('mpeg')) {
    normalizedMimeType = 'audio/mp3';
  } else if (normalizedMimeType.includes('wav')) {
    normalizedMimeType = 'audio/wav';
  } else if (normalizedMimeType.includes('m4a') || normalizedMimeType.includes('mp4') || normalizedMimeType.includes('aac')) {
    normalizedMimeType = 'audio/aac';
  } else if (normalizedMimeType.includes('webm')) {
    normalizedMimeType = 'audio/webm';
  }

  try {
    console.info(`[NavoBot][Voice] Transcrevendo áudio com Gemini (mime: ${normalizedMimeType}, model: ${GEMINI_NAVOBOT_MODEL})...`);
    const response = await ai.models.generateContent({
      model: GEMINI_NAVOBOT_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data.trim(),
                mimeType: normalizedMimeType,
              },
            },
            {
              text: 'Transcreva com precisão o que o cliente disse neste áudio em português do Brasil. Retorne EXCLUSIVAMENTE o texto transcrito, sem introduções, sem aspas e sem explicações. Se o áudio for inaudível, vazio ou ruído estático, responda apenas "[INAUDIVEL]".',
            },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 256,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });

    const transcribed = extractGeminiText(response);
    if (transcribed && !transcribed.includes('[INAUDIVEL]')) {
      const clean = transcribed.replace(/^["']|["']$/g, '').trim();
      console.info(`[NavoBot][Voice] Áudio transcrito com sucesso: "${clean}"`);
      return clean;
    }
    console.warn(`[NavoBot][Voice] Gemini processou áudio mas não retornou texto transcrito útil. ${geminiResponseDiagnostics(response)}`);
    return null;
  } catch (error: any) {
    console.error('[NavoBot][Voice] Erro ao transcrever áudio com Gemini:', error?.message || error);
    return null;
  }
}

async function classifyWithAi(text: string, state: string, context: BotContext = {}): Promise<NavoBotIntent> {
  const ai = getAiClient();
  if (!ai) {
    console.warn('[NavoBot][Gemini] Fallback não utilizado: GEMINI_API_KEY ausente.');
    return 'unknown';
  }
  if (text.length > 1200) {
    console.info('[NavoBot][Gemini] Fallback ignorado: mensagem acima de 1200 caracteres.');
    return 'unknown';
  }
  try {
    console.info(`[NavoBot][Gemini] Classificando mensagem no estado ${state} com modelo ${GEMINI_NAVOBOT_MODEL}.`);
    const response = await ai.models.generateContent({
      model: GEMINI_NAVOBOT_MODEL,
      contents: [{ role: 'user', parts: [{ text: `Estado atual: ${state}\nContexto já coletado: ${JSON.stringify({ pendingAction: context.pendingAction, appointmentId: context.appointmentId, serviceIds: context.serviceIds, date: context.date, timeSlot: context.timeSlot, professionalId: context.professionalId })}\nMensagem do cliente: ${text}` }] }],
      config: {
        temperature: 0.1,
        maxOutputTokens: 128,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            intent: {
              type: 'STRING',
              enum: [
                'menu',
                'appointments',
                'availability',
                'book',
                'confirm',
                'reschedule',
                'cancel',
                'cancel_all',
                'complaint',
                'human',
                'shop_info',
                'next_slot',
                'last_slot',
                'barbers',
                'service_info',
                'unknown',
              ],
            },
            confidence: { type: 'NUMBER' },
          },
          required: ['intent', 'confidence'],
        } as any,
        systemInstruction: `${NAVOBOT_SYSTEM_PROMPT}\n\nVersão da política: ${NAVOBOT_PROMPT_VERSION}`,
      },
    });
    const responseText = extractGeminiText(response);
    if (!responseText) {
      console.warn(`[NavoBot][Gemini] Resposta sem texto${geminiResponseDiagnostics(response) ? ` (${geminiResponseDiagnostics(response)})` : ''}.`);
      return 'unknown';
    }
    const parsed = JSON.parse(responseText);
    const confidence = Number(parsed.confidence || 0);
    const intent = confidence >= 0.65 ? normalizeIntentName(parsed.intent) : 'unknown';
    console.info(`[NavoBot][Gemini] Resultado: ${intent} (confiança ${confidence.toFixed(2)}).`);
    return intent;
  } catch (error) {
    console.warn('[NavoBot] Falha no classificador de IA; seguindo com fluxo determinístico.', error);
    return 'unknown';
  }
}

export function createNavoBotService({ getDb, schema, sendText, sendButtons, sendList, fetchMediaBase64, useInteractiveMessages }: NavoBotDeps) {
  async function getConversation(phone: string, instanceName: string): Promise<Conversation> {
    const db = getDb();
    const normalizedPhone = sanitizePhone(phone);
    const normalizedInstance = safeInstanceName(instanceName);
    const id = conversationId(normalizedPhone, normalizedInstance);
    const [existing] = await db.select().from(schema.navoBotConversations).where(eq(schema.navoBotConversations.id, id)).limit(1);
    if (existing) {
      const expired = existing.expiresAt && new Date(existing.expiresAt).getTime() < Date.now();
      return {
        ...existing,
        state: expired ? 'idle' : existing.state,
        context: expired ? {} : normalizeContext(existing.context),
        handoffRequested: expired ? false : !!existing.handoffRequested,
      };
    }

    const [created] = await db.insert(schema.navoBotConversations).values({
      id,
      phone: normalizedPhone,
      instanceName: normalizedInstance,
      state: 'idle',
      context: {},
      expiresAt: new Date(Date.now() + CONVERSATION_TTL_MS),
    }).returning();
    return { ...created, context: normalizeContext(created.context), handoffRequested: !!created.handoffRequested };
  }

  async function updateConversation(conversation: Conversation, state: string, context: BotContext, handoffRequested = false) {
    const db = getDb();
    await db.update(schema.navoBotConversations).set({
      state,
      context,
      handoffRequested,
      expiresAt: new Date(Date.now() + CONVERSATION_TTL_MS),
      updatedAt: new Date(),
    }).where(eq(schema.navoBotConversations.id, conversation.id));
    conversation.state = state;
    conversation.context = context;
    conversation.handoffRequested = handoffRequested;
  }

  async function recordInbound(conversation: Conversation, message: ExtractedEvolutionMessage, intent: string | null): Promise<boolean> {
    const db = getDb();
    const [saved] = await db.insert(schema.navoBotMessages).values({
      id: `nbm_in_${message.messageId}`,
      conversationId: conversation.id,
      messageId: message.messageId,
      phone: message.phone,
      direction: 'inbound',
      text: message.text,
      intent,
    }).onConflictDoNothing().returning({ id: schema.navoBotMessages.id });
    if (!saved) return false;
    await db.update(schema.navoBotConversations).set({
      lastInboundMessageId: message.messageId,
      lastInboundAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(schema.navoBotConversations.id, conversation.id));
    return true;
  }

  async function recordOutbound(conversation: Conversation, text: string) {
    const db = getDb();
    await db.insert(schema.navoBotMessages).values({
      id: `nbm_out_${crypto.randomUUID()}`,
      conversationId: conversation.id,
      messageId: `out_${crypto.randomUUID()}`,
      phone: conversation.phone,
      direction: 'outbound',
      text,
      intent: null,
    }).onConflictDoNothing();
    await db.update(schema.navoBotConversations).set({ lastOutboundAt: new Date(), updatedAt: new Date() }).where(eq(schema.navoBotConversations.id, conversation.id));
  }

  async function reply(conversation: Conversation, text: string) {
    const sent = await sendText(conversation.phone, text);
    await recordOutbound(conversation, text);
    return sent;
  }

  async function notifyStaffViaWhatsApp({
    conversation,
    context,
    clientMessage,
    reason,
    targetProfId,
  }: {
    conversation: Conversation;
    context: BotContext;
    clientMessage: string;
    reason: 'human_request' | 'complaint' | 'unresolved' | 'booking_conflict' | string;
    targetProfId?: string;
  }) {
    try {
      const db = getDb();
      const settings = await db.query.evolutionApiSettings.findFirst({
        where: eq(schema.evolutionApiSettings.id, 'default'),
      });

      if (!settings?.enabled || !settings?.navoBotEnabled) return;

      const rawClientPhone = sanitizePhone(conversation.phone);
      const cleanPhone = rawClientPhone.replace(/\D/g, '');
      const clientName = String(context.clientName || '').trim() || 'Cliente WhatsApp';

      // Identifica o profissional selecionado ou com agendamento ativo
      let profId = targetProfId || (context.professionalId && context.professionalId !== 'prof_any' ? context.professionalId : '');
      let matchedAppointment: any = null;

      if (!profId) {
        const appointments = await findAppointments(conversation.phone);
        if (appointments.length > 0) {
          matchedAppointment = appointments[0];
          profId = matchedAppointment.professionalId;
        }
      }

      let assignedBarber: any = null;
      if (profId) {
        const professionals = await db.query.professionals.findMany();
        assignedBarber = professionals.find((p: any) => p.id === profId);

        // Se o barbeiro não tiver telefone na tabela de profissionais, busca na tabela profiles vinculada
        if (assignedBarber && !assignedBarber.phone && assignedBarber.userId) {
          const profProfile = await db.query.profiles.findFirst({
            where: eq(schema.profiles.id, assignedBarber.userId),
          });
          if (profProfile?.phone) {
            assignedBarber = { ...assignedBarber, phone: profProfile.phone };
          }
        }
      }

      const reasonLabels: Record<string, string> = {
        human_request: 'Solicitação de Atendente / Barbeiro',
        complaint: 'Reclamação de Cliente',
        unresolved: 'Dúvida ou Solicitação fora do escopo do Bot',
        booking_conflict: 'Dificuldade no agendamento / Conflito de horário',
      };
      const reasonText = reasonLabels[reason] || reason;

      const encodedClientName = encodeURIComponent(clientName);
      const waLink = `https://wa.me/${cleanPhone}?text=Ol%C3%A1%20${encodedClientName},%20sou%20da%20equipe%20da%20Navo%20Barber!`;

      // 1. Notificar Barbeiro responsável se ativo e tiver telefone cadastrado
      const notifyBarber = settings.notifyBarberOnHandoff !== false;
      if (notifyBarber && assignedBarber?.phone) {
        const barberPhone = sanitizePhone(assignedBarber.phone).replace(/\D/g, '');
        if (barberPhone && barberPhone !== cleanPhone) {
          const barberMessage =
            `💈 *[Navo Barber - Encaminhamento de Cliente]*\n\n` +
            `Olá *${assignedBarber.name}*, um cliente solicitou atendimento no WhatsApp da barbearia!\n\n` +
            `👤 *Cliente:* ${clientName}\n` +
            `📞 *Telefone:* ${rawClientPhone}\n` +
            `📌 *Motivo:* ${reasonText}\n` +
            `💬 *Mensagem:* "${clientMessage}"\n` +
            (matchedAppointment ? `📅 *Agendamento:* ${dateLabel(matchedAppointment.date)} às ${matchedAppointment.timeSlot}\n` : '') +
            `\n📲 *Clique abaixo para falar direto com o cliente:*\n${waLink}`;

          await sendText(barberPhone, barberMessage);
        }
      }

      // 2. Notificar Gerência / Recepção se telefone configurado
      const notifyManager = settings.notifyManagerOnHandoff !== false;
      const managerPhone = sanitizePhone(settings.managerNotificationPhone || '').replace(/\D/g, '');

      if (notifyManager && managerPhone && managerPhone !== cleanPhone) {
        const managerMessage =
          `🔔 *[Navo Barber - Alerta de Atendimento Humano]*\n\n` +
          `Um cliente no WhatsApp foi transferido para a equipe.\n\n` +
          `👤 *Cliente:* ${clientName} (${rawClientPhone})\n` +
          `✂️ *Barbeiro vinculado:* ${assignedBarber?.name || 'Geral / Não atribuído'}\n` +
          `📌 *Motivo:* ${reasonText}\n` +
          `💬 *Mensagem do Cliente:* "${clientMessage}"\n` +
          (matchedAppointment ? `📅 *Agendamento:* ${dateLabel(matchedAppointment.date)} às ${matchedAppointment.timeSlot}\n` : '') +
          `\n📲 *Clique para responder o cliente no WhatsApp:*\n${waLink}`;

        await sendText(managerPhone, managerMessage);
      }

      // Atualiza o registro da conversa no banco
      await db.update(schema.navoBotConversations).set({
        handoffRequested: true,
        handoffReason: reason,
        assignedProfessionalId: assignedBarber?.id || null,
        assignedProfessionalName: assignedBarber?.name || null,
        updatedAt: new Date(),
      }).where(eq(schema.navoBotConversations.id, conversation.id));

    } catch (error) {
      console.error('[NavoBot] Falha ao enviar notificação de handoff aos profissionais/gerente:', error);
    }
  }

  async function notifyStaffFollowUp({
    conversation,
    context,
    clientMessage,
    followUpCount,
  }: {
    conversation: Conversation;
    context: BotContext;
    clientMessage: string;
    followUpCount: number;
  }) {
    try {
      const db = getDb();
      const settings = await db.query.evolutionApiSettings.findFirst({
        where: eq(schema.evolutionApiSettings.id, 'default'),
      });
      if (!settings?.enabled || !settings?.navoBotEnabled) return;

      const rawClientPhone = sanitizePhone(conversation.phone);
      const cleanPhone = rawClientPhone.replace(/\D/g, '');
      const clientName = String(context.clientName || '').trim() || 'Cliente WhatsApp';
      const waLink = `https://wa.me/${cleanPhone}`;

      let targetPhone = '';
      if ((conversation as any).assignedProfessionalId) {
        const prof = await db.query.professionals.findFirst({
          where: eq(schema.professionals.id, (conversation as any).assignedProfessionalId),
        });
        targetPhone = prof?.phone || '';
      }
      if (!targetPhone && settings.managerNotificationPhone) {
        targetPhone = settings.managerNotificationPhone;
      }

      const cleanTargetPhone = sanitizePhone(targetPhone).replace(/\D/g, '');
      if (cleanTargetPhone && cleanTargetPhone !== cleanPhone) {
        const followUpMsg =
          `💬 *[NavoBot - Nova mensagem de cliente aguardando atendimento]*\n\n` +
          `👤 *Cliente:* ${clientName} (${rawClientPhone})\n` +
          `💬 *Mensagem:* "${clientMessage}"\n\n` +
          `📲 *Responder no WhatsApp:* ${waLink}`;
        await sendText(cleanTargetPhone, followUpMsg);
      }
    } catch (error) {
      console.error('[NavoBot] Falha ao notificar follow-up de handoff:', error);
    }
  }

  async function handleHumanState(conversation: Conversation, context: BotContext, text: string, contextualIntent: NavoBotIntent | null) {
    const stateIntent = contextualIntent || classifyDeterministicIntent(text);
    if (stateIntent === 'menu') {
      await updateConversation(conversation, 'idle', {});
      return reply(conversation, menuText());
    }
    if (stateIntent === 'gratitude') {
      await updateConversation(conversation, 'idle', {});
      return reply(conversation, 'De nada! Estou à disposição. Se precisar de algo, é só chamar! 👋');
    }

    const nextContext = contextForNewIntent(context);
    if (stateIntent === 'appointments') {
      await updateConversation(conversation, 'idle', nextContext);
      return listAppointments(conversation);
    }
    if (stateIntent === 'availability') {
      await updateConversation(conversation, 'idle', nextContext);
      return handleAvailabilityRequest(conversation, nextContext, text);
    }
    if (stateIntent === 'book') {
      const bookingContext = { ...nextContext, pendingAction: 'book' as const };
      await updateConversation(conversation, 'idle', bookingContext);
      return startBooking(conversation, bookingContext, text);
    }
    if (stateIntent === 'cancel') {
      const cancelContext = { ...nextContext, pendingAction: 'cancel' as const };
      await updateConversation(conversation, 'idle', cancelContext);
      return beginAppointmentAction(conversation, cancelContext, 'cancel');
    }
    if (stateIntent === 'cancel_all') {
      const cancelAllContext = { ...nextContext, pendingAction: 'cancel_all' as const };
      await updateConversation(conversation, 'idle', cancelAllContext);
      return beginBulkCancellation(conversation, cancelAllContext);
    }
    if (stateIntent === 'reschedule') {
      const rescheduleContext = { ...nextContext, pendingAction: 'reschedule' as const };
      await updateConversation(conversation, 'idle', rescheduleContext);
      return beginAppointmentAction(conversation, rescheduleContext, 'reschedule');
    }

    const followUpCount = Number(context.humanFollowUpCount || 0);
    await updateConversation(conversation, 'human', { ...context, humanFollowUpCount: followUpCount + 1 }, true);
    await notifyStaffFollowUp({ conversation, context, clientMessage: text, followUpCount: followUpCount + 1 });
    return reply(conversation, humanHandoffMessage(followUpCount));
  }

  async function interactiveMessagesEnabled() {
    if (!useInteractiveMessages) return false;
    try {
      return await useInteractiveMessages();
    } catch (error) {
      console.warn('[NavoBot] Não foi possível ler a configuração de mensagens interativas; usando somente texto.', error);
      return false;
    }
  }

  async function replyList(conversation: Conversation, fallbackText: string, payload: any) {
    if (!(await interactiveMessagesEnabled())) return reply(conversation, fallbackText);
    const sent = await sendList(conversation.phone, payload);
    if (!sent) return reply(conversation, fallbackText);
    await recordOutbound(conversation, fallbackText);
    return sent;
  }

  async function replyButtons(conversation: Conversation, fallbackText: string, payload: any) {
    if (!(await interactiveMessagesEnabled())) return reply(conversation, fallbackText);
    const sent = await sendButtons(conversation.phone, payload);
    if (!sent) return reply(conversation, fallbackText);
    await recordOutbound(conversation, fallbackText);
    return sent;
  }

  async function replyConfirmation(conversation: Conversation, action: 'book' | 'reschedule' | 'cancel', appointment: any, context: BotContext, services: any[] = []) {
    const fallback = confirmationText(action, appointment, context, services);
    return replyButtons(conversation, fallback, confirmationPayload(action, appointment, context, services));
  }

  async function syncClientIdentity(phone: string, pushName?: string) {
    const recognizedName = String(pushName || '').trim();
    if (!recognizedName || /^cliente whatsapp$/i.test(recognizedName)) return;
    const db = getDb();
    const normalizedPhone = sanitizePhone(phone);
    const profiles = await db.query.profiles.findMany();
    const profile = profiles.find((candidate: any) => candidate.phone && matchPhoneNumbers(candidate.phone, normalizedPhone));
    if (!profile) return;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (!profile.name || /^cliente whatsapp$/i.test(String(profile.name).trim())) updates.name = recognizedName;
    const hasLegacyEmail = String(profile.email || '').endsWith('@whatsapp.navo.local');
    if (hasLegacyEmail) updates.email = `wa_${normalizedPhone}`;
    if (Object.keys(updates).length > 1) {
      await db.transaction(async (tx: any) => {
        await tx.update(schema.profiles).set(updates).where(eq(schema.profiles.id, profile.id));
        const appointmentUpdates: Record<string, unknown> = {};
        if (updates.name) appointmentUpdates.clientName = recognizedName;
        if (hasLegacyEmail) appointmentUpdates.clientEmail = null;
        if (Object.keys(appointmentUpdates).length > 0) {
          await tx.update(schema.appointments).set(appointmentUpdates).where(eq(schema.appointments.clientId, profile.id));
        }
      });
    }
  }

  async function findAppointments(phone: string) {
    const db = getDb();
    const appointments = await db.query.appointments.findMany({ orderBy: [desc(schema.appointments.date), desc(schema.appointments.timeSlot)] });
    return appointments
      .filter((appointment: any) => matchPhoneNumbers(appointment.clientPhone || '', phone))
      .filter((appointment: any) => !TERMINAL_STATUSES.has(appointment.status))
      .sort((a: any, b: any) => `${a.date} ${a.timeSlot}`.localeCompare(`${b.date} ${b.timeSlot}`));
  }

  async function findAppointment(conversation: Conversation, context: BotContext, text?: string) {
    const db = getDb();
    const appointments = await findAppointments(conversation.phone);
    if (context.appointmentId) {
      const exact = appointments.find((appointment: any) => appointment.id === context.appointmentId);
      if (exact) return exact;
    }
    const code = text ? extractBookingCode(text) : null;
    if (code) {
      const exact = appointments.find((appointment: any) => String(appointment.bookingCode || appointment.id).toUpperCase() === code);
      if (exact) return exact;
    }
    if (appointments.length === 1) return appointments[0];
    if (appointments.length > 1) {
      context.candidateAppointmentIds = appointments.map((appointment: any) => appointment.id);
      await updateConversation(conversation, 'awaiting_appointment', context);
      await reply(conversation, 'Encontrei mais de um agendamento. Responda com o código do voucher correspondente:\n\n' + appointments.map((appointment: any) => `• *${appointment.bookingCode || appointment.id}* — ${appointmentLabel(appointment)}`).join('\n'));
    }
    return null;
  }

  async function listAppointments(conversation: Conversation) {
    const appointments = await findAppointments(conversation.phone);
    if (appointments.length === 0) {
      return reply(conversation, 'Não encontrei agendamentos ativos para este número. Para criar um novo, responda *AGENDAR*.');
    }
    return reply(conversation, 'Seus agendamentos ativos:\n\n' + appointments.map((appointment: any) => `• *${appointment.bookingCode || appointment.id}* — ${appointmentLabel(appointment)}\nStatus: ${appointment.status}`).join('\n\n'));
  }

  function captureInlineDateTime(context: BotContext, text: string) {
    const date = parseDateFromText(text);
    const time = parseTimeFromText(text);
    if (date) context.date = date;
    if (time) context.timeSlot = time;
  }

  function compactServiceTitle(value: unknown, maxLength = 30): string {
    const title = String(value || '').replace(/\s+/g, ' ').trim();
    return title.length > maxLength ? `${title.slice(0, maxLength - 1).trimEnd()}…` : title;
  }

  async function listServices(conversation: Conversation, context: BotContext) {
    const db = getDb();
    const services = await db.query.services.findMany();
    const activeServices = services.filter((service: any) => service.title && Number(service.durationMinutes) > 0);
    context.servicePage = 0;
    context.serviceOptions = activeServices.map((service: any) => service.id);
    await updateConversation(conversation, 'awaiting_service', context);
    const fallback = `✂️ *Escolha o serviço* (número ou nome):\n\n` + activeServices.map((service: any, index: number) => `*${index + 1}*. ${compactServiceTitle(service.title, 35)}\n  └ ${service.durationMinutes}min • ${money(service.price)}`).join('\n') + `\n\n🌐 Catálogo completo online:\n${NAVO_CATALOG_URL}`;
    const rows = activeServices.map((service: any, index: number) => ({
      title: `${index + 1}. ${compactServiceTitle(service.title, 20)}`,
      rowId: `service:${service.id}`,
      description: `${service.durationMinutes}min • ${money(service.price)}`.slice(0, 72),
    }));
    const payload = {
      title: 'Catálogo de Serviços',
      description: 'Escolha qual serviço deseja agendar.',
      buttonText: 'Ver serviços',
      footerText: 'NavoBot',
      sections: [{ title: 'Disponíveis', rows: rows.slice(0, 10) }],
    };
    // Listas interativas do WhatsApp têm limite de linhas; quando houver mais
    // serviços, o fallback textual mantém todos visíveis sem paginação.
    return activeServices.length > 10 ? reply(conversation, fallback) : replyList(conversation, fallback, payload);
  }

  async function getServices(context: BotContext) {
    const db = getDb();
    const ids = context.serviceIds?.length ? context.serviceIds : context.serviceId ? [context.serviceId] : [];
    if (!ids.length) return [];
    const services = await db.query.services.findMany();
    return ids.map((id) => services.find((service: any) => service.id === id)).filter(Boolean);
  }

  async function askMoreServices(conversation: Conversation, context: BotContext) {
    const services = await getServices(context);
    const selected = services.map((service: any) => `▪️ ${service.title}`).join('\n') || 'Nenhum selecionado';
    const fallback = `✅ *Serviço anotado:*\n${selected}\n\nDeseja incluir mais algum? Responda *SIM* ou *NÃO*.`;
    await updateConversation(conversation, 'awaiting_more_services', context);
    return replyButtons(conversation, fallback, {
      title: 'Serviço anotado',
      description: `✅ ${services.length} selecionado(s)\nDeseja incluir mais algum?`,
      footerText: 'NavoBot',
      buttons: [
        { type: 'reply', id: 'service:add', displayText: '👍 Sim' },
        { type: 'reply', id: 'service:done', displayText: '❌ Não' },
      ],
    });
  }

  async function askProfessional(conversation: Conversation, context: BotContext) {
    const db = getDb();
    const professionals = (await db.query.professionals.findMany()).filter((professional: any) => professional.isActive !== false);
    context.professionalOptions = ['prof_any', ...professionals.map((professional: any) => professional.id)];
    await updateConversation(conversation, 'awaiting_professional', context);
    const fallback = '👤 *Selecione o profissional* (envie o número):\n\n*0*. 🎲 Qualquer profissional\n' + professionals.map((professional: any, index: number) => `*${index + 1}*. ${professional.name}`).join('\n');
    const payload = {
      title: 'Profissionais',
      description: 'Escolha quem vai te atender.',
      buttonText: 'Ver profissionais',
      footerText: 'NavoBot',
      sections: [{
        title: 'Disponíveis',
        rows: [
          { title: 'Qualquer profissional', rowId: 'professional:prof_any', description: 'Encontrar mais horários livres' },
          ...professionals.slice(0, 9).map((professional: any) => ({
            title: String(professional.name).slice(0, 24),
            rowId: `professional:${professional.id}`,
            description: String(professional.roleTitle || 'Especialista').slice(0, 72),
          })),
        ],
      }],
    };
    return replyList(conversation, fallback, payload);
  }

  async function continueAfterProfessional(conversation: Conversation, context: BotContext) {
    if (!context.date) {
      await updateConversation(conversation, 'awaiting_date', context);
      return reply(conversation, 'Informe o dia. Exemplos de formato: *amanhã*, *sábado*, *dia 22* ou *25/08*.');
    }
    if (!context.timeSlot) {
      await updateConversation(conversation, 'awaiting_time', context);
      return reply(conversation, `Para *${dateLabel(context.date)}*, informe o horário desejado.`);
    }
    return prepareBookingConfirmation(conversation, context);
  }

  async function startBooking(conversation: Conversation, context: BotContext, text: string) {
    context.pendingAction = 'book';
    context.serviceIds = context.serviceIds || [];
    const db = getDb();
    const services = await db.query.services.findMany();
    const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const matchedService = services.find((service: any) => normalized.includes(String(service.title).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
    if (matchedService && !context.serviceIds.includes(matchedService.id)) context.serviceIds.push(matchedService.id);
    const date = parseDateFromText(text);
    const time = parseTimeFromText(text);
    if (date) context.date = date;
    if (time) context.timeSlot = time;
    if (!context.serviceIds.length) return listServices(conversation, context);
    return askMoreServices(conversation, context);
  }

  async function handleAvailabilityRequest(conversation: Conversation, context: BotContext, text: string) {
    const db = getDb();
    const services = (await db.query.services.findMany()).filter((service: any) => service.title && Number(service.durationMinutes) > 0);
    const contextServices = context.serviceIds?.length
      ? services.filter((service: any) => context.serviceIds?.includes(service.id))
      : [];
    const deterministicMatches = findServiceMatches(services, text);
    const matchedServices = contextServices.length ? contextServices : deterministicMatches;
    if (matchedServices.length === 0) {
      const nextContext = contextForNewIntent(context, {
        availabilityDate: parseDateFromText(text) || context.availabilityDate || getTodayStringBRT(),
        availabilityOptions: [],
        serviceIds: [],
        serviceId: undefined,
      });
      await updateConversation(conversation, 'awaiting_availability_service', nextContext);
      return reply(conversation, 'Para consultar os horários livres, preciso saber qual *serviço* você deseja (a duração afeta a disponibilidade).\n\nResponda com o nome do serviço ou veja o catálogo:\nhttps://navoproject.vercel.app/?catalog=1');
    }

    const totalDuration = matchedServices.reduce((sum: number, s: any) => sum + Number(s.durationMinutes || 30), 0);
    const serviceTitles = matchedServices.map((s: any) => s.title).join(' e ');
    const serviceIds = matchedServices.map((s: any) => s.id);
    const date = parseDateFromText(text) || context.availabilityDate || getTodayStringBRT();
    const slots = await suggestSlots(date, totalDuration, context.professionalId || '');
    const nextContext = contextForNewIntent(context, { availabilityDate: date, availabilityOptions: [], serviceIds, serviceId: serviceIds[0] });
    await updateConversation(conversation, 'idle', nextContext);
    
    if (!slots.length) {
      return reply(conversation, `❌ Sem horários livres em *${dateLabel(date)}* para *${serviceTitles}*.\n\nInforme outra data para consultar novamente.`);
    }
    return reply(conversation, `✅ *Horários livres* em *${dateLabel(date)}*\nPara: ${serviceTitles}\n\n${slots.map((slot) => `▪️ *${slot}*`).join('   ')}\n\nPara agendar, responda *AGENDAR ${slots[0]}* (ou o horário que preferir).`);
  }

  const WEEKDAY_NAMES_PT: Record<string, string> = {
    sunday: 'Domingo',
    monday: 'Segunda-feira',
    tuesday: 'Terça-feira',
    wednesday: 'Quarta-feira',
    thursday: 'Quinta-feira',
    friday: 'Sexta-feira',
    saturday: 'Sábado',
  };

  async function getShopAgendaSnapshot(targetDateStr?: string, professionalIdOrName?: string) {
    const db = getDb();
    const today = getTodayStringBRT();
    const current = getCurrentTimeBRT();
    const targetDate = targetDateStr && /^\d{4}-\d{2}-\d{2}$/.test(targetDateStr) ? targetDateStr : today;

    const dayContext = await fetchDaySlotContext(targetDate);
    const shop = dayContext.shopProf || {};
    const operatingSchedule = shop.operatingSchedule || {};

    const todayKey = getDayOfWeekKey(today);
    const targetKey = getDayOfWeekKey(targetDate);

    const todaySchedule = operatingSchedule[todayKey] || { open: shop.openTime || '09:00', close: shop.closeTime || '20:00', closed: false };
    const targetSchedule = operatingSchedule[targetKey] || { open: shop.openTime || '09:00', close: shop.closeTime || '20:00', closed: false };

    const todayOpenMins = timeToMinutes(todaySchedule.open || '09:00');
    const todayCloseMins = timeToMinutes(todaySchedule.close || '20:00');
    const isClosedToday = Boolean(todaySchedule.closed);
    const isOpenNow = !isClosedToday && current.totalMinutes >= todayOpenMins && current.totalMinutes < todayCloseMins;

    const targetOpenMins = timeToMinutes(targetSchedule.open || '09:00');
    const targetCloseMins = timeToMinutes(targetSchedule.close || '20:00');
    const isClosedTargetDate = Boolean(targetSchedule.closed);

    const interval = dayContext.operationSettings?.slotIntervalMinutes || 30;
    const standardDuration = 30;

    // Professionals
    const activeProfs = (dayContext.allProfessionals || []).filter((p: any) => p.isActive !== false);
    const profWorkingStatus = activeProfs.map((p: any) => {
      const pSchedule = p.workingHours?.[targetKey];
      const isWorking = !pSchedule?.closed && (pSchedule?.start || targetSchedule.open);
      return {
        id: p.id,
        name: p.name,
        nickname: p.nickname || null,
        roleTitle: p.roleTitle || 'Barbeiro',
        isWorking: Boolean(isWorking),
      };
    });

    // Calculate free slots for targetDate
    const targetProfId = professionalIdOrName && professionalIdOrName !== 'prof_any' ? professionalIdOrName : '';
    const availableSlots: string[] = [];
    const slotsByBarber: Record<string, string[]> = {};

    for (const prof of activeProfs) {
      if (targetProfId && prof.id !== targetProfId) continue;
      slotsByBarber[prof.name] = [];
    }

    if (!isClosedTargetDate) {
      for (let minute = targetOpenMins; minute < targetCloseMins; minute += interval) {
        if (targetDate === today && minute <= current.totalMinutes) continue;
        const timeStr = minutesToTime(minute);

        const check = await checkSlotAvailability({
          dateStr: targetDate,
          startMins: minute,
          reqDuration: standardDuration,
          profId: targetProfId,
          todayBRT: today,
          currTimeBRT: current,
          preloaded: dayContext,
        });

        if (check.available && !check.requiresApproval) {
          availableSlots.push(timeStr);
          if (check.chosenProf?.name) {
            if (!slotsByBarber[check.chosenProf.name]) slotsByBarber[check.chosenProf.name] = [];
            if (!slotsByBarber[check.chosenProf.name].includes(timeStr)) {
              slotsByBarber[check.chosenProf.name].push(timeStr);
            }
          }
        }
      }
    }

    // Services
    const services = (await db.query.services.findMany()).filter((s: any) => s.title && Number(s.durationMinutes) > 0);

    return {
      shopName: shop.name || 'Navo Barber & Club',
      unitName: shop.unitName || 'Unidade Principal',
      address: shop.address || 'Rua Fortaleza, 1420 - Expectativa, Sobral - CE',
      phone: shop.phone || '(88) 99999-9999',
      todayDate: today,
      targetDate,
      todayDayName: WEEKDAY_NAMES_PT[todayKey] || 'Segunda-feira',
      targetDayName: WEEKDAY_NAMES_PT[targetKey] || 'Segunda-feira',
      currentTimeStr: current.timeStr,
      isOpenNow,
      isClosedToday,
      todayOpenTime: todaySchedule.open || '09:00',
      todayCloseTime: todaySchedule.close || '20:00',
      isClosedTargetDate,
      targetOpenTime: targetSchedule.open || '09:00',
      targetCloseTime: targetSchedule.close || '20:00',
      activeProfessionals: profWorkingStatus,
      services: services.map((s: any) => ({
        id: s.id,
        title: s.title,
        price: money(s.price),
        durationMinutes: Number(s.durationMinutes || 30),
        categorySlug: s.categorySlug || 'cabelo',
      })),
      earliestAvailableSlot: availableSlots[0] || null,
      latestAvailableSlot: availableSlots.length ? availableSlots[availableSlots.length - 1] : null,
      availableSlotsTargetDate: availableSlots.slice(0, 10),
      totalFreeSlotsCount: availableSlots.length,
      slotsByBarber,
    };
  }

  async function answerContextualQueryWithAi({
    text,
    intent,
    snapshot,
    sourceState,
    context,
  }: {
    text: string;
    intent: string;
    snapshot: any;
    sourceState: string;
    context: BotContext;
  }): Promise<string | null> {
    const ai = getAiClient();
    if (!ai) return null;
    try {
      const promptInput = `
DADOS REAIS DA BARBEARIA (FONTE DA VERDADE):
${JSON.stringify(snapshot, null, 2)}

ESTADO ATUAL DA CONVERSA: ${sourceState}
INTENÇÃO IDENTIFICADA: ${intent}
CONTEXTO DA SESSÃO: ${JSON.stringify({
        clientName: context.clientName,
        selectedServiceIds: context.serviceIds,
        selectedDate: context.date,
        selectedTime: context.timeSlot,
        selectedProfessionalId: context.professionalId,
        pendingAction: context.pendingAction,
      })}

MENSAGEM DO CLIENTE:
"${text}"
      `.trim();

      const ai = getAiClient();
      if (!ai) return null;

      const response = await ai.models.generateContent({
        model: GEMINI_NAVOBOT_MODEL,
        contents: [{ role: 'user', parts: [{ text: promptInput }] }],
        config: {
          temperature: 0.2,
          maxOutputTokens: 512,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              replyText: { type: 'STRING' },
              actionSuggestion: {
                type: 'STRING',
                enum: ['book', 'availability', 'continue', 'menu', 'none'],
              },
            },
            required: ['replyText'],
          } as any,
          systemInstruction: NAVOBOT_CONVERSATIONAL_PROMPT,
        },
      });

      const responseText = extractGeminiText(response);
      if (!responseText) return null;
      const parsed = JSON.parse(responseText);
      const replyText = String(parsed.replyText || '').trim();
      return replyText || null;
    } catch (error) {
      console.warn('[NavoBot][Gemini] Erro ao gerar resposta contextual inteligente:', error);
      return null;
    }
  }

  function answerContextualQueryDeterministic({
    text,
    intent,
    snapshot,
    context,
  }: {
    text: string;
    intent: string;
    snapshot: any;
    context: BotContext;
  }): string {
    const isToday = snapshot.targetDate === snapshot.todayDate;
    const dateFormatted = dateLabel(snapshot.targetDate);

    if (intent === 'shop_info') {
      let statusText = '';
      if (isToday) {
        if (snapshot.isClosedToday) {
          statusText = '❌ *Hoje a barbearia está fechada.*';
        } else if (snapshot.isOpenNow) {
          statusText = `🟢 *Estamos abertos agora!* Hoje atendemos até às *${snapshot.todayCloseTime}*.`;
        } else {
          statusText = `⏳ *Hoje nosso horário de atendimento é das ${snapshot.todayOpenTime} às ${snapshot.todayCloseTime}.*`;
        }
      } else {
        if (snapshot.isClosedTargetDate) {
          statusText = `❌ Em *${dateFormatted} (${snapshot.targetDayName})* a barbearia estará *fechada*.`;
        } else {
          statusText = `🕒 Em *${dateFormatted} (${snapshot.targetDayName})* atendemos das *${snapshot.targetOpenTime} às ${snapshot.targetCloseTime}*.`;
        }
      }

      return (
        `💈 *${snapshot.shopName}*\n\n` +
        `${statusText}\n\n` +
        `🕒 *Horários de Funcionamento:*\n` +
        `• Seg a Qui: 09:00 às 20:00\n` +
        `• Sexta: 09:00 às 21:00\n` +
        `• Sábado: 09:00 às 20:00\n` +
        `• Domingo: Fechado\n\n` +
        `📍 *Endereço:* ${snapshot.address}\n\n` +
        `💡 Para agendar um horário, envie *1* ou diga qual serviço você prefere!`
      );
    }

    if (intent === 'next_slot') {
      if (snapshot.isClosedTargetDate) {
        return `❌ Em *${dateFormatted}* a barbearia estará fechada.\n\nInforme outra data para consultar os horários livres.`;
      }
      if (!snapshot.earliestAvailableSlot) {
        return `❌ Não encontramos mais horários livres ${isToday ? 'para hoje' : `em ${dateFormatted}`}.\n\nVocê gostaria de consultar para amanhã?`;
      }
      const sampleSlots = snapshot.availableSlotsTargetDate.slice(0, 5).join('   ');
      return (
        `⚡ *Horário mais próximo disponível:*\n\n` +
        `📅 *${isToday ? 'Hoje' : dateFormatted} (${snapshot.targetDayName}):* a partir das *${snapshot.earliestAvailableSlot}*\n` +
        `🕒 Próximas opções livres:\n${sampleSlots}\n\n` +
        `Para reservar, responda *AGENDAR ${snapshot.earliestAvailableSlot}* ou envie *1* para escolher o serviço!`
      );
    }

    if (intent === 'last_slot') {
      if (snapshot.isClosedTargetDate) {
        return `❌ Em *${dateFormatted}* a barbearia estará fechada.`;
      }
      const lastSlot = snapshot.latestAvailableSlot;
      const closeTime = snapshot.targetCloseTime;
      if (!lastSlot) {
        return `🌙 Em *${dateFormatted}* nosso expediente encerra às *${closeTime}*, mas não há mais vagas livres nesta data.`;
      }
      return (
        `🌙 *Último horário de atendimento:*\n\n` +
        `📅 *${dateFormatted} (${snapshot.targetDayName}):* fechamos às *${closeTime}*.\n` +
        `✂️ O último horário livre para agendar é às *${lastSlot}*.\n\n` +
        `Deseja agendar? Responda *AGENDAR ${lastSlot}* ou envie *1* para iniciar.`
      );
    }

    if (intent === 'barbers') {
      const working = snapshot.activeProfessionals.filter((p: any) => p.isWorking);
      const off = snapshot.activeProfessionals.filter((p: any) => !p.isWorking);
      let msg = `✂️ *Equipe de Barbeiros — ${isToday ? 'Hoje' : dateFormatted}*\n\n`;
      if (working.length) {
        msg += `💈 *Em atendimento:* \n` + working.map((p: any) => `• *${p.name}* (${p.roleTitle})`).join('\n');
      } else {
        msg += `Nenhum profissional escalado para esta data.`;
      }
      if (off.length) {
        msg += `\n\n🏖️ *Folga:* ` + off.map((p: any) => p.name).join(', ');
      }
      msg += `\n\n💡 Deseja agendar com algum deles? Responda com o nome do barbeiro ou envie *1* para escolher o serviço!`;
      return msg;
    }

    if (intent === 'service_info') {
      const servicesList = snapshot.services
        .map((s: any, idx: number) => `*${idx + 1}*. ${s.title} — ${s.price} (${s.durationMinutes}min)`)
        .join('\n');
      return (
        `💈 *Tabela de Serviços & Valores:*\n\n` +
        `${servicesList}\n\n` +
        `💡 Para agendar, envie o número do serviço ou responda *1*!`
      );
    }

    return menuText();
  }

  function getResumePromptForState(state: string, context: BotContext): string | null {
    if (state === 'awaiting_availability_service') {
      return 'Qual serviço você deseja usar para consultar os horários? (Envie o número ou nome)';
    }
    if (state === 'awaiting_service') {
      return 'Qual serviço você deseja agendar? (Envie o número ou nome)';
    }
    if (state === 'awaiting_more_services') {
      return 'Deseja incluir mais algum serviço? (Responda SIM ou NÃO)';
    }
    if (state === 'awaiting_professional') {
      return 'Qual barbeiro você prefere? (Envie o número ou nome)';
    }
    if (state === 'awaiting_date') {
      return 'Para qual dia você prefere agendar? (Ex: hoje, amanhã, 25/08)';
    }
    if (state === 'awaiting_time') {
      return `Para *${dateLabel(context.date || getTodayStringBRT())}*, qual horário você prefere?`;
    }
    if (state === 'awaiting_confirmation') {
      return 'Responda *SIM* para confirmar ou *NÃO* para cancelar.';
    }
    return null;
  }

  async function handleAgendaContextualQuery(
    conversation: Conversation,
    context: BotContext,
    text: string,
    intent: NavoBotIntent,
    sourceState: string = 'idle'
  ) {
    const extractedDate = parseDateFromText(text) || context.date || context.availabilityDate || getTodayStringBRT();
    const db = getDb();
    const professionals = (await db.query.professionals.findMany()).filter((p: any) => p.isActive !== false);
    const matchedProfs = findProfessionalMatches(professionals, text);
    const profId = matchedProfs.length === 1 ? matchedProfs[0].id : context.professionalId || '';

    const snapshot = await getShopAgendaSnapshot(extractedDate, profId);

    let answer: string | null = null;
    const ai = getAiClient();
    if (ai) {
      answer = await answerContextualQueryWithAi({
        text,
        intent,
        snapshot,
        sourceState,
        context,
      });
    }

    if (!answer) {
      answer = answerContextualQueryDeterministic({
        text,
        intent,
        snapshot,
        context,
      });
    }

    // Se o usuário estava no meio de uma etapa do agendamento, retoma a pergunta ativa para não travar o fluxo
    if (sourceState !== 'idle' && sourceState !== 'human') {
      const resumePrompt = getResumePromptForState(sourceState, context);
      if (resumePrompt && !answer.includes(resumePrompt)) {
        answer += `\n\n📌 *Continuando seu agendamento:*\n${resumePrompt}`;
      }
    }

    return reply(conversation, answer);
  }

  async function suggestSlots(date: string, duration: number, professionalId = '', excludeAppointmentId = '') {
    const today = getTodayStringBRT();
    const current = getCurrentTimeBRT();
    const dayContext = await fetchDaySlotContext(date, excludeAppointmentId);
    const schedule = dayContext.shopProf.operatingSchedule?.[getDayOfWeekKey(date)] as any;
    const open = timeToMinutes(schedule?.open || dayContext.shopProf.openTime || '09:00');
    const close = timeToMinutes(schedule?.close || dayContext.shopProf.closeTime || '21:00');
    const interval = dayContext.operationSettings?.slotIntervalMinutes || 30;
    const slots: string[] = [];
    for (let minute = open; minute < close && slots.length < 5; minute += interval) {
      const timeSlot = minutesToTime(minute);
      if (date === today && minute <= current.totalMinutes) continue;
      const check = await checkSlotAvailability({
        dateStr: date,
        startMins: minute,
        reqDuration: duration,
        profId: professionalId,
        excludeAptId: excludeAppointmentId,
        todayBRT: today,
        currTimeBRT: current,
        preloaded: dayContext,
      });
      if (check.available && !check.requiresApproval) slots.push(timeSlot);
    }
    return slots;
  }

  async function prepareBookingConfirmation(conversation: Conversation, context: BotContext) {
    const services = await getServices(context);
    const totalDuration = services.reduce((total, service: any) => total + Number(service.durationMinutes || 0), 0);
    if (!services.length || !context.date || !context.timeSlot) return reply(conversation, 'Preciso do serviço, dia e horário para continuar. Responda *AGENDAR* para começar novamente.');
    const check = await checkSlotAvailability({
      dateStr: context.date,
      startMins: timeToMinutes(context.timeSlot),
      reqDuration: totalDuration,
      profId: context.professionalId || '',
      todayBRT: getTodayStringBRT(),
      currTimeBRT: getCurrentTimeBRT(),
    });
    if (!check.available) {
      return reply(conversation, `Esse horário não está disponível para *${dateLabel(context.date)}*. Informe outro horário ou outro dia para eu consultar.`);
    }
    context.professionalId = check.chosenProf?.id || context.professionalId || 'prof_any';
    await updateConversation(conversation, 'awaiting_confirmation', context);
    return replyConfirmation(conversation, 'book', { professionalName: check.chosenProf?.name }, context, services);
  }

  async function executeBooking(conversation: Conversation, context: BotContext) {
    const db = getDb();
    const services = await getServices(context);
    const totalDuration = services.reduce((total, service: any) => total + Number(service.durationMinutes || 0), 0);
    if (!services.length || !context.date || !context.timeSlot) return reply(conversation, 'A sessão expirou. Responda *AGENDAR* para iniciar novamente.');
    const check = await checkSlotAvailability({
      dateStr: context.date,
      startMins: timeToMinutes(context.timeSlot),
      reqDuration: totalDuration,
      profId: context.professionalId || '',
      todayBRT: getTodayStringBRT(),
      currTimeBRT: getCurrentTimeBRT(),
    });
    if (!check.available || !check.chosenProf) return reply(conversation, 'Esse horário acabou de ser ocupado. Responda com outro horário para consultar novamente.');

    const profiles = await db.query.profiles.findMany();
    const existingProfile = profiles.find((profile: any) => profile.phone && matchPhoneNumbers(profile.phone, conversation.phone));
    const clientId = existingProfile?.id || `wa_${conversation.phone}`;
    const recognizedName = String(context.clientName || '').trim();
    const clientName = recognizedName || existingProfile?.name || 'Cliente WhatsApp';
    const internalContact = `wa_${sanitizePhone(conversation.phone)}`;
    const clientEmail = existingProfile?.email && !String(existingProfile.email).endsWith('@whatsapp.navo.local')
      ? existingProfile.email
      : null;
    const appointmentId = `apt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const isPendingApproval = !!check.requiresApproval;
    const originalAmount = services.reduce((total, service: any) => total + Number(service.price || 0), 0);
    const appointment = {
      id: appointmentId,
      clientId,
      clientName,
      clientPhone: sanitizePhone(conversation.phone),
      clientEmail,
      professionalId: check.chosenProf.id,
      professionalName: check.chosenProf.name,
      date: context.date,
      timeSlot: context.timeSlot,
      status: isPendingApproval ? 'pending_approval' : 'confirmed',
      totalDurationMinutes: totalDuration,
      originalAmount: originalAmount.toFixed(2),
      discountAmount: '0.00',
      finalAmount: originalAmount.toFixed(2),
      paymentMethod: 'pay_at_venue',
      bookingCode: generateBookingCode(),
      services: services.map((service: any) => ({ id: service.id, title: service.title, price: service.price, durationMinutes: service.durationMinutes })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await db.transaction(async (tx: any) => {
        if (!existingProfile) {
          await tx.insert(schema.profiles).values({
            id: clientId,
            name: clientName,
            email: internalContact,
            phone: sanitizePhone(conversation.phone),
            role: 'client',
            loyaltyPoints: 0,
            loyaltyTier: 'Bronze',
          }).onConflictDoNothing();
        } else {
          const profileUpdates: Record<string, unknown> = { updatedAt: new Date() };
          const hasGenericName = !existingProfile.name || /^cliente whatsapp$/i.test(String(existingProfile.name).trim());
          if (recognizedName && hasGenericName) profileUpdates.name = recognizedName;
          if (String(existingProfile.email || '').endsWith('@whatsapp.navo.local')) profileUpdates.email = internalContact;
          if (Object.keys(profileUpdates).length > 1) {
            await tx.update(schema.profiles).set(profileUpdates).where(eq(schema.profiles.id, existingProfile.id));
          }
        }
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${appointment.professionalId}:${appointment.date}`}, 0))`);
        const locked = await checkSlotAvailability({
          dateStr: appointment.date,
          startMins: timeToMinutes(appointment.timeSlot),
          reqDuration: appointment.totalDurationMinutes,
          profId: appointment.professionalId,
          todayBRT: getTodayStringBRT(),
          currTimeBRT: getCurrentTimeBRT(),
        });
        if (!locked.available) throw new Error('BOOKING_CONFLICT');
        await tx.insert(schema.appointments).values(appointment);
      });
    } catch (error: any) {
      if (String(error?.message || '').includes('BOOKING_CONFLICT') || error?.code === '23505') {
        return reply(conversation, 'Esse horário acabou de ser reservado. Responda com outro horário para eu consultar novamente.');
      }
      console.error('[NavoBot] Falha ao criar agendamento:', error);
      return reply(conversation, 'Não consegui concluir o agendamento agora. A equipe pode ajudar por aqui; responda *ATENDENTE*.');
    }

    invalidateAvailabilityCache();
    await updateConversation(conversation, 'idle', {});
    return reply(conversation, `Agendamento ${isPendingApproval ? 'enviado para aprovação' : 'confirmado'} com sucesso.\n\n🔑 Código: *${appointment.bookingCode}*\n📅 ${dateLabel(appointment.date)} às ${appointment.timeSlot}\n✂️ ${appointment.professionalName}\n💈 ${services.map((service: any) => service.title).join(', ')}\n\nGuarde esse código para consultar, reagendar ou cancelar.`);
  }

  async function executeCancellation(conversation: Conversation, appointment: any) {
    const db = getDb();
    await db.transaction(async (tx: any) => {
      await tx.update(schema.appointments).set({ status: 'cancelled', cancellationReason: 'Cancelado pelo cliente via WhatsApp', updatedAt: new Date() }).where(eq(schema.appointments.id, appointment.id));
      await tx.update(schema.waitingQueue).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(schema.waitingQueue.appointmentId, appointment.id));
    });
    invalidateAvailabilityCache();
    await updateConversation(conversation, 'idle', {});
    return reply(conversation, `Agendamento cancelado com sucesso.\n\n${appointmentLabel(appointment)}\n\nQuando quiser, responda *AGENDAR* para marcar outro horário.`);
  }

  async function beginBulkCancellation(conversation: Conversation, context: BotContext) {
    const appointments = await findAppointments(conversation.phone);
    if (!appointments.length) {
      await updateConversation(conversation, 'idle', context.clientName ? { clientName: context.clientName } : {});
      return reply(conversation, 'Não encontrei agendamentos ativos para cancelar.');
    }
    const nextContext = contextForNewIntent(context, {
      pendingAction: 'cancel_all',
      bulkAppointmentIds: appointments.map((appointment: any) => appointment.id),
      appointmentId: undefined,
      candidateAppointmentIds: undefined,
    });
    await updateConversation(conversation, 'awaiting_confirmation', nextContext);
    const list = appointments.map((appointment: any) => `• ${appointmentLabel(appointment)}`).join('\n');
    const fallback = `Encontrei ${appointments.length} agendamento${appointments.length === 1 ? '' : 's'} ativo${appointments.length === 1 ? '' : 's'} para este número:\n\n${list}\n\nConfirma o cancelamento de TODOS eles? Responda *SIM* para confirmar ou *NÃO* para manter os agendamentos.`;
    return replyButtons(conversation, fallback, {
      title: 'Cancelar todos os agendamentos',
      description: `Serão cancelados ${appointments.length} agendamento${appointments.length === 1 ? '' : 's'}.`,
      footerText: 'NavoBot',
      buttons: [
        { type: 'reply', id: 'confirm:yes', displayText: 'Sim, cancelar todos' },
        { type: 'reply', id: 'confirm:no', displayText: 'Não, manter' },
      ],
    });
  }

  async function executeBulkCancellation(conversation: Conversation, context: BotContext) {
    const targetIds = [...new Set(context.bulkAppointmentIds || [])];
    if (!targetIds.length) {
      await updateConversation(conversation, 'idle', {});
      return reply(conversation, 'Não consegui identificar os agendamentos para cancelar. Nenhuma alteração foi feita.');
    }
    const appointments = (await findAppointments(conversation.phone)).filter((appointment: any) => targetIds.includes(appointment.id));
    if (!appointments.length) {
      await updateConversation(conversation, 'idle', {});
      return reply(conversation, 'Os agendamentos já não estão ativos. Nenhuma alteração foi feita.');
    }
    const db = getDb();
    await db.transaction(async (tx: any) => {
      await tx.update(schema.appointments).set({ status: 'cancelled', cancellationReason: 'Cancelado pelo cliente via WhatsApp', updatedAt: new Date() }).where(inArray(schema.appointments.id, appointments.map((appointment: any) => appointment.id)));
      await tx.update(schema.waitingQueue).set({ status: 'cancelled', updatedAt: new Date() }).where(inArray(schema.waitingQueue.appointmentId, appointments.map((appointment: any) => appointment.id)));
    });
    invalidateAvailabilityCache();
    await updateConversation(conversation, 'idle', {});
    return reply(conversation, `Todos os ${appointments.length} agendamentos foram cancelados com sucesso.\n\n${appointments.map((appointment: any) => `• ${appointmentLabel(appointment)}`).join('\n')}\n\nQuando quiser, responda *AGENDAR* para marcar outro horário.`);
  }

  async function executeReschedule(conversation: Conversation, appointment: any, context: BotContext) {
    const db = getDb();
    if (!context.date || !context.timeSlot) return reply(conversation, 'Informe o novo dia e horário para continuar.');
    const check = await checkSlotAvailability({
      dateStr: context.date,
      startMins: timeToMinutes(context.timeSlot),
      reqDuration: Number(appointment.totalDurationMinutes || 30),
      profId: context.professionalId || appointment.professionalId,
      excludeAptId: appointment.id,
      todayBRT: getTodayStringBRT(),
      currTimeBRT: getCurrentTimeBRT(),
    });
    if (!check.available || !check.chosenProf) return reply(conversation, 'Esse horário não está mais disponível. Responda com outro horário para consultar novamente.');

    const [updated] = await db.update(schema.appointments).set({
      date: context.date,
      timeSlot: context.timeSlot,
      professionalId: check.chosenProf.id,
      professionalName: check.chosenProf.name,
      updatedAt: new Date(),
    }).where(eq(schema.appointments.id, appointment.id)).returning();
    if (!updated) return reply(conversation, 'Não consegui atualizar o agendamento. Responda *ATENDENTE* para falar com a equipe.');
    invalidateAvailabilityCache();
    await updateConversation(conversation, 'idle', {});
    return reply(conversation, `Reagendamento concluído com sucesso.\n\n🔑 Código: *${updated.bookingCode || appointment.bookingCode}*\n📅 ${dateLabel(updated.date)} às ${updated.timeSlot}\n✂️ ${updated.professionalName}`);
  }

  async function beginAppointmentAction(conversation: Conversation, context: BotContext, action: 'reschedule' | 'cancel') {
    context.pendingAction = action;
    const appointment = await findAppointment(conversation, context);
    if (!appointment) {
      if (context.candidateAppointmentIds?.length) return true;
      return reply(conversation, 'Não encontrei um agendamento ativo para este número. Responda *AGENDAR* para criar um novo.');
    }
    context.appointmentId = appointment.id;
    if (action === 'cancel') {
      await updateConversation(conversation, 'awaiting_confirmation', context);
      return replyConfirmation(conversation, 'cancel', appointment, context);
    }
    await updateConversation(conversation, 'awaiting_date', context);
    return reply(conversation, `Certo. Vamos reagendar ${appointmentLabel(appointment)}. Qual novo dia você prefere?`);
  }

  async function handleAwaitingAppointment(conversation: Conversation, context: BotContext, text: string) {
    const appointment = await findAppointment(conversation, context, text);
    if (!appointment) return reply(conversation, 'Não localizei esse código. Responda exatamente com o voucher exibido ou *MENU* para voltar.');
    context.appointmentId = appointment.id;
    if (context.pendingAction === 'cancel') {
      await updateConversation(conversation, 'awaiting_confirmation', context);
      return replyConfirmation(conversation, 'cancel', appointment, context);
    }
    await updateConversation(conversation, 'awaiting_date', context);
    return reply(conversation, `Certo. Vamos reagendar ${appointmentLabel(appointment)}. Qual novo dia você prefere?`);
  }

  async function handleState(conversation: Conversation, context: BotContext, text: string, contextualIntent: NavoBotIntent | null = null) {
    if (conversation.state === 'human') {
      return handleHumanState(conversation, context, text, contextualIntent);
    }
    const stateIntent = contextualIntent || classifyDeterministicIntent(text);
    if (stateIntent === 'menu') {
      const preservedContext = context.clientName ? { clientName: context.clientName } : {};
      await updateConversation(conversation, 'idle', preservedContext);
      return reply(conversation, menuText());
    }
    if (stateIntent === 'gratitude') {
      const preservedContext = context.clientName ? { clientName: context.clientName } : {};
      await updateConversation(conversation, 'idle', preservedContext);
      return reply(conversation, 'De nada! Estou à disposição. Se precisar de algo, é só chamar! 👋');
    }
    if (stateIntent === 'availability') {
      const nextContext = contextForNewIntent(context, {
        pendingAction: undefined,
        appointmentId: undefined,
        candidateAppointmentIds: undefined,
        bulkAppointmentIds: undefined,
        serviceId: undefined,
        serviceIds: undefined,
        serviceOptions: undefined,
        servicePage: undefined,
        professionalOptions: undefined,
        date: undefined,
        timeSlot: undefined,
        professionalId: undefined,
        availabilityDate: undefined,
        availabilityOptions: undefined,
      });
      await updateConversation(conversation, 'idle', nextContext);
      return handleAvailabilityRequest(conversation, nextContext, text);
    }
    const isBareNumber = /^\s*\d+\s*$/.test(text);
    const canInterruptFlow = !isBareNumber && conversation.state !== 'idle' && conversation.state !== 'human' && stateIntent !== 'confirm';
    if (canInterruptFlow && ['shop_info', 'next_slot', 'last_slot', 'barbers', 'service_info'].includes(stateIntent as string)) {
      return handleAgendaContextualQuery(conversation, context, text, stateIntent as NavoBotIntent, conversation.state);
    }
    if (canInterruptFlow && stateIntent === 'appointments') {
      const nextContext = contextForNewIntent(context);
      await updateConversation(conversation, 'idle', nextContext);
      return listAppointments(conversation);
    }
    if (canInterruptFlow && stateIntent === 'book') {
      const nextContext = contextForNewIntent(context, { pendingAction: 'book' });
      await updateConversation(conversation, 'idle', nextContext);
      return startBooking(conversation, nextContext, text);
    }
    if (canInterruptFlow && stateIntent === 'cancel') {
      const nextContext = contextForNewIntent(context, { pendingAction: 'cancel' });
      await updateConversation(conversation, 'idle', nextContext);
      return beginAppointmentAction(conversation, nextContext, 'cancel');
    }
    if (canInterruptFlow && stateIntent === 'cancel_all') {
      const nextContext = contextForNewIntent(context, { pendingAction: 'cancel_all' });
      await updateConversation(conversation, 'idle', nextContext);
      return beginBulkCancellation(conversation, nextContext);
    }
    if (canInterruptFlow && stateIntent === 'reschedule') {
      const nextContext = contextForNewIntent(context, { pendingAction: 'reschedule' });
      await updateConversation(conversation, 'idle', nextContext);
      return beginAppointmentAction(conversation, nextContext, 'reschedule');
    }
    if (canInterruptFlow && stateIntent === 'complaint') {
      const nextContext = contextForNewIntent(context, { humanFollowUpCount: 0 });
      await updateConversation(conversation, 'human', nextContext, true);
      await notifyStaffViaWhatsApp({ conversation, context: nextContext, clientMessage: text, reason: 'complaint' });
      return reply(conversation, 'Sinto muito pela experiência. Sua mensagem foi encaminhada para a equipe responsável. Se desejar, descreva o que aconteceu para facilitar a análise. Não é necessário repetir seus dados pessoais.');
    }
    if (canInterruptFlow && stateIntent === 'human') {
      const nextContext = contextForNewIntent(context);
      await updateConversation(conversation, 'human', nextContext, true);
      await notifyStaffViaWhatsApp({ conversation, context: nextContext, clientMessage: text, reason: 'human_request' });
      return reply(conversation, 'Vou encaminhar sua conversa para a equipe. Em breve alguém continuará o atendimento por aqui.');
    }
    if (conversation.state === 'awaiting_availability_service') {
      const db = getDb();
      const services = (await db.query.services.findMany()).filter((service: any) => service.title && Number(service.durationMinutes) > 0);
      const rawText = text.trim().toLowerCase();
      const index = numericSelection(text);
      const rawSelection = rawText.startsWith('service:') ? rawText.slice(8) : '';
      const selectedId = rawSelection || (index !== null && context.availabilityOptions?.[index] ? context.availabilityOptions[index] : '');
      const matches = selectedId
        ? services.filter((service: any) => service.id === selectedId)
        : findServiceMatches(services, text);
      if (!matches.length) return reply(conversation, 'Não identifiquei esse serviço. Responda com o nome ou número do serviço para consultar os horários.');
      context.serviceIds = matches.map((m: any) => m.id);
      context.serviceId = matches[0].id;
      return handleAvailabilityRequest(conversation, context, text);
    }
    if (conversation.state === 'awaiting_appointment') return handleAwaitingAppointment(conversation, context, text);
    if (conversation.state === 'awaiting_service') {
      const db = getDb();
      const services = await db.query.services.findMany();
      const rawText = text.trim().toLowerCase();
      if (rawText === 'mais' || rawText === 'service:more') {
        context.servicePage = Number(context.servicePage || 0) + 1;
        return listServices(conversation, context);
      }
      const rawSelection = rawText.startsWith('service:') ? rawText.slice(8) : '';
      if (rawSelection.startsWith('page:')) {
        context.servicePage = Number(rawSelection.slice(5)) || 0;
        return listServices(conversation, context);
      }
      const index = numericSelection(text);
      const selectedId = rawSelection || (index !== null && context.serviceOptions?.[index] ? context.serviceOptions[index] : '');
      const matchedServices = selectedId
        ? services.filter((service: any) => service.id === selectedId)
        : findServiceMatches(services, text);
      if (!matchedServices.length) return reply(conversation, 'Não identifiquei esse serviço. Escolha uma opção da lista ou responda com o número correspondente.');
      if (!selectedId && matchedServices.length > 1) {
        context.serviceOptions = matchedServices.map((service: any) => service.id);
        await updateConversation(conversation, 'awaiting_service', context);
        return reply(conversation, 'Encontrei mais de uma opção. Qual delas você deseja?\n\n' + matchedServices.map((service: any, optionIndex: number) => `${optionIndex + 1}. *${service.title}* · ${money(service.price)}`).join('\n'));
      }
      context.serviceIds = context.serviceIds || [];
      context.servicePage = 0;
      for (const selected of matchedServices) {
        if (!context.serviceIds.includes(selected.id)) context.serviceIds.push(selected.id);
      }
      context.serviceId = context.serviceIds[0];
      captureInlineDateTime(context, text);
      return askMoreServices(conversation, context);
    }
    if (conversation.state === 'awaiting_more_services') {
      const normalized = text.trim().toLowerCase();
      captureInlineDateTime(context, text);
      const wantsAdd = normalized === 'service:add' || normalized.includes('adicionar') || isPositiveConfirmation(text);
      const wantsContinue = normalized === 'service:done' || normalized.includes('continuar') || normalized.includes('pronto') || isNegativeConfirmation(text);
      if (wantsAdd && !wantsContinue) return listServices(conversation, context);
      if (wantsContinue) return askProfessional(conversation, context);
      return reply(conversation, 'Deseja adicionar outro serviço? Responda *SIM* ou *NÃO*.');
    }
    if (conversation.state === 'awaiting_professional') {
      const db = getDb();
      const professionals = (await db.query.professionals.findMany()).filter((professional: any) => professional.isActive !== false);
      const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const rawSelection = normalized.startsWith('professional:') ? text.trim().slice(13) : '';
      const index = numericSelection(text);
      const wantsAny = /\b(qualquer|tanto faz|nao importa|sem preferencia)\b/.test(normalized);
      const selectedId = rawSelection || (wantsAny || text.trim() === '0' ? 'prof_any' : index !== null && context.professionalOptions?.[index + 1] ? context.professionalOptions[index + 1] : '');
      const selected = selectedId === 'prof_any'
        ? null
        : selectedId ? professionals.find((professional: any) => professional.id === selectedId) : professionals.find((professional: any) => text.toLowerCase().includes(String(professional.name).toLowerCase()));
      if (!selectedId && !selected) return reply(conversation, 'Escolha um profissional da lista, “Qualquer profissional” ou responda com o número correspondente.');
      context.professionalId = selectedId || selected?.id || 'prof_any';
      captureInlineDateTime(context, text);
      return continueAfterProfessional(conversation, context);
    }
    if (conversation.state === 'awaiting_date') {
      const date = parseDateFromText(text);
      if (!date) return reply(conversation, 'Não consegui identificar o dia. Responda, por exemplo, *amanhã*, *sábado* ou *25/08*.');
      context.date = date;
      const inlineTime = parseTimeFromText(text, true);
      if (inlineTime) {
        context.timeSlot = inlineTime;
        await updateConversation(conversation, 'awaiting_time', context);
        return handleState(conversation, context, text);
      }
      await updateConversation(conversation, 'awaiting_time', context);
      return reply(conversation, `Ótimo. Para *${dateLabel(date)}*, qual horário você prefere?`);
    }
    if (conversation.state === 'awaiting_time') {
      const inlineDate = parseDateFromText(text);
      if (inlineDate) context.date = inlineDate;
      const time = parseTimeFromText(text, true);
      if (!time) return reply(conversation, 'Não consegui identificar o horário. Responda, por exemplo, *15h* ou *15:30*.');
      context.timeSlot = time;
      if (context.pendingAction === 'book') return prepareBookingConfirmation(conversation, context);
      const appointment = await findAppointment(conversation, context);
      if (!appointment) return reply(conversation, 'Não encontrei o agendamento para reagendar. Responda *MENU* para voltar.');
      const check = await checkSlotAvailability({
        dateStr: context.date!,
        startMins: timeToMinutes(time),
        reqDuration: Number(appointment.totalDurationMinutes || 30),
        profId: appointment.professionalId,
        excludeAptId: appointment.id,
        todayBRT: getTodayStringBRT(),
        currTimeBRT: getCurrentTimeBRT(),
      });
      if (!check.available) return reply(conversation, 'Esse horário está ocupado. Responda com outro horário para eu consultar novamente.');
      await updateConversation(conversation, 'awaiting_confirmation', context);
      return replyConfirmation(conversation, 'reschedule', appointment, context);
    }
    if (conversation.state === 'awaiting_confirmation') {
      const appointment = context.appointmentId ? await findAppointment(conversation, context) : null;
      if (isNegativeConfirmation(text)) {
        await updateConversation(conversation, 'idle', {});
        return reply(conversation, 'Tudo bem, não alterei nada.\n\n' + menuText());
      }
      if (!isPositiveConfirmation(text)) return reply(conversation, 'Responda *SIM* para confirmar ou *NÃO* para voltar.');
      if (context.pendingAction === 'cancel' && appointment) return executeCancellation(conversation, appointment);
      if (context.pendingAction === 'cancel_all') return executeBulkCancellation(conversation, context);
      if (context.pendingAction === 'reschedule' && appointment) return executeReschedule(conversation, appointment, context);
      if (context.pendingAction === 'book') return executeBooking(conversation, context);
    }
    return null;
  }

  async function handleMessage(message: ExtractedEvolutionMessage) {
    const conversation = await getConversation(message.phone, message.instanceName);
    const deterministic = classifyDeterministicIntent(message.text);
    if (!(await recordInbound(conversation, message, deterministic))) return { ignored: true, reason: 'duplicate' };
    const context = normalizeContext(conversation.context);
    delete context.inactivityReminderSentAt;
    const pushName = String(message.pushName || '').trim();
    if (pushName && !/^cliente whatsapp$/i.test(pushName)) {
      context.clientName = pushName;
      await syncClientIdentity(message.phone, pushName);
    }
    const aiIntent = !deterministic && conversation.state !== 'idle'
      ? await classifyWithAi(message.text, conversation.state, context)
      : null;
    const interruptIntents = new Set<NavoBotIntent>([
      'menu',
      'appointments',
      'availability',
      'book',
      'cancel',
      'cancel_all',
      'complaint',
      'reschedule',
      'human',
      'shop_info',
      'next_slot',
      'last_slot',
      'barbers',
      'service_info',
      'gratitude'
    ]);
    const contextualIntent = deterministic || (aiIntent && interruptIntents.has(aiIntent) ? aiIntent : null);
    const stateReply = await handleState(conversation, context, message.text, contextualIntent);
    if (stateReply !== null) return { handled: true, intent: contextualIntent || aiIntent || 'state' };

    const intent = contextualIntent || aiIntent || await classifyWithAi(message.text, conversation.state, context);
    if (['shop_info', 'next_slot', 'last_slot', 'barbers', 'service_info'].includes(intent)) {
      await handleAgendaContextualQuery(conversation, context, message.text, intent, 'idle');
      return { handled: true, intent };
    }
    if (intent === 'menu' || intent === 'unknown') {
      await updateConversation(conversation, 'idle', context);
      await reply(conversation, menuText(message.pushName));
      return { handled: true, intent };
    }
    if (intent === 'complaint') {
      const nextContext = contextForNewIntent(context);
      await updateConversation(conversation, 'human', nextContext, true);
      await notifyStaffViaWhatsApp({ conversation, context: nextContext, clientMessage: message.text, reason: 'complaint' });
      await reply(conversation, 'Sinto muito pela experiência. Sua mensagem foi encaminhada para a equipe responsável. Se desejar, descreva o que aconteceu para facilitar a análise. Não é necessário repetir seus dados pessoais.');
      return { handled: true, intent };
    }
    if (intent === 'human') {
      const nextContext = { ...context, humanFollowUpCount: 0 };
      await updateConversation(conversation, 'human', nextContext, true);
      await notifyStaffViaWhatsApp({ conversation, context: nextContext, clientMessage: message.text, reason: 'human_request' });
      await reply(conversation, 'Sua solicitação foi encaminhada para a equipe responsável. O atendimento automático permanece pausado para evitar respostas desencontradas. Aguarde a análise da equipe.');
      return { handled: true, intent };
    }
    if (intent === 'appointments') {
      await updateConversation(conversation, 'idle', {});
      await listAppointments(conversation);
      return { handled: true, intent };
    }
    if (intent === 'availability') {
      await handleAvailabilityRequest(conversation, context, message.text);
      return { handled: true, intent };
    }
    if (intent === 'book') {
      await startBooking(conversation, context, message.text);
      return { handled: true, intent };
    }
    if (intent === 'cancel') {
      await beginAppointmentAction(conversation, context, 'cancel');
      return { handled: true, intent };
    }
    if (intent === 'cancel_all') {
      await beginBulkCancellation(conversation, context);
      return { handled: true, intent };
    }
    if (intent === 'reschedule') {
      await beginAppointmentAction(conversation, context, 'reschedule');
      return { handled: true, intent };
    }
    if (intent === 'confirm') {
      if (conversation.state === 'awaiting_confirmation') {
        await handleState(conversation, context, message.text);
      } else {
        await reply(conversation, 'Para confirmar, preciso saber qual agendamento você deseja confirmar. Responda *MEU AGENDAMENTO* ou *MENU*.');
      }
      return { handled: true, intent };
    }
    await reply(conversation, menuText(message.pushName));
    return { handled: true, intent: 'menu' };
  }

  async function testAiConnection() {
    const ai = getAiClient();
    if (!ai) {
      return { ok: false, configured: false, usedGemini: false, model: GEMINI_NAVOBOT_MODEL, latencyMs: 0, message: 'GEMINI_API_KEY não está configurada no ambiente.' };
    }
    const startedAt = Date.now();
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_NAVOBOT_MODEL,
        contents: [{ role: 'user', parts: [{ text: 'Responda somente com a palavra OK.' }] }],
        config: { temperature: 0, maxOutputTokens: 32, thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } },
      });
      const responseText = extractGeminiText(response);
      const diagnostics = geminiResponseDiagnostics(response);
      return {
        ok: !!responseText,
        configured: true,
        usedGemini: true,
        model: GEMINI_NAVOBOT_MODEL,
        latencyMs: Date.now() - startedAt,
        response: responseText.slice(0, 40),
        message: responseText ? 'Gemini respondeu com sucesso.' : `Gemini foi chamado, mas não retornou texto${diagnostics ? ` (${diagnostics})` : ''}.`,
      };
    } catch (error: any) {
      return {
        ok: false,
        configured: true,
        usedGemini: false,
        model: GEMINI_NAVOBOT_MODEL,
        latencyMs: Date.now() - startedAt,
        message: `Falha ao chamar o Gemini: ${String(error?.message || 'erro desconhecido').slice(0, 240)}`,
      };
    }
  }

  async function handleWebhook(payload: any) {
    const message = extractEvolutionMessage(payload);
    if (!message) return { ignored: true, reason: 'not_an_inbound_message' };

    // Se a mensagem for de áudio (ou não tiver texto e tiver áudio), transcreve com Gemini
    if (message.audio && (!message.text || !message.text.trim())) {
      console.info(`[NavoBot] Mensagem de voz recebida de ${message.phone} (msgId: ${message.messageId}). Iniciando reconhecimento de voz...`);
      const transcribedText = await transcribeAudioWithGemini(message.audio, message.messageId, fetchMediaBase64);
      if (transcribedText) {
        message.text = transcribedText;
        console.info(`[NavoBot] Áudio de ${message.phone} transcrito para: "${transcribedText}"`);
      } else {
        console.warn(`[NavoBot] Não foi possível transcrever áudio de ${message.phone}. Enviando aviso amigável ao cliente.`);
        await sendText(
          message.phone,
          '🎤 Recebi seu áudio, mas não consegui ouvir com clareza. Você poderia, por favor, digitar sua mensagem ou enviar um novo áudio?'
        );
        return { ignored: false, processed: true, audioTranscriptionFailed: true };
      }
    }

    if (!message.text || !message.text.trim()) {
      return { ignored: true, reason: 'empty_message_after_audio_processing' };
    }

    return handleMessage(message);
  }

  function inactivityMessage(state: string, clientName?: string): string {
    const greeting = clientName ? ` ${clientName}` : '';
    if (state === 'awaiting_service') return `Ainda está comigo${greeting}? Posso continuar escolhendo o serviço. Responda com o número ou escreva o nome do serviço.`;
    if (state === 'awaiting_availability_service') return `Ainda está comigo${greeting}? Qual serviço você deseja usar para consultar os horários?`;
    if (state === 'awaiting_more_services') return `Ainda está comigo${greeting}? Deseja adicionar outro serviço? Responda *SIM* ou *NÃO*.`;
    if (state === 'awaiting_professional') return `Ainda está comigo${greeting}? Falta escolher o profissional. Responda com o número ou *QUALQUER PROFISSIONAL*.`;
    if (state === 'awaiting_date') return `Ainda está comigo${greeting}? Qual dia você prefere para o atendimento?`;
    if (state === 'awaiting_time') return `Ainda está comigo${greeting}? Informe o horário desejado para continuar.`;
    if (state === 'awaiting_appointment') return `Ainda está comigo${greeting}? Envie o voucher do agendamento para continuar.`;
    if (state === 'awaiting_confirmation') return `Ainda está comigo${greeting}? Responda *SIM* para confirmar ou *NÃO* para voltar.`;
    return `Ainda está comigo${greeting}? Responda à última pergunta para continuar ou envie *MENU* para reiniciar.`;
  }

  async function processInactivitySweep() {
    const db = getDb();
    if (!db) return { skipped: true, reason: 'database_unavailable', reminded: 0, reset: 0 };
    const now = Date.now();
    const reminderAfter = 5 * 60 * 1000;
    const resetAfter = 10 * 60 * 1000;
    const active = await db.select().from(schema.navoBotConversations).where(and(
      ne(schema.navoBotConversations.state, 'idle'),
      ne(schema.navoBotConversations.state, 'human'),
      eq(schema.navoBotConversations.handoffRequested, false),
    )).limit(200);
    let reminded = 0;
    let reset = 0;
    for (const row of active) {
      const latest = (await db.select().from(schema.navoBotConversations).where(eq(schema.navoBotConversations.id, row.id)).limit(1))[0];
      if (!latest || latest.state === 'idle' || latest.state === 'human' || latest.handoffRequested) continue;
      const context = normalizeContext(latest.context);
      const activityValue = latest.lastOutboundAt || latest.lastInboundAt || latest.updatedAt;
      const inactiveFor = activityValue ? now - new Date(activityValue).getTime() : 0;
      if (inactiveFor < reminderAfter) continue;
      const conversation = { ...latest, context } as Conversation;
      if (inactiveFor >= resetAfter) {
        const preservedContext = context.clientName ? { clientName: context.clientName } : {};
        await updateConversation(conversation, 'idle', preservedContext);
        await reply(conversation, `Como não recebemos uma resposta nos últimos minutos, encerrei este atendimento para não deixar a conversa presa. Quando quiser continuar, envie *OI* ou *MENU*.`);
        reset += 1;
        continue;
      }
      if (context.inactivityReminderSentAt) continue;
      context.inactivityReminderSentAt = new Date(now).toISOString();
      await updateConversation(conversation, latest.state, context);
      await reply(conversation, inactivityMessage(latest.state, context.clientName));
      reminded += 1;
    }
    return { skipped: false, reminded, reset };
  }

  return { handleWebhook, processInactivitySweep, testAiConnection };
}
