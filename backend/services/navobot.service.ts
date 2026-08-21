import crypto from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';
import { checkSlotAvailability, fetchDaySlotContext, invalidateAvailabilityCache } from './availability.service.js';
import { getCurrentTimeBRT, getDayOfWeekKey, getTodayStringBRT, minutesToTime, timeToMinutes } from '../utils/datetime.js';
import { generateBookingCode, matchPhoneNumbers, sanitizePhone } from '../utils/index.js';
import {
  classifyDeterministicIntent,
  extractBookingCode,
  extractEvolutionMessage,
  isNegativeConfirmation,
  isPositiveConfirmation,
  normalizeIntentName,
  parseDateFromText,
  parseTimeFromText,
  type ExtractedEvolutionMessage,
  type NavoBotIntent,
} from './navobot-intent.js';

const ACTIVE_STATUSES = new Set(['confirmed', 'pending', 'pending_approval', 'in_queue', 'in_service']);
const TERMINAL_STATUSES = new Set(['cancelled', 'completed', 'no_show']);
const CONVERSATION_TTL_MS = 30 * 60 * 1000;

export type NavoBotDeps = {
  getDb: () => any;
  schema: any;
  sendText: (phone: string, text: string) => Promise<boolean>;
};

type BotContext = {
  pendingAction?: 'book' | 'reschedule' | 'cancel';
  appointmentId?: string;
  candidateAppointmentIds?: string[];
  serviceId?: string;
  serviceOptions?: string[];
  date?: string;
  timeSlot?: string;
  professionalId?: string;
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

function confirmationText(action: 'book' | 'reschedule' | 'cancel', appointment: any, context: BotContext, service?: any): string {
  if (action === 'cancel') {
    return `Confirma o cancelamento do agendamento ${appointmentLabel(appointment)}?\n\nResponda *SIM* para confirmar ou *NÃO* para voltar.`;
  }
  if (action === 'reschedule') {
    return `Confirma o reagendamento para *${dateLabel(context.date || appointment.date)}* às *${context.timeSlot || appointment.timeSlot}*?\n\nResponda *SIM* para confirmar ou *NÃO* para voltar.`;
  }
  return `Vou registrar este agendamento:\n\n*${service?.title || 'Serviço'}* · ${money(service?.price)}\n📅 *${dateLabel(context.date || '')}* às *${context.timeSlot || ''}*\n✂️ *${appointment?.professionalName || 'profissional a definir'}*\n💳 Pagamento no local\n\nConfirma? Responda *SIM* ou *NÃO*.`;
}

function numericSelection(text: string): number | null {
  const value = Number(text.trim());
  return Number.isInteger(value) && value > 0 ? value - 1 : null;
}

async function classifyWithAi(text: string, state: string): Promise<NavoBotIntent> {
  if (!ai || text.length > 1200) return 'unknown';
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: `Estado atual: ${state}\nMensagem do cliente: ${text}` }] }],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            intent: {
              type: 'STRING',
              enum: ['menu', 'appointments', 'book', 'confirm', 'reschedule', 'cancel', 'human', 'unknown'],
            },
            confidence: { type: 'NUMBER' },
          },
          required: ['intent', 'confidence'],
        } as any,
        systemInstruction: 'Classifique a intenção do cliente para um assistente de agendamentos. Retorne apenas JSON. Se houver dúvida, use unknown. Não execute nenhuma ação.',
      },
    });
    const parsed = JSON.parse(response.text || '{}');
    const confidence = Number(parsed.confidence || 0);
    return confidence >= 0.65 ? normalizeIntentName(parsed.intent) : 'unknown';
  } catch (error) {
    console.warn('[NavoBot] Falha no classificador de IA; seguindo com fluxo determinístico.', error);
    return 'unknown';
  }
}

