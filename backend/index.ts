import crypto from 'crypto';
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, or, and, desc, like, sql } from "drizzle-orm";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { GoogleGenAI } from "@google/genai";
import * as schema from "../src/db/schema.js";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import { 
  getTodayStringBRT, 
  getCurrentTimeBRT, 
  timeToMinutes, 
  minutesToTime, 
  getDayOfWeekKey, 
  checkIntervalOverlap,
  userErrors,
  handleError,
  sanitizePhone,
  normalizePhone,
  matchPhoneNumbers,
  bookingSchema,
  generateBookingCode
} from './utils/index.js';

import {
  apiLimiter,
  authLimiter,
  sensitiveOpsLimiter
} from './middleware/rate-limiters.js';


import {
  requireAuth,
  requireAdmin,
  optionalAuth,
  setAuthCookie,
  corsMiddleware,
  validateOrigin
} from './middleware/index.js';
import { JWT_SECRET } from './config/env.js';
import { DEFAULT_LOYALTY_CONFIG, normalizeLoyaltyConfig } from './services/loyalty-engine.service.js';

const app = express();
// Express re-adds "X-Powered-By: Express" lazily on every res.send() unless this is
// disabled at the app level — helmet's hidePoweredBy alone isn't enough because it only
// strips the header once, earlier in the middleware chain, before Express sets it again.
app.disable('x-powered-by');
app.set("trust proxy", 1);

app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

if (!process.env.DATABASE_URL && !process.env.SQL_HOST) {
  console.warn("NOTICE: DATABASE_URL or SQL_HOST not defined. Ensure Supabase credentials are configured.");
}

export let db: any = null;
export let isDbConnected = false;
export let dbReadyPromise: any = null;

const MAX_INIT_ATTEMPTS = 5;
let dbInitAttempts = 0;

