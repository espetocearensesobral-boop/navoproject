import crypto from 'crypto';
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, or, desc, like, sql } from "drizzle-orm";
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

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: false, frameguard: { action: 'deny' } }));
app.use("/api/", apiLimiter);
app.use("/api", async (req, res, next) => {
  // Rotas públicas que não precisam de banco ou possuem dados de fallback
  const publicRoutes = [
    '/whatsapp/status',
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
import { queueRouter } from './routers/queue.router.js';
import { productsRouter } from './routers/products.router.js';
import { servicesRouter } from './routers/services.router.js';
import { professionalsRouter } from './routers/professionals.router.js';
import { scheduleBlocksRouter } from './routers/schedule-blocks.router.js';
import { cashTransactionsRouter } from './routers/cash-transactions.router.js';
import { availabilityRouter } from './routers/availability.router.js';
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
app.use('/api/queue', queueRouter);
app.use('/api/products', productsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/professionals', professionalsRouter);
app.use('/api/schedule-blocks', scheduleBlocksRouter);
app.use('/api/cash-transactions', cashTransactionsRouter);
app.use('/api/availability', availabilityRouter);
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
const { router: emailRouter, sendEmail } = createEmailModule(() => db, schema, eq);
app.use('/api/email/config', requireAuth, requireAdmin);
app.use('/api/email/test', requireAuth, requireAdmin);
app.use('/api/email', emailRouter);

/** Busca o e-mail do cliente pelo clientId (perfil), sem derrubar o fluxo principal se falhar. */
export async function getClientEmail(clientId: string | undefined | null): Promise<string | null> {
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

/** Busca o e-mail do cliente e dispara o envio, sem nunca lançar (mesmo padrão do sendWhatsAppMessage). */
export async function notifyClientByEmail(clientId: string | undefined | null, apt: any, kind: 'booking' | 'cancel') {
  try {
    const email = await getClientEmail(clientId);
    if (!email) return;
    const { subject, html } = kind === 'booking' ? buildBookingConfirmationEmail(apt) : buildBookingCancellationEmail(apt);
    sendEmail(email, subject, html, undefined, kind).catch(() => {});
  } catch (e) {
    // Nunca deixa uma falha no envio de e-mail derrubar o fluxo principal.
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
    
    let contextText = `Você é o assistente virtual da barbearia BarberX, que atende 24/7.
Seja educado, prestativo e profissional. Responda de forma concisa.
Se um cliente perguntar sobre serviços, mostre o que temos disponível e os preços.
Se quiserem agendar, instrua o cliente a usar o botão "Agendar" na interface.
Você tem acesso aos agendamentos do cliente logado. O nome dele é ${req.user.name || req.user.email}.

Contexto da Barbearia BarberX:
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
      if (apt.clientPhone) {
        await sendWhatsAppMessage(apt.clientPhone, `Lembrete Barbearia: Você possui um agendamento hoje às ${apt.timeSlot}.`);
        sentCount++;
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

let loyaltyConfig = {
  currencyPerPoint: 1.0, // R$ 1.00 = 1 ponto
  pointsValidityDays: 365, // 0 = permanente, >0 = dias
  tierMultipliers: {
    Bronze: 1.0,
    Prata: 1.2,
    Ouro: 1.5,
    Diamante: 2.0
  },
  referralPoints: {
    referrerBonus: 100,
    referredBonus: 50,
    milestoneCount: 5,
    milestoneBonus: 1000
  },
  reviewPoints: {
    baseReview: 20,
    withPhotoBonus: 30,
    fiveStarBonus: 10
  },
  birthdayBonus: 100
};

app.get("/api/loyalty/config", async (req: any, res: any) => {
  res.json(loyaltyConfig);
});

app.post("/api/loyalty/config", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const newCfg = req.body;
    if (newCfg) {
      loyaltyConfig = {
        ...loyaltyConfig,
        ...newCfg,
        tierMultipliers: { ...loyaltyConfig.tierMultipliers, ...newCfg.tierMultipliers },
        referralPoints: { ...loyaltyConfig.referralPoints, ...newCfg.referralPoints },
        reviewPoints: { ...loyaltyConfig.reviewPoints, ...newCfg.reviewPoints }
      };
    }
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
  unitName: 'Unidade Jardins',
  slogan: 'Estilo, Tradição e Excelência na Medida Certa',
  address: 'Rua Augusta, 1420 - Jardins, São Paulo - SP',
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
  mapsUrl: 'https://maps.google.com/?q=Rua+Augusta+1420+Jardins+Sao+Paulo',
  instagram: '@barbearianavo',
  logoUrl: '',
  description: 'Barbearia premium com foco em experiência do cliente, cortes modernos e tradicionais.',
  allowOutsideHoursApproval: false
};

app.get("/api/shop-profile", async (req: any, res: any) => {
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
          mapsUrl: row.mapsUrl, instagram: row.instagram, logoUrl: row.logoUrl || '',
          description: row.description, allowOutsideHoursApproval: !!row.allowOutsideHoursApproval
        });
      }
    }
    return res.json(DEFAULT_SHOP_PROFILE);
  } catch (e: any) {
    return res.json(DEFAULT_SHOP_PROFILE);
  }
});


// Fallback for missing API routes to ensure JSON response
app.use('/api', (req: any, res: any) => {
  res.status(404).json({ error: `Endpoint não encontrado: ${req.method} ${req.originalUrl}` });
});

export default app;
export async function processAppointmentCompletion(appointment: any) {
  if (!appointment || !appointment.clientId || appointment.clientId === 'usr_guest') return;
  try {
    if (isDbConnected && db) {
      const amount = Number(appointment.finalAmount || appointment.originalAmount || 0);
      if (amount > 0) {
        const pointsEarned = Math.round(amount);
        const user = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, appointment.clientId) });
        if (user) {
          const currentPoints = Number(user.loyaltyPoints || 0);
          await db.update(schema.profiles)
            .set({ loyaltyPoints: currentPoints + pointsEarned, updatedAt: new Date() })
            .where(eq(schema.profiles.id, appointment.clientId));
        }
      }
    }
  } catch (e) {
    console.error('Error processing appointment completion:', e);
  }
}