export function createNavoBotService({ getDb, schema, sendText }: NavoBotDeps) {
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

  async function reply(conversation: Conversation, text: string) {
    const db = getDb();
    const sent = await sendText(conversation.phone, text);
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
    return sent;
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

  async function listServices(conversation: Conversation, context: BotContext) {
    const db = getDb();
    const services = await db.query.services.findMany();
    const activeServices = services.filter((service: any) => service.title && Number(service.durationMinutes) > 0);
    context.serviceOptions = activeServices.map((service: any) => service.id);
    await updateConversation(conversation, 'awaiting_service', context);
    return reply(conversation, 'Claro. Escolha um serviço respondendo com o número:\n\n' + activeServices.map((service: any, index: number) => `${index + 1}. ${serviceLabel(service)}`).join('\n'));
  }

  async function getService(context: BotContext) {
    const db = getDb();
    if (!context.serviceId) return null;
    return db.query.services.findFirst({ where: eq(schema.services.id, context.serviceId) });
  }

  async function startBooking(conversation: Conversation, context: BotContext, text: string) {
    context.pendingAction = 'book';
    const db = getDb();
    const services = await db.query.services.findMany();
    const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const matchedService = services.find((service: any) => normalized.includes(String(service.title).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
    if (matchedService) context.serviceId = matchedService.id;
    if (!context.serviceId) return listServices(conversation, context);
    const date = parseDateFromText(text);
    const time = parseTimeFromText(text);
    if (date) context.date = date;
    if (time) context.timeSlot = time;
    if (!context.date) {
      await updateConversation(conversation, 'awaiting_date', context);
      return reply(conversation, 'Qual dia você prefere? Pode responder, por exemplo, *amanhã*, *sábado* ou *25/08*.');
    }
    if (!context.timeSlot) {
      await updateConversation(conversation, 'awaiting_time', context);
      return reply(conversation, `Perfeito. Para *${dateLabel(context.date)}*, qual horário você prefere?`);
    }
    return prepareBookingConfirmation(conversation, context);
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
    const service = await getService(context);
    if (!service || !context.date || !context.timeSlot) return reply(conversation, 'Preciso do serviço, dia e horário para continuar. Responda *AGENDAR* para começar novamente.');
    const check = await checkSlotAvailability({
      dateStr: context.date,
      startMins: timeToMinutes(context.timeSlot),
      reqDuration: Number(service.durationMinutes),
      profId: context.professionalId || '',
      todayBRT: getTodayStringBRT(),
      currTimeBRT: getCurrentTimeBRT(),
    });
    if (!check.available) {
      const suggestions = await suggestSlots(context.date, Number(service.durationMinutes), context.professionalId || '');
      return reply(conversation, suggestions.length
        ? `Esse horário não está disponível. Para *${dateLabel(context.date)}*, posso oferecer: ${suggestions.join(', ')}. Responda com um deles ou escolha outro dia.`
        : `Não encontrei horários livres para *${dateLabel(context.date)}*. Responda com outro dia para eu consultar.`);
    }
    context.professionalId = check.chosenProf?.id || context.professionalId || 'prof_any';
    await updateConversation(conversation, 'awaiting_confirmation', context);
    return reply(conversation, confirmationText('book', { professionalName: check.chosenProf?.name }, context, service));
  }

  async function executeBooking(conversation: Conversation, context: BotContext) {
    const db = getDb();
    const service = await getService(context);
    if (!service || !context.date || !context.timeSlot) return reply(conversation, 'A sessão expirou. Responda *AGENDAR* para iniciar novamente.');
    const check = await checkSlotAvailability({
      dateStr: context.date,
      startMins: timeToMinutes(context.timeSlot),
      reqDuration: Number(service.durationMinutes),
      profId: context.professionalId || '',
      todayBRT: getTodayStringBRT(),
      currTimeBRT: getCurrentTimeBRT(),
    });
    if (!check.available || !check.chosenProf) return reply(conversation, 'Esse horário acabou de ser ocupado. Responda com outro horário para consultar novamente.');

    const profiles = await db.query.profiles.findMany();
    const existingProfile = profiles.find((profile: any) => profile.phone && matchPhoneNumbers(profile.phone, conversation.phone));
    const clientId = existingProfile?.id || `wa_${conversation.phone}`;
    const clientName = existingProfile?.name || 'Cliente WhatsApp';
    const appointmentId = `apt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const isPendingApproval = !!check.requiresApproval;
    const originalAmount = Number(service.price || 0);
    const appointment = {
      id: appointmentId,
      clientId,
      clientName,
      clientPhone: sanitizePhone(conversation.phone),
      clientEmail: existingProfile?.email || null,
      professionalId: check.chosenProf.id,
      professionalName: check.chosenProf.name,
      date: context.date,
      timeSlot: context.timeSlot,
      status: isPendingApproval ? 'pending_approval' : 'confirmed',
      totalDurationMinutes: Number(service.durationMinutes),
      originalAmount: originalAmount.toFixed(2),
      discountAmount: '0.00',
      finalAmount: originalAmount.toFixed(2),
      paymentMethod: 'pay_at_venue',
      bookingCode: generateBookingCode(),
      services: [{ id: service.id, title: service.title, price: service.price, durationMinutes: service.durationMinutes }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await db.transaction(async (tx: any) => {
        if (!existingProfile) {
          await tx.insert(schema.profiles).values({
            id: clientId,
            name: clientName,
            email: `${clientId}@whatsapp.navo.local`,
            phone: sanitizePhone(conversation.phone),
            role: 'client',
            loyaltyPoints: 0,
            loyaltyTier: 'Bronze',
          }).onConflictDoNothing();
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
    return reply(conversation, `Agendamento ${isPendingApproval ? 'enviado para aprovação' : 'confirmado'} com sucesso.\n\n🔑 Código: *${appointment.bookingCode}*\n📅 ${dateLabel(appointment.date)} às ${appointment.timeSlot}\n✂️ ${appointment.professionalName}\n💈 ${service.title}\n\nGuarde esse código para consultar, reagendar ou cancelar.`);
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
      return reply(conversation, confirmationText('cancel', appointment, context));
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
      return reply(conversation, confirmationText('cancel', appointment, context));
    }
    await updateConversation(conversation, 'awaiting_date', context);
    return reply(conversation, `Certo. Vamos reagendar ${appointmentLabel(appointment)}. Qual novo dia você prefere?`);
  }

  async function handleState(conversation: Conversation, context: BotContext, text: string) {
    if (conversation.state === 'human') {
      if (classifyDeterministicIntent(text) === 'menu') {
        await updateConversation(conversation, 'idle', {});
        return reply(conversation, menuText());
      }
      return reply(conversation, 'Sua solicitação foi encaminhada para a equipe. Se quiser voltar ao menu automático, responda *MENU*.');
    }
    if (conversation.state === 'awaiting_appointment') return handleAwaitingAppointment(conversation, context, text);
    if (conversation.state === 'awaiting_service') {
      const db = getDb();
      const services = await db.query.services.findMany();
      const index = numericSelection(text);
      const selectedId = index !== null && context.serviceOptions?.[index] ? context.serviceOptions[index] : null;
      const selected = selectedId ? services.find((service: any) => service.id === selectedId) : services.find((service: any) => text.toLowerCase().includes(String(service.title).toLowerCase()));
      if (!selected) return reply(conversation, 'Não identifiquei esse serviço. Responda com um dos números da lista ou *MENU*.');
      context.serviceId = selected.id;
      await updateConversation(conversation, 'awaiting_date', context);
      return reply(conversation, `Perfeito: *${selected.title}*. Qual dia você prefere?`);
    }
    if (conversation.state === 'awaiting_date') {
      const date = parseDateFromText(text);
      if (!date) return reply(conversation, 'Não consegui identificar o dia. Responda, por exemplo, *amanhã*, *sábado* ou *25/08*.');
      context.date = date;
      await updateConversation(conversation, 'awaiting_time', context);
      return reply(conversation, `Ótimo. Para *${dateLabel(date)}*, qual horário você prefere?`);
    }
    if (conversation.state === 'awaiting_time') {
      const time = parseTimeFromText(text);
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
      return reply(conversation, confirmationText('reschedule', appointment, context));
    }
    if (conversation.state === 'awaiting_confirmation') {
      const appointment = context.appointmentId ? await findAppointment(conversation, context) : null;
      if (isNegativeConfirmation(text)) {
        await updateConversation(conversation, 'idle', {});
        return reply(conversation, 'Tudo bem, não alterei nada.\n\n' + menuText());
      }
      if (!isPositiveConfirmation(text)) return reply(conversation, 'Responda *SIM* para confirmar ou *NÃO* para voltar.');
      if (context.pendingAction === 'cancel' && appointment) return executeCancellation(conversation, appointment);
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
    const stateReply = await handleState(conversation, context, message.text);
    if (stateReply !== null) return { handled: true, intent: deterministic || 'state' };

    const intent = deterministic || await classifyWithAi(message.text, conversation.state);
    if (intent === 'menu' || intent === 'unknown') {
      await updateConversation(conversation, 'idle', {});
      await reply(conversation, menuText(message.pushName));
      return { handled: true, intent };
    }
    if (intent === 'human') {
      await updateConversation(conversation, 'human', {}, true);
      await reply(conversation, 'Vou encaminhar sua conversa para a equipe. Em breve alguém continuará o atendimento por aqui.');
      return { handled: true, intent };
    }
    if (intent === 'appointments') {
      await updateConversation(conversation, 'idle', {});
      await listAppointments(conversation);
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

  async function handleWebhook(payload: any) {
    const message = extractEvolutionMessage(payload);
    if (!message) return { ignored: true, reason: 'not_an_inbound_text_message' };
    return handleMessage(message);
  }

  return { handleWebhook };
}
