import crypto from 'node:crypto';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { checkSlotAvailability, fetchDaySlotContext, invalidateAvailabilityCache } from './availability.service.js';
import { NAVOBOT_PROMPT_VERSION, NAVOBOT_SYSTEM_PROMPT } from './navobot-prompt.js';
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

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'navobot' } },
    })
  : null;

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
  return `${greeting} Eu sou o *NavoBot*, assistente da Navo Barber & Club.\n\n` +
    'Posso ajudar com:\n' +
    '1. Novo agendamento\n' +
    '2. Consultar meu agendamento\n' +
    '3. Reagendar\n' +
    '4. Cancelar\n' +
    '5. Falar com a equipe\n\n' +
    'Você também pode escrever o que precisa, por exemplo: “quero reagendar meu corte para amanhã às 15h”.';
}

function serviceLabel(service: any): string {
  return `${service.title} · ${service.durationMinutes} min · ${money(service.price)}`;
}

function appointmentLabel(appointment: any): string {
  const service = Array.isArray(appointment.services) && appointment.services[0]
    ? typeof appointment.services[0] === 'string' ? appointment.services[0] : appointment.services[0].title
    : 'Serviço agendado';
  return `*${service || 'Serviço agendado'}* em *${dateLabel(appointment.date)}* às *${appointment.timeSlot}* com *${appointment.professionalName || 'profissional Navo'}*`;
}

function confirmationText(action: 'book' | 'reschedule' | 'cancel', appointment: any, context: BotContext, services: any[] = []): string {
  if (action === 'cancel') {
    return `Confirma o cancelamento do agendamento ${appointmentLabel(appointment)}?\n\nResponda *SIM* para confirmar ou *NÃO* para voltar.`;
  }
  if (action === 'reschedule') {
    return `Confirma o reagendamento para *${dateLabel(context.date || appointment.date)}* às *${context.timeSlot || appointment.timeSlot}*?\n\nResponda *SIM* para confirmar ou *NÃO* para voltar.`;
  }
  const serviceLines = services.length
    ? services.map((service) => `• ${service.title} · ${service.durationMinutes} min · ${money(service.price)}`).join('\n')
    : '• Serviço a definir';
  return `Vou registrar este agendamento:\n\n${serviceLines}\n\n⏱️ Duração total: *${services.reduce((total, service) => total + Number(service.durationMinutes || 0), 0)} min*\n📅 *${dateLabel(context.date || '')}* às *${context.timeSlot || ''}*\n✂️ *${appointment?.professionalName || 'profissional a definir'}*\n💳 Pagamento no local\n\nConfirma? Responda *SIM* ou *NÃO*.`;
}