export async function initializeDb(): Promise<void> {
  try {
    const dbUrl = process.env.DATABASE_URL;
    const sqlHost = process.env.SQL_HOST;

    if (dbUrl || sqlHost) {
      const connectionString = dbUrl || `postgres://${process.env.SQL_USER}:${process.env.SQL_PASSWORD}@${sqlHost}:5432/${process.env.SQL_DB_NAME}`;
      const sqlClient = postgres(connectionString, { 
        max: 20, 
        idle_timeout: 30,
        connect_timeout: 10,
        prepare: false
      });
      db = drizzle(sqlClient, { schema });
      isDbConnected = true;
      console.log('[API] ✅ Conexão com Supabase estabelecida com sucesso.');
      // Warm up connection pool asynchronously
      db.query.shopSettings.findFirst({ where: eq(schema.shopSettings.id, 'default') }).catch(() => {});
    } else {
      throw new Error('Variáveis de ambiente do banco de dados não estão configuradas.');
    }
  } catch (err: any) {
    console.error('[API] ❌ Falha ao conectar ao banco:', err.message);
    if (dbInitAttempts < MAX_INIT_ATTEMPTS) {
      dbInitAttempts++;
      const delay = dbInitAttempts * 1000;
      console.log(`[API] Tentativa ${dbInitAttempts}/${MAX_INIT_ATTEMPTS} de reconexão em ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return initializeDb();
    }
    db = null;
    isDbConnected = false;
    console.error('[API] ❌ Não foi possível conectar ao banco de dados Supabase.');
  }
}

dbReadyPromise = initializeDb();


app.use(validateOrigin);

const contentSecurityPolicy = process.env.NODE_ENV === 'production'
  ? {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https:', 'wss:'],
        frameSrc: ["'self'", 'https://www.google.com', 'https://www.google.com/maps', 'https://maps.google.com'],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: [],
      },
    }
  : false;

app.use(helmet({
  contentSecurityPolicy,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  frameguard: { action: 'deny' },
}));
app.use("/api/", apiLimiter);
app.use("/api", async (req, res, next) => {
  // Rotas públicas que não precisam de banco ou possuem dados de fallback
  const publicRoutes = [
    '/whatsapp/status',
    '/evolution/webhook',
    '/health'
  ];
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  // Aguarda a inicialização do banco (se ainda estiver em andamento)
  if (!isDbConnected && dbReadyPromise) {
    try {
      await dbReadyPromise;
    } catch (e) {
      // Silencioso - o erro já foi logado em initializeDb()
    }
  }

  // Se ainda não conectou, tenta UMA reconexão rápida antes de falhar
  if (!isDbConnected || !db) {
    try {
      await initializeDb();
    } catch (e) {
      // Ignora - vamos retornar erro amigável abaixo
    }
  }

  // Verificação final
  if (!isDbConnected || !db) {
    return res.status(503).json({
      error: userErrors.dbDisconnected
    });
  }

  next();
});

import { healthRouter } from './routers/health.router.js';

app.use('/api/health', healthRouter);



import { systemRouter } from './routers/system.router.js';
import { seedRouter } from './routers/seed.router.js';
import { authRouter, preferencesRouter } from './routers/auth.router.js';
import { profilesRouter } from './routers/profiles.router.js';
import { relationshipRouter } from './routers/relationship.router.js';
import { queueRouter } from './routers/queue.router.js';
import { productsRouter } from './routers/products.router.js';
import { servicesRouter } from './routers/services.router.js';
import { professionalsRouter } from './routers/professionals.router.js';
import { scheduleBlocksRouter } from './routers/schedule-blocks.router.js';
import { cashTransactionsRouter } from './routers/cash-transactions.router.js';
import { receiptsRouter } from './routers/receipts.router.js';
import { adminPushRouter } from './routers/admin-push.router.js';
import { financialReportsRouter } from './routers/financial-reports.router.js';
import { operationalReportsRouter } from './routers/operational-reports.router.js';
import { availabilityRouter, invalidateAvailabilityCache } from './routers/availability.router.js';
import { operationSettingsRouter } from './routers/operation-settings.router.js';
import { printSettingsRouter } from './routers/print-settings.router.js';
import { appointmentsRouter } from './routers/appointments.router.js';
import { loyaltyRouter } from './routers/loyalty.router.js';
import { referralsRouter } from './routers/referrals.router.js';
import { rewardsRouter } from './routers/rewards.router.js';
import { reviewsRouter } from './routers/reviews.router.js';

app.use('/api/system', systemRouter);
app.use('/api/seed', seedRouter);
app.use('/api/auth', authRouter);
app.use('/api/preferences', preferencesRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/relationship', relationshipRouter);
app.use('/api/queue', queueRouter);
app.use('/api/products', productsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/professionals', professionalsRouter);
app.use('/api/schedule-blocks', scheduleBlocksRouter);
app.use('/api/cash-transactions', cashTransactionsRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api/admin-push', adminPushRouter);
app.use('/api/financial-reports', financialReportsRouter);
app.use('/api/operational-reports', operationalReportsRouter);
app.use('/api/availability', availabilityRouter);
app.use('/api/operation-settings', operationSettingsRouter);
app.use('/api/print-settings', printSettingsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/loyalty', loyaltyRouter);
app.use('/api/referrals', referralsRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/reviews', reviewsRouter);

// Migrate moved to setup.js execution or manual script if needed, or keeping it but it's rarely used from API directly. Wait, the user request says to modularize. Let's create a migrate router just to be safe. Actually, I can just mount seedRouter and remove the local seed route.


// --- WhatsApp Notification Service (Baileys) ---
import whatsappRouter, { sendWhatsAppMessage } from './whatsapp.js';
app.use('/api/whatsapp/reconnect', requireAuth, requireAdmin);
app.use('/api/whatsapp/logout', requireAuth, requireAdmin);
app.use('/api/whatsapp', whatsappRouter);

// --- Email Notification Service (SMTP via nodemailer) ---
import { createEmailModule } from './email.js';
const { router: emailRouter, sendEmail, getEmailSettings } = createEmailModule(() => db, schema, eq);
app.use('/api/email/config', requireAuth, requireAdmin);
app.use('/api/email/test', requireAuth, requireAdmin);
app.use('/api/email', emailRouter);

import { createEvolutionApiModule } from './evolution-api.js';
const { router: evolutionApiRouter } = createEvolutionApiModule({ getDb: () => db, schema, eq });
app.use('/api/evolution', evolutionApiRouter);

/** Busca o e-mail do cliente pelo clientId (perfil), sem derrubar o fluxo principal se falhar. */
export async function getClientEmail(clientId: string | undefined | null, appointmentEmail?: string | null): Promise<string | null> {
  const explicitEmail = typeof appointmentEmail === 'string' ? appointmentEmail.trim().toLowerCase() : '';
  if (explicitEmail) return explicitEmail;
  if (!clientId || clientId === 'usr_guest') return null;
  try {
    const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, clientId) });
    return profile?.email || null;
  } catch (e) {
    return null;
  }
}

export function buildBookingConfirmationEmail(apt: any) {
  const subject = `Agendamento confirmado — ${apt.date} às ${apt.timeSlot}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="color: #b8860b;">💈 Navo Barber &amp; Club</h2>
      <p>Olá, <strong>${apt.clientName || 'Cliente'}</strong>!</p>
      <p>Seu agendamento foi <strong>confirmado</strong> com sucesso:</p>
      <ul style="line-height: 1.8;">
        <li><strong>Código:</strong> ${apt.bookingCode || apt.id}</li>
        <li><strong>Data:</strong> ${apt.date}</li>
        <li><strong>Horário:</strong> ${apt.timeSlot}</li>
        <li><strong>Profissional:</strong> ${apt.professionalName || 'Profissional Navo Barber'}</li>
      </ul>
      <p>Te esperamos com o café pronto! ☕</p>
    </div>`;
  return { subject, html };
}

export function buildBookingCancellationEmail(apt: any) {
  const subject = `Agendamento cancelado — ${apt.date} às ${apt.timeSlot}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="color: #b8860b;">💈 Navo Barber &amp; Club</h2>
      <p>Olá, <strong>${apt.clientName || 'Cliente'}</strong>!</p>
      <p>Seu agendamento para <strong>${apt.date}</strong> às <strong>${apt.timeSlot}</strong> foi <strong>cancelado</strong>.</p>
      <p>Ficamos à disposição para remarcar quando desejar! 💈</p>
    </div>`;
  return { subject, html };
}

export function buildBookingRescheduleEmail(apt: any, previous: any = {}) {
  const subject = `Agendamento reagendado — ${apt.date} às ${apt.timeSlot}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="color: #b8860b;">💈 Navo Barber &amp; Club</h2>
      <p>Olá, <strong>${apt.clientName || 'Cliente'}</strong>!</p>
      <p>Seu agendamento foi <strong>reagendado</strong> com sucesso.</p>
      <ul style="line-height: 1.8;">
        <li><strong>Data e horário anteriores:</strong> ${previous.date || '—'} às ${previous.timeSlot || '—'}</li>
        <li><strong>Nova data e horário:</strong> ${apt.date} às ${apt.timeSlot}</li>
        <li><strong>Profissional:</strong> ${apt.professionalName || 'Profissional Navo'}</li>
      </ul>
      <p>Te esperamos com o café pronto! ☕</p>
    </div>`;
  return { subject, html };
}

function buildShopNotificationEmail(apt: any, kind: 'booking' | 'reschedule' | 'cancel', previous: any = {}) {
  const labels = {
    booking: 'Novo agendamento',
    reschedule: 'Agendamento reagendado',
    cancel: 'Agendamento cancelado',
  };
  const subject = `[Navo] ${labels[kind]} — ${apt.clientName || 'Cliente'}`;
  const schedule = kind === 'reschedule'
    ? `<li><strong>Horário anterior:</strong> ${previous.date || '—'} às ${previous.timeSlot || '—'}</li><li><strong>Novo horário:</strong> ${apt.date} às ${apt.timeSlot}</li>`
    : `<li><strong>Data e horário:</strong> ${apt.date} às ${apt.timeSlot}</li>`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="color: #b8860b;">💈 Navo Barber &amp; Club</h2>
      <p>O sistema registrou <strong>${labels[kind].toLowerCase()}</strong>.</p>
      <ul style="line-height: 1.8;">
        <li><strong>Cliente:</strong> ${apt.clientName || 'Cliente'}</li>
        <li><strong>Telefone:</strong> ${apt.clientPhone || '—'}</li>
        ${schedule}
        <li><strong>Profissional:</strong> ${apt.professionalName || 'Profissional Navo'}</li>
        <li><strong>Serviço:</strong> ${Array.isArray(apt.services) && apt.services[0]?.title ? apt.services[0].title : 'Atendimento'}</li>
      </ul>
      ${kind === 'cancel' ? '<p>O horário foi liberado para a operação.</p>' : '<p>Consulte a Agenda no Admin para acompanhar o atendimento.</p>'}
    </div>`;
  return { subject, html };
}

async function sendAppointmentEmailOnce(to: string, subject: string, html: string, kind: 'booking' | 'reschedule' | 'cancel', appointmentId: string) {
  const recipient = to.trim().toLowerCase();
  if (!recipient) return false;
  let claim: any = null;
  try {
    if (db && schema.notificationDeliveries) {
      const deliveryKey = `appointment-email:${appointmentId}:${kind}:${recipient}`;
      [claim] = await db.insert(schema.notificationDeliveries).values({
        id: `nd_email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        appointmentId,
        kind: `appointment_${kind}`,
        channel: 'email',
        deliveryKey,
        sentAt: new Date(),
      }).onConflictDoNothing().returning({ id: schema.notificationDeliveries.id });
      if (!claim) return false;
    }
    const sent = await sendEmail(recipient, subject, html, undefined, kind);
    if (!sent && claim) await db.delete(schema.notificationDeliveries).where(eq(schema.notificationDeliveries.id, claim.id)).catch(() => {});
    return sent;
  } catch (error) {
    if (claim) await db.delete(schema.notificationDeliveries).where(eq(schema.notificationDeliveries.id, claim.id)).catch(() => {});
    console.error('[Email] Falha ao registrar/enviar notificação:', error);
    return false;
  }
}

/** Envia ao cliente somente se houver e-mail informado no agendamento ou perfil cadastrado. */
export async function notifyClientByEmail(clientId: string | undefined | null, apt: any, kind: 'booking' | 'reschedule' | 'cancel', previous: any = {}) {
  try {
    const email = await getClientEmail(clientId, apt.clientEmail || apt.client_email);
    if (!email) return;
    const template = kind === 'booking'
      ? buildBookingConfirmationEmail(apt)
      : kind === 'reschedule'
        ? buildBookingRescheduleEmail(apt, previous)
        : buildBookingCancellationEmail(apt);
    await sendAppointmentEmailOnce(email, template.subject, template.html, kind, apt.id);
  } catch (e) {
    // Nunca deixa uma falha no envio de e-mail derrubar o fluxo principal.
  }
}

/** Envia o mesmo evento ao e-mail administrativo configurado para a barbearia. */
export async function notifyShopByEmail(apt: any, kind: 'booking' | 'reschedule' | 'cancel', previous: any = {}) {
  try {
    const settings = await getEmailSettings();
    const email = settings?.notificationEmail?.trim();
    if (!email) return;
    const template = buildShopNotificationEmail(apt, kind, previous);
    await sendAppointmentEmailOnce(email, template.subject, template.html, kind, apt.id);
  } catch (e) {
    // Canal opcional: não interrompe agendamento, reagendamento ou cancelamento.
  }
}

// Products API
// =====================================
// Bot Chat API
// =====================================
let ai: GoogleGenAI | null = null;
app.post("/api/bot/chat", requireAuth, async (req: any, res: any) => {
  try {
    if (!ai) {
      if (!process.env.GEMINI_API_KEY) {
         return res.status(500).json({ error: 'GEMINI_API_KEY is not set.' });
      }
      ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
    }

    const { text, history } = req.body;
    
    const services = await db.query.services.findMany();
    const professionals = await db.query.professionals.findMany();
    let queue = await db.query.waitingQueue.findMany();
    let appointments = await db.query.appointments.findMany();
    
    if (req.user.role !== 'admin') {
       queue = queue.filter((q: any) => q.clientId === req.user.id || q.clientPhone === req.user.phone);
       appointments = appointments.filter((a: any) => a.clientId === req.user.id || a.clientPhone === req.user.phone);
    }
    
    let contextText = `Você é o assistente virtual da Navo Barber & Club, que atende 24/7.
Seja educado, prestativo e profissional. Responda de forma concisa.
Se um cliente perguntar sobre serviços, mostre o que temos disponível e os preços.
Se quiserem agendar, instrua o cliente a usar o botão "Agendar" na interface.
Você tem acesso aos agendamentos do cliente logado. O nome dele é ${req.user.name || req.user.email}.

Contexto da Navo Barber & Club:
Serviços:
`;
    services.forEach((s: any) => {
       contextText += `- ${s.title} (${s.durationMinutes} min): R$ ${s.price}\n`;
    });
    
    contextText += `\nProfissionais:\n`;
    professionals.forEach((p: any) => {
       contextText += `- ${p.name} (Especialidades: ${Array.isArray(p.specialties) ? p.specialties.join(', ') : 'N/A'})\n`;
    });

    contextText += `\nFila de Espera Atual:\n`;
    if (queue && queue.length > 0) {
      queue.forEach((q: any) => {
        contextText += `- Cliente: ${q.clientName}, Serviço: ${q.serviceTitle}, Profissional: ${q.professionalName || 'Qualquer'}, Status: ${q.status}\n`;
      });
    } else {
      contextText += `Fila vazia no momento.\n`;
    }

    contextText += `\nAgendamentos Ativos no Sistema:\n`;
    if (appointments && appointments.length > 0) {
      
      // Max 10 recent appointments to avoid blowing up context
      appointments.slice(0, 10).forEach((a: any) => {
        contextText += `- Dia: ${a.date} às ${a.timeSlot}, Cliente: ${a.clientName}, Status: ${a.status}\n`;
      });

    } else {
      contextText += `Nenhum agendamento.\n`;
    }

    const contents = [];
    if (history && history.length > 0) {
      history.forEach((m: any) => {
        contents.push({
          role: m.sender === 'bot' ? 'model' : 'user',
          parts: [{ text: m.text }]
        });
      });
    }
    
    contents.push({
      role: 'user',
      parts: [{ text }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: contextText,
        temperature: 0.7,
      },
    });

    res.json({ reply: response.text });
  } catch (e: any) {
    console.error("Erro no chat:", e);
    const userMessage = (e.status === 401 || e.status === 403 || (e.message && e.message.includes('403')))
      ? 'Não foi possível autenticar com o assistente inteligente. Verifique as credenciais da API.'
      : 'Desculpe, o assistente inteligente está indisponível no momento. Tente novamente mais tarde.';
    res.status(500).json({ error: userMessage, details: e.message });
  }
});

// =====================================
// API Keys & Secrets Validation API
// =====================================
app.get("/api/admin/validate-keys", requireAuth, requireAdmin, async (req: any, res: any) => {
  const results: any[] = [];
  const startTime = Date.now();

  // 1. Validate GEMINI_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    results.push({
      key: 'GEMINI_API_KEY',
      name: 'Google Gemini AI Key',
      status: 'missing',
      configured: false,
      message: 'Chave não configurada no ambiente (.env). Adicione GEMINI_API_KEY para habilitar a IA.',
    });
  } else {
    try {
      const tempAi = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      const testRes = await tempAi.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Atenda com 'OK'",
      });
      if (testRes && testRes.text) {
        results.push({
          key: 'GEMINI_API_KEY',
          name: 'Google Gemini AI Key',
          status: 'valid',
          configured: true,
          modelTested: 'gemini-2.5-flash',
          maskedKey: `${geminiKey.substring(0, 6)}...${geminiKey.substring(geminiKey.length - 4)}`,
          message: 'Chave ativa, autenticada e respondendo com sucesso no modelo gemini-2.5-flash.',
        });
      } else {
        results.push({
          key: 'GEMINI_API_KEY',
          name: 'Google Gemini AI Key',
          status: 'invalid',
          configured: true,
          message: 'Chave respondeu sem texto válido.',
        });
      }
    } catch (err: any) {
      results.push({
        key: 'GEMINI_API_KEY',
        name: 'Google Gemini AI Key',
        status: 'invalid',
        configured: true,
        error: err.message,
        message: `Falha ao validar chave da Gemini: ${err.message || 'Erro de autenticação ou quota excedida'}`,
      });
    }
  }

  // 2. Validate DATABASE_URL / SQL_HOST
  const dbUrl = process.env.DATABASE_URL;
  const sqlHost = process.env.SQL_HOST;

  if (dbUrl || sqlHost) {
    if (isDbConnected && db && db.query) {
      try {
        await db.query.services.findFirst();
        results.push({
          key: 'DATABASE_URL / SQL_HOST',
          name: 'Banco de Dados Relacional (PostgreSQL / Drizzle)',
          status: 'valid',
          configured: true,
          type: 'PostgreSQL',
          message: 'Conexão com PostgreSQL ativa e consultas validadas no banco de dados.',
        });
      } catch (dbErr: any) {
        results.push({
          key: 'DATABASE_URL / SQL_HOST',
          name: 'Banco de Dados Relacional (PostgreSQL / Drizzle)',
          status: 'invalid',
          configured: true,
          type: 'PostgreSQL',
          message: `Erro ao realizar consulta de teste no PostgreSQL: ${dbErr.message}`,
        });
      }
    } else {
      results.push({
        key: 'DATABASE_URL',
        name: 'Banco de Dados Relacional',
        status: 'fallback',
        configured: true,
        type: 'In-Memory / FileStore',
        message: 'Variável definida porém operando em modo de contingência em memória.',
      });
    }
  } else {
    results.push({
      key: 'DATABASE_URL',
      name: 'Banco de Dados Relacional (PostgreSQL)',
      status: 'fallback',
      configured: false,
      type: 'In-Memory FileStore',
      message: 'DATABASE_URL/SQL_HOST não configurado. Aplicação rodando em armazenamento local JSON (FileStore).',
    });
  }

  // 3. Validate JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    results.push({
      key: 'JWT_SECRET',
      name: 'Chave de Assinatura de Tokens JWT',
      status: 'warning',
      configured: false,
      message: 'Usando chave secreta padrão do sistema. Recomendado definir JWT_SECRET no .env para produção.',
    });
  } else if (jwtSecret.length < 16) {
    results.push({
      key: 'JWT_SECRET',
      name: 'Chave de Assinatura de Tokens JWT',
      status: 'warning',
      configured: true,
      message: 'Chave curta (< 16 caracteres). Defina uma chave mais longa e segura para produção.',
    });
  } else {
    results.push({
      key: 'JWT_SECRET',
      name: 'Chave de Assinatura de Tokens JWT',
      status: 'valid',
      configured: true,
      message: 'Chave JWT personalizada e segura configurada com sucesso.',
    });
  }

  // 4. Validate ENCRYPTION_KEY
  const encKey = process.env.ENCRYPTION_KEY;
  results.push({
    key: 'ENCRYPTION_KEY',
    name: 'Chave de Criptografia de Dados Sensíveis',
    status: encKey ? 'valid' : 'missing',
    configured: !!encKey,
    message: encKey ? 'Chave de criptografia de dados definida.' : 'Chave não configurada. Recomendada para criptografia de dados sensíveis.',
  });

  // 5. Validate Supabase Keys
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    results.push({
      key: 'VITE_SUPABASE_URL & ANON_KEY',
      name: 'Integração Supabase',
      status: 'valid',
      configured: true,
      message: 'Configurações de URL e chave do Supabase presentes no ambiente.',
    });
  } else {
    results.push({
      key: 'VITE_SUPABASE_URL',
      name: 'Integração Supabase',
      status: 'optional',
      configured: false,
      message: 'Opcional. Não configurado no ambiente.',
    });
  }

  const durationMs = Date.now() - startTime;
  const totalConfigured = results.filter(r => r.configured).length;
  const totalValid = results.filter(r => r.status === 'valid').length;

  res.json({
    timestamp: new Date().toISOString(),
    latencyMs: durationMs,
    summary: {
      totalKeysTested: results.length,
      configuredKeys: totalConfigured,
      validKeys: totalValid,
      allValid: results.every(r => r.status === 'valid' || r.status === 'optional' || r.status === 'fallback')
    },
    keys: results
  });
});




// =====================================
// Cron Service for Reminders
// =====================================
app.post("/api/cron/reminders", async (req: any, res: any) => {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // Autorizado via secret header
  } else {
    // Verifica se o usuário é admin autenticado
    let token = req.cookies.token;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    if (token) {
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        if (decoded?.role !== 'admin') {
          return res.status(403).json({ error: 'Acesso negado: Requer privilégios de administrador ou CRON_SECRET.' });
        }
      } catch {
        return res.status(401).json({ error: 'Não autorizado' });
      }
    } else {
      return res.status(401).json({ error: 'Não autorizado. Forneça o header de autorização com CRON_SECRET ou token de administrador.' });
    }
  }

  try {
    // BRT, não UTC — evita disparar/perder lembretes de agendamentos "de hoje" entre 21h-23h59 (Brasília)
    const todayStr = getTodayStringBRT();
    const upcoming = await db.query.appointments.findMany({
      where: eq(schema.appointments.date, todayStr)
    });
    let sentCount = 0;
    for (const apt of upcoming) {
      if (!apt.clientPhone || ['cancelled', 'no_show'].includes(apt.status)) continue;
      const deliveryKey = `appointment-reminder:${apt.id}:${todayStr}`;
      const [claimed] = await db.insert(schema.notificationDeliveries).values({
        id: `nd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        appointmentId: apt.id,
        kind: 'appointment_reminder',
        channel: 'whatsapp',
        deliveryKey,
        sentAt: new Date(),
      }).onConflictDoNothing().returning({ id: schema.notificationDeliveries.id });
      if (!claimed) continue;
      try {
        await sendWhatsAppMessage(apt.clientPhone, `Lembrete Barbearia: Você possui um agendamento hoje às ${apt.timeSlot}.`);
        sentCount++;
      } catch (sendError) {
        await db.delete(schema.notificationDeliveries).where(eq(schema.notificationDeliveries.id, claimed.id)).catch(() => {});
        console.error('[CRON] Falha ao enviar lembrete:', sendError);
      }
    }
    return res.json({ success: true, processed: upcoming.length, sentCount });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

// =====================================================================
// NAVO REWARDS ENGINE & API
// =====================================================================

let loyaltyConfig = normalizeLoyaltyConfig(DEFAULT_LOYALTY_CONFIG);
const mergeLoyaltyConfig = (_base: any, incoming: any = {}) => normalizeLoyaltyConfig(incoming);
const loyaltyConfigPayloadSchema = z.object({
  currencyPerPoint: z.coerce.number().min(0.01).max(100000).optional(),
  pointsValidityDays: z.coerce.number().int().min(0).max(3650).optional(),
  tierMultipliers: z.record(z.string(), z.coerce.number().min(0.1).max(20)).optional(),
  referralPoints: z.object({
    referrerBonus: z.coerce.number().int().min(0).max(100000000).optional(),
    referredBonus: z.coerce.number().int().min(0).max(100000000).optional(),
    milestoneCount: z.coerce.number().int().min(1).max(100000).optional(),
    milestoneBonus: z.coerce.number().int().min(0).max(100000000).optional(),
  }).partial().optional(),
  reviewPoints: z.object({
    baseReview: z.coerce.number().int().min(0).max(100000000).optional(),
    withPhotoBonus: z.coerce.number().int().min(0).max(100000000).optional(),
    fiveStarBonus: z.coerce.number().int().min(0).max(100000000).optional(),
  }).partial().optional(),
  birthdayBonus: z.coerce.number().int().min(0).max(100000000).optional(),
}).strict();

app.get("/api/loyalty/config", async (_req: any, res: any) => {
  try {
    if (isDbConnected && db) {
      const saved = await db.query.loyaltySettings.findFirst({ where: eq(schema.loyaltySettings.id, 'default') });
      if (saved?.config && typeof saved.config === 'object') {
        loyaltyConfig = mergeLoyaltyConfig(loyaltyConfig, saved.config);
      }
    }
    res.json(loyaltyConfig);
  } catch (e: any) {
    return handleError(res, e, '/api/loyalty/config');
  }
});

app.post("/api/loyalty/config", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const parsed = loyaltyConfigPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Configuração de fidelidade inválida.', details: parsed.error.flatten() });
    }
    loyaltyConfig = mergeLoyaltyConfig(loyaltyConfig, parsed.data);
    if (!isDbConnected || !db) return res.status(503).json({ error: userErrors.dbDisconnected });
    await db.insert(schema.loyaltySettings)
      .values({ id: 'default', config: loyaltyConfig, updatedAt: new Date() })
      .onConflictDoUpdate({ target: schema.loyaltySettings.id, set: { config: loyaltyConfig, updatedAt: new Date() } });
    res.json({ success: true, config: loyaltyConfig, message: 'Configurações de fidelidade salvas com sucesso!' });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

// =====================================================================
// SHOP PROFILE & SETTINGS ENDPOINTS
// =====================================================================

const DEFAULT_SHOP_PROFILE = {
  id: 'default',
  name: 'Navo Barber & Club',
  unitName: 'Unidade Expectativa',
  slogan: 'Estilo, Tradição e Excelência na Medida Certa',
  address: 'Rua Fortaleza, 1420 - Expectativa, Sobral - CE',
  phone: '(11) 99999-8888',
  whatsapp: '5511999998888',
  openTime: '09:00',
  closeTime: '20:00',
  operatingDays: [1, 2, 3, 4, 5, 6],
  operatingSchedule: {
    monday: { active: true, open: '09:00', close: '20:00' },
    tuesday: { active: true, open: '09:00', close: '20:00' },
    wednesday: { active: true, open: '09:00', close: '20:00' },
    thursday: { active: true, open: '09:00', close: '20:00' },
    friday: { active: true, open: '09:00', close: '21:00' },
    saturday: { active: true, open: '09:00', close: '20:00' },
    sunday: { active: false, open: '10:00', close: '16:00' }
  },
  mapsUrl: 'https://maps.google.com/?q=Rua+Fortaleza+1420+Expectativa+Sobral+CE',
  instagram: '@barbearianavo',
  logoUrl: '',
  description: 'Barbearia premium com foco em experiência do cliente, cortes modernos e tradicionais.',
  allowOutsideHoursApproval: false
};

const PUBLIC_PROFILE_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400';
const profileTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido. Use HH:mm.');
const profileScheduleDaySchema = z.object({
  active: z.boolean(),
  open: profileTimeSchema,
  close: profileTimeSchema,
}).refine((value) => value.active ? value.open < value.close : true, {
  message: 'O horário de abertura deve ser anterior ao fechamento.',
  path: ['close'],
});
const profilePayloadSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  unitName: z.string().trim().min(1).max(120).optional(),
  slogan: z.string().trim().max(300).optional(),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(30).optional(),
  whatsapp: z.string().trim().max(30).optional(),
  openTime: profileTimeSchema.optional(),
  closeTime: profileTimeSchema.optional(),
  operatingDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  operatingSchedule: z.object({
    sunday: profileScheduleDaySchema,
    monday: profileScheduleDaySchema,
    tuesday: profileScheduleDaySchema,
    wednesday: profileScheduleDaySchema,
    thursday: profileScheduleDaySchema,
    friday: profileScheduleDaySchema,
    saturday: profileScheduleDaySchema,
  }).partial().optional(),
  mapsUrl: z.string().url().max(2000).optional(),
  instagram: z.string().trim().max(120).optional(),
  logoUrl: z.string().max(10000000).nullable().optional(),
  description: z.string().trim().max(2000).optional(),
  allowOutsideHoursApproval: z.boolean().optional(),
});

function publicLogoUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return '';
  return value.startsWith('data:image/') ? '/api/shop-profile/logo' : value;
}

app.get("/api/shop-profile/logo", async (_req: any, res: any) => {
  try {
    if (!isDbConnected || !db) return res.status(404).end();

    const rows = await db.select({ logoUrl: schema.shopSettings.logoUrl })
      .from(schema.shopSettings)
      .where(eq(schema.shopSettings.id, 'default'));
    const logoUrl = rows[0]?.logoUrl;

    if (typeof logoUrl !== 'string' || logoUrl.length === 0) {
      return res.status(404).end();
    }

    if (!logoUrl.startsWith('data:')) {
      return res.redirect(302, logoUrl);
    }

    const match = logoUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(404).end();

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400');
    res.setHeader('Content-Type', match[1]);
    return res.send(Buffer.from(match[2], 'base64'));
  } catch (error) {
    console.error('[API] Falha ao servir o logo público:', error);
    return res.status(404).end();
  }
});

app.get("/api/shop-profile", async (_req: any, res: any) => {
  res.setHeader('Cache-Control', PUBLIC_PROFILE_CACHE_CONTROL);
  try {
    if (isDbConnected && db) {
      const rows = await db.select().from(schema.shopSettings).where(eq(schema.shopSettings.id, 'default'));
      if (rows.length) {
        const row = rows[0];
        return res.json({
          id: row.id, name: row.name, unitName: row.unitName, slogan: row.slogan,
          address: row.address, phone: row.phone, whatsapp: row.whatsapp,
          openTime: row.openTime, closeTime: row.closeTime,
          operatingDays: row.operatingDays, operatingSchedule: row.operatingSchedule,
          mapsUrl: row.mapsUrl, instagram: row.instagram, logoUrl: publicLogoUrl(row.logoUrl),
          description: row.description, allowOutsideHoursApproval: !!row.allowOutsideHoursApproval
        });
      }
    }
    return res.json(DEFAULT_SHOP_PROFILE);
  } catch (e: any) {
    return res.json(DEFAULT_SHOP_PROFILE);
  }
});

app.post("/api/shop-profile", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    if (!isDbConnected || !db) return res.status(503).json({ error: userErrors.dbDisconnected });

    const parsed = profilePayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados do perfil ou horários inválidos.', details: parsed.error.flatten() });
    }

    const current = await db.query.shopSettings.findFirst({ where: eq(schema.shopSettings.id, 'default') });
    const input = parsed.data;
    const currentSchedule = current?.operatingSchedule && typeof current.operatingSchedule === 'object'
      ? current.operatingSchedule as Record<string, any>
      : DEFAULT_SHOP_PROFILE.operatingSchedule;
    const operatingSchedule = {
      ...DEFAULT_SHOP_PROFILE.operatingSchedule,
      ...currentSchedule,
      ...(input.operatingSchedule || {}),
    };
    const scheduleKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const operatingDays = input.operatingDays ?? scheduleKeys.reduce<number[]>((days, key, index) => {
      if (operatingSchedule[key]?.active) days.push(index);
      return days;
    }, []);
    const values = {
      id: 'default',
      name: input.name ?? current?.name ?? DEFAULT_SHOP_PROFILE.name,
      unitName: input.unitName ?? current?.unitName ?? DEFAULT_SHOP_PROFILE.unitName,
      slogan: input.slogan ?? current?.slogan ?? DEFAULT_SHOP_PROFILE.slogan,
      address: input.address ?? current?.address ?? DEFAULT_SHOP_PROFILE.address,
      phone: input.phone ?? current?.phone ?? DEFAULT_SHOP_PROFILE.phone,
      whatsapp: input.whatsapp ?? current?.whatsapp ?? DEFAULT_SHOP_PROFILE.whatsapp,
      openTime: input.openTime ?? current?.openTime ?? DEFAULT_SHOP_PROFILE.openTime,
      closeTime: input.closeTime ?? current?.closeTime ?? DEFAULT_SHOP_PROFILE.closeTime,
      operatingDays,
      operatingSchedule,
      mapsUrl: input.mapsUrl ?? current?.mapsUrl ?? DEFAULT_SHOP_PROFILE.mapsUrl,
      instagram: input.instagram ?? current?.instagram ?? DEFAULT_SHOP_PROFILE.instagram,
      logoUrl: input.logoUrl !== undefined ? input.logoUrl : (current?.logoUrl ?? null),
      description: input.description ?? current?.description ?? DEFAULT_SHOP_PROFILE.description,
      allowOutsideHoursApproval: input.allowOutsideHoursApproval ?? current?.allowOutsideHoursApproval ?? DEFAULT_SHOP_PROFILE.allowOutsideHoursApproval,
      themePalette: current?.themePalette ?? 'heritage',
      updatedAt: new Date(),
    };
    const [saved] = await db.insert(schema.shopSettings)
      .values(values)
      .onConflictDoUpdate({
        target: schema.shopSettings.id,
        set: {
          name: values.name,
          unitName: values.unitName,
          slogan: values.slogan,
          address: values.address,
          phone: values.phone,
          whatsapp: values.whatsapp,
          openTime: values.openTime,
          closeTime: values.closeTime,
          operatingDays: values.operatingDays,
          operatingSchedule: values.operatingSchedule,
          mapsUrl: values.mapsUrl,
          instagram: values.instagram,
          logoUrl: values.logoUrl,
          description: values.description,
          allowOutsideHoursApproval: values.allowOutsideHoursApproval,
          themePalette: values.themePalette,
          updatedAt: values.updatedAt,
        },
      })
      .returning();

    invalidateAvailabilityCache();
    return res.json({ profile: { ...saved, logoUrl: publicLogoUrl(saved.logoUrl) } });
  } catch (e: any) {
    return handleError(res, e, 'POST /api/shop-profile');
  }
});

// Fallback for missing API routes to ensure JSON response
app.use('/api', (req: any, res: any) => {
  res.status(404).json({ error: `Endpoint não encontrado: ${req.method} ${req.originalUrl}` });
});

export default app;