function confirmationPayload(action: 'book' | 'reschedule' | 'cancel', appointment: any, context: BotContext, services: any[] = []) {
  const text = confirmationText(action, appointment, context, services);
  const buttons = action === 'cancel'
    ? [
        { type: 'reply' as const, id: 'confirm:yes', displayText: 'Sim, cancelar' },
        { type: 'reply' as const, id: 'confirm:no', displayText: 'Não, manter' },
      ]
    : [
        { type: 'reply' as const, id: 'confirm:yes', displayText: 'Sim, confirmar' },
        { type: 'reply' as const, id: 'confirm:no', displayText: 'Não, voltar' },
      ];
  return {
    title: action === 'cancel' ? 'Confirmar cancelamento' : action === 'reschedule' ? 'Confirmar reagendamento' : 'Confirmar agendamento',
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

async function classifyWithAi(text: string, state: string, context: BotContext = {}): Promise<NavoBotIntent> {
  if (!ai) {
    console.warn('[NavoBot][Gemini] Fallback não utilizado: GEMINI_API_KEY ausente.');
    return 'unknown';
  }
  if (text.length > 1200) {
    console.info('[NavoBot][Gemini] Fallback ignorado: mensagem acima de 1200 caracteres.');
    return 'unknown';
  }
  try {
    console.info(`[NavoBot][Gemini] Classificando mensagem no estado ${state}.`);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
              enum: ['menu', 'appointments', 'availability', 'book', 'confirm', 'reschedule', 'cancel', 'cancel_all', 'complaint', 'human', 'unknown'],
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

export function createNavoBotService({ getDb, schema, sendText, sendButtons, sendList, useInteractiveMessages }: NavoBotDeps) {
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

  async function handleHumanState(conversation: Conversation, context: BotContext, text: string, contextualIntent: NavoBotIntent | null) {
    const stateIntent = contextualIntent || classifyDeterministicIntent(text);
    if (stateIntent === 'menu') {
      await updateConversation(conversation, 'idle', {});
      return reply(conversation, menuText());
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
    const fallback = `Escolha um serviço (responda com o número ou nome):\n\n` + activeServices.map((service: any, index: number) => `${index + 1}. *${compactServiceTitle(service.title)}* · ${money(service.price)}`).join('\n') + `\n\nO agendamento também pode ser feito diretamente pela plataforma Navo. Catálogo completo:\n${NAVO_CATALOG_URL}\n\nApós concluir pelo site, a confirmação será enviada automaticamente para este WhatsApp.`;
    const rows = activeServices.map((service: any, index: number) => ({
      title: `${index + 1}. ${compactServiceTitle(service.title, 24)}`,
      rowId: `service:${service.id}`,
      description: money(service.price),
    }));
    const payload = {
      title: 'Serviços da Navo',
      description: `Catálogo completo: ${NAVO_CATALOG_URL}`,
      buttonText: 'Ver serviços',
      footerText: 'NavoBot',
      sections: [{ title: 'Serviços disponíveis', rows }],
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
    const selected = services.map((service: any) => `• ${service.title}`).join('\n') || 'Nenhum serviço selecionado';
    const fallback = `Serviço selecionado:\n${selected}\n\nDeseja adicionar outro serviço? Responda *ADICIONAR* ou *CONTINUAR*.`;
    await updateConversation(conversation, 'awaiting_more_services', context);
    return replyButtons(conversation, fallback, {
      title: 'Serviço selecionado',
      description: `Você selecionou:\n${selected}`,
      footerText: 'NavoBot',
      buttons: [
        { type: 'reply', id: 'service:add', displayText: 'Adicionar outro' },
        { type: 'reply', id: 'service:done', displayText: 'Continuar' },
      ],
    });
  }

  async function askProfessional(conversation: Conversation, context: BotContext) {
    const db = getDb();
    const professionals = (await db.query.professionals.findMany()).filter((professional: any) => professional.isActive !== false);
    context.professionalOptions = ['prof_any', ...professionals.map((professional: any) => professional.id)];
    await updateConversation(conversation, 'awaiting_professional', context);
    const fallback = 'Selecione um profissional:\n\n0. Qualquer profissional\n' + professionals.map((professional: any, index: number) => `${index + 1}. ${professional.name}`).join('\n') + '\n\nResponda com o número.';
    const payload = {
      title: 'Escolha o profissional',
      description: 'Selecione um profissional específico ou a opção qualquer profissional.',
      buttonText: 'Ver profissionais',
      footerText: 'NavoBot',
      sections: [{
        title: 'Profissionais ativos',
        rows: [
          { title: 'Qualquer profissional', rowId: 'professional:prof_any', description: 'Mais opções de horário' },
          ...professionals.map((professional: any) => ({
            title: String(professional.name).slice(0, 24),
            rowId: `professional:${professional.id}`,
            description: professional.roleTitle || 'Profissional Navo',
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
      return reply(conversation, 'Consigo consultar os horários disponíveis. Para calcular corretamente, preciso saber qual serviço você deseja fazer, pois cada serviço tem uma duração diferente.\n\nResponda com o nome do serviço ou acesse o catálogo completo: https://navoproject.vercel.app/?catalog=1');
    }

    const totalDuration = matchedServices.reduce((sum: number, s: any) => sum + Number(s.durationMinutes || 30), 0);
    const serviceTitles = matchedServices.map((s: any) => s.title).join(' e ');
    const serviceIds = matchedServices.map((s: any) => s.id);
    const date = parseDateFromText(text) || context.availabilityDate || getTodayStringBRT();
    const slots = await suggestSlots(date, totalDuration, context.professionalId || '');
    const nextContext = contextForNewIntent(context, { availabilityDate: date, availabilityOptions: [], serviceIds, serviceId: serviceIds[0] });
    await updateConversation(conversation, 'idle', nextContext);
    
    if (!slots.length) {
      return reply(conversation, `Não encontrei horários livres para *${dateLabel(date)}* para *${serviceTitles}*. Informe outra data para uma nova consulta.`);
    }
    return reply(conversation, `Horários disponíveis para *${serviceTitles}* em *${dateLabel(date)}*:\n\n${slots.map((slot) => `• *${slot}*`).join('\n')}\n\nPara iniciar o agendamento, responda *AGENDAR* seguido do horário escolhido ou acesse o link:\nhttps://navoproject.vercel.app/?catalog=1`);
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
      return reply(conversation, 'Sinto muito pela experiência. Sua mensagem foi encaminhada para a equipe responsável. Se desejar, descreva o que aconteceu para facilitar a análise. Não é necessário repetir seus dados pessoais.');
    }
    if (canInterruptFlow && stateIntent === 'human') {
      const nextContext = contextForNewIntent(context);
      await updateConversation(conversation, 'human', nextContext, true);
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
      return reply(conversation, 'Deseja adicionar outro serviço? Responda *ADICIONAR* ou *CONTINUAR*.');
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
    const interruptIntents = new Set<NavoBotIntent>(['menu', 'appointments', 'availability', 'book', 'cancel', 'cancel_all', 'complaint', 'reschedule', 'human']);
    const contextualIntent = deterministic || (aiIntent && interruptIntents.has(aiIntent) ? aiIntent : null);
    const stateReply = await handleState(conversation, context, message.text, contextualIntent);
    if (stateReply !== null) return { handled: true, intent: contextualIntent || aiIntent || 'state' };

    const intent = contextualIntent || aiIntent || await classifyWithAi(message.text, conversation.state, context);
    if (intent === 'menu' || intent === 'unknown') {
      await updateConversation(conversation, 'idle', context);
      await reply(conversation, menuText(message.pushName));
      return { handled: true, intent };
    }
    if (intent === 'complaint') {
      const nextContext = contextForNewIntent(context);
      await updateConversation(conversation, 'human', nextContext, true);
      await reply(conversation, 'Sinto muito pela experiência. Sua mensagem foi encaminhada para a equipe responsável. Se desejar, descreva o que aconteceu para facilitar a análise. Não é necessário repetir seus dados pessoais.');
      return { handled: true, intent };
    }
    if (intent === 'human') {
      await updateConversation(conversation, 'human', { ...context, humanFollowUpCount: 0 }, true);
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
    if (!ai) {
      return { ok: false, configured: false, usedGemini: false, model: 'gemini-2.5-flash', latencyMs: 0, message: 'GEMINI_API_KEY não está configurada no ambiente.' };
    }
    const startedAt = Date.now();
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: 'Responda somente com a palavra OK.' }] }],
        config: { temperature: 0, maxOutputTokens: 32, thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } },
      });
      const responseText = extractGeminiText(response);
      const diagnostics = geminiResponseDiagnostics(response);
      return {
        ok: !!responseText,
        configured: true,
        usedGemini: true,
        model: 'gemini-2.5-flash',
        latencyMs: Date.now() - startedAt,
        response: responseText.slice(0, 40),
        message: responseText ? 'Gemini respondeu com sucesso.' : `Gemini foi chamado, mas não retornou texto${diagnostics ? ` (${diagnostics})` : ''}.`,
      };
    } catch (error: any) {
      return {
        ok: false,
        configured: true,
        usedGemini: false,
        model: 'gemini-2.5-flash',
        latencyMs: Date.now() - startedAt,
        message: `Falha ao chamar o Gemini: ${String(error?.message || 'erro desconhecido').slice(0, 240)}`,
      };
    }
  }

  async function handleWebhook(payload: any) {
    const message = extractEvolutionMessage(payload);
    if (!message) return { ignored: true, reason: 'not_an_inbound_text_message' };
    return handleMessage(message);
  }

  function inactivityMessage(state: string, clientName?: string): string {
    const greeting = clientName ? ` ${clientName}` : '';
    if (state === 'awaiting_service') return `Ainda está comigo${greeting}? Posso continuar escolhendo o serviço. Responda com o número ou escreva o nome do serviço.`;
    if (state === 'awaiting_availability_service') return `Ainda está comigo${greeting}? Qual serviço você deseja usar para consultar os horários?`;
    if (state === 'awaiting_more_services') return `Ainda está comigo${greeting}? Deseja adicionar outro serviço ou continuar? Responda *ADICIONAR* ou *CONTINUAR*.`;
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
