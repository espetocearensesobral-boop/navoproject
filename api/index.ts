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

if (!process.env.DATABASE_URL && !process.env.SQL_HOST) {
  console.warn("NOTICE: DATABASE_URL or SQL_HOST not defined. Ensure Supabase credentials are configured.");
}

app.use(validateOrigin);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: false, frameguard: { action: 'deny' } }));
app.use("/api/", apiLimiter);
app.use("/api", async (req, res, next) => {
  // Rotas públicas que não precisam de banco ou possuem dados de fallback
  const publicRoutes = [
    '/whatsapp/status',
    '/services',
    '/professionals',
    '/shop-profile',
    '/products',
    '/rewards',
    '/availability',
    '/loyalty/config',
    '/reviews/public'
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
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));
app.use(cookieParser());

// JSON malformado no corpo da requisição: resposta JSON uniforme,
// em vez da página HTML de erro padrão do Express.
app.use((err: any, req: any, res: any, next: any) => {
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Corpo da requisição em formato inválido.' });
  }
  next(err);
});




// =====================================================================
// INICIALIZAÇÃO DO BANCO DE DADOS SUPABASE COM RETRY
// =====================================================================
export let db: any = null;
export let isDbConnected = false;
export let dbInitAttempts = 0;
export const MAX_INIT_ATTEMPTS = 2;

async function initializeDb(): Promise<void> {
  try {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      db = null;
      isDbConnected = false;
      console.error('[API] ❌ DATABASE_URL não foi configurada no ambiente.');
      return;
    }

    if (!connectionString.startsWith('postgres://') && !connectionString.startsWith('postgresql://')) {
      db = null;
      isDbConnected = false;
      console.error('[API] ❌ DATABASE_URL possui formato inválido.');
      return;
    }

    const queryClient = postgres(connectionString, { 
      max: 10, 
      // 'require' habilita TLS e mantém a verificação do certificado do servidor,
      // evitando exposição a ataques man-in-the-middle na conexão com o banco.
      ssl: connectionString.includes('supabase') ? 'require' : undefined,
      connect_timeout: 10,
    });
    
    await queryClient`SELECT 1`;
    db = drizzle(queryClient, { schema });
    isDbConnected = true;
    dbInitAttempts = 0;
    console.log('[API] ✅ Conectado ao Banco de Dados Supabase com sucesso.');

    try {
      await queryClient`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_code text;`;
      await queryClient`
        CREATE TABLE IF NOT EXISTS schedule_blocks (
          id text PRIMARY KEY,
          professional_id text NOT NULL,
          date text NOT NULL,
          start_time text NOT NULL,
          end_time text NOT NULL,
          reason text,
          created_at timestamp DEFAULT now() NOT NULL
        );
      `;
      await queryClient`
        CREATE TABLE IF NOT EXISTS cash_transactions (
          id text PRIMARY KEY,
          type text NOT NULL,
          description text NOT NULL,
          amount numeric(10, 2) NOT NULL,
          category text NOT NULL,
          payment_method text NOT NULL,
          date text NOT NULL,
          status text NOT NULL DEFAULT 'completed',
          professional_name text,
          notes text,
          created_at timestamp DEFAULT now() NOT NULL
        );
      `;
      await queryClient`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text;`;
      await queryClient`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by text;`;
      await queryClient`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday text;`;
      await queryClient`
        CREATE TABLE IF NOT EXISTS point_transactions (
          id text PRIMARY KEY,
          client_id text NOT NULL,
          amount integer NOT NULL,
          type text NOT NULL,
          description text NOT NULL,
          created_at timestamp DEFAULT now() NOT NULL
        );
      `;
      await queryClient`
        CREATE TABLE IF NOT EXISTS referrals (
          id text PRIMARY KEY,
          referrer_id text NOT NULL,
          referred_id text NOT NULL,
          status text NOT NULL DEFAULT 'pending',
          points_awarded integer NOT NULL DEFAULT 0,
          created_at timestamp DEFAULT now() NOT NULL
        );
      `;
      await queryClient`
        CREATE TABLE IF NOT EXISTS rewards (
          id text PRIMARY KEY,
          title text NOT NULL,
          points_required integer NOT NULL,
          reward_type text NOT NULL,
          value_description text NOT NULL,
          icon text,
          is_active boolean NOT NULL DEFAULT true,
          created_at timestamp DEFAULT now() NOT NULL
        );
      `;
      await queryClient`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS client_id text;`;
      await queryClient`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS understood_request text;`;
      await queryClient`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS wait_time_acceptable text;`;
      await queryClient`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS would_recommend text;`;
      await queryClient`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS has_photo boolean DEFAULT false;`;
      await queryClient`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS photo_url text;`;
      await queryClient`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS points_awarded integer DEFAULT 0;`;
      await queryClient`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS admin_response text;`;
      await queryClient`
        CREATE TABLE IF NOT EXISTS shop_settings (
          id text PRIMARY KEY DEFAULT 'default',
          name text NOT NULL DEFAULT 'Navo Barber & Club',
          unit_name text NOT NULL DEFAULT 'Unidade Jardins',
          slogan text NOT NULL DEFAULT 'Estilo, Tradição e Excelência na Medida Certa',
          address text NOT NULL DEFAULT 'Rua Augusta, 1420 - Jardins, São Paulo - SP',
          phone text NOT NULL DEFAULT '(11) 99999-8888',
          whatsapp text NOT NULL DEFAULT '5511999998888',
          open_time text NOT NULL DEFAULT '09:00',
          close_time text NOT NULL DEFAULT '20:00',
          operating_days jsonb NOT NULL DEFAULT '[1,2,3,4,5,6]'::jsonb,
          operating_schedule jsonb NOT NULL DEFAULT '{"sunday":{"active":false,"open":"10:00","close":"16:00"},"monday":{"active":true,"open":"09:00","close":"20:00"},"tuesday":{"active":true,"open":"09:00","close":"20:00"},"wednesday":{"active":true,"open":"09:00","close":"20:00"},"thursday":{"active":true,"open":"09:00","close":"20:00"},"friday":{"active":true,"open":"09:00","close":"21:00"},"saturday":{"active":true,"open":"09:00","close":"20:00"}}'::jsonb,
          maps_url text DEFAULT 'https://maps.google.com/?q=Rua+Augusta+1420+Jardins+Sao+Paulo',
          instagram text DEFAULT '@barbearianavo',
          logo_url text,
          description text DEFAULT 'Barbearia premium com foco em experiência do cliente, cortes modernos e tradicionais.',
          updated_at timestamp DEFAULT NOW()
        );
      `;

      // Auto-seed inicial se a tabela de serviços estiver vazia no Supabase
      try {
        const servicesCount = await queryClient`SELECT count(*)::int FROM services;`;
        if (servicesCount && servicesCount[0] && Number(servicesCount[0].count) === 0) {
          console.log('[API] 📦 Tabela de serviços vazia no Supabase.');
          // Auto-seed removed from initialization, please call /api/seed route explicitly.
        }
      } catch (seedErr: any) {
        console.warn('[API] Aviso ao verificar auto-seed:', seedErr.message);
      }
    } catch (migErr: any) {
      console.warn('[API] Aviso na migração de tabelas:', migErr.message);
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

const dbReadyPromise = initializeDb();

// Middleware de verificação de conexão com o banco de dados
app.use(async (req: any, res: any, next: any) => {
  if (!req.path.startsWith('/api')) {
    return next();
  }

  await dbReadyPromise.catch(() => {});

  if (req.path === '/api/health' || req.path === '/api/whatsapp/status') {
    return next();
  }

  if (!isDbConnected || !db) {
    return res.status(503).json({
      error: 'Serviço temporariamente indisponível',
      message: 'Não foi possível comunicar com o banco de dados Supabase. Por favor, verifique sua conexão e tente novamente.',
      code: 'DATABASE_UNAVAILABLE'
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
app.get("/api/shop-profile", async (req: any, res: any) => {
  try {
    const rows = await db.select().from(schema.shopSettings).where(eq(schema.shopSettings.id, 'default'));
    if (!rows.length) return res.status(404).json({ error: 'Perfil da barbearia não cadastrado no banco de dados.' });
    const row = rows[0];
    res.json({
      id: row.id, name: row.name, unitName: row.unitName, slogan: row.slogan,
      address: row.address, phone: row.phone, whatsapp: row.whatsapp,
      openTime: row.openTime, closeTime: row.closeTime,
      operatingDays: row.operatingDays, operatingSchedule: row.operatingSchedule,
      mapsUrl: row.mapsUrl, instagram: row.instagram, logoUrl: row.logoUrl || '',
      description: row.description, allowOutsideHoursApproval: !!row.allowOutsideHoursApproval
    });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

app.post("/api/shop-profile", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const data = req.body;
    const existing = await db.select().from(schema.shopSettings).where(eq(schema.shopSettings.id, 'default'));
    const existingRow = existing[0];

    // Mescla o operatingSchedule recebido com o existente em vez de sobrescrever
    // o JSON inteiro — evita apagar dias que o client não enviou.
    const mergedSchedule: Record<string, any> = {
      ...(existingRow?.operatingSchedule || {}),
      ...(data.operatingSchedule || {})
    };

    // Garante que as 7 chaves existem (fallback seguro pra qualquer dia ausente)
    for (const key of DAY_KEYS) {
      if (!mergedSchedule[key]) {
        mergedSchedule[key] = { active: true, open: '09:00', close: '20:00' };
      }
    }

    // Valida open < close pra cada dia ativo (evita configuração invertida que
    // resulta silenciosamente em zero horários disponíveis)
    const invalidDays: string[] = [];
    for (const key of DAY_KEYS) {
      const sch = mergedSchedule[key];
      if (sch && sch.active) {
        const openM = timeToMinutes(sch.open);
        const closeM = timeToMinutes(sch.close);
        if (!(openM < closeM)) {
          invalidDays.push(key);
        }
      }
    }
    if (invalidDays.length > 0) {
      return res.status(400).json({
        error: `Horário de abertura deve ser antes do horário de fechamento para: ${invalidDays.join(', ')}.`,
        invalidDays
      });
    }

    const globalOpen = data.openTime !== undefined ? data.openTime : existingRow?.openTime;
    const globalClose = data.closeTime !== undefined ? data.closeTime : existingRow?.closeTime;
    if (globalOpen && globalClose && !(timeToMinutes(globalOpen) < timeToMinutes(globalClose))) {
      return res.status(400).json({ error: 'Horário de abertura padrão deve ser antes do horário de fechamento.' });
    }

    const payload = {
      id: 'default', name: data.name, unitName: data.unitName, slogan: data.slogan,
      address: data.address, phone: data.phone, whatsapp: data.whatsapp,
      openTime: globalOpen, closeTime: globalClose,
      operatingDays: data.operatingDays !== undefined ? data.operatingDays : existingRow?.operatingDays,
      operatingSchedule: mergedSchedule,
      mapsUrl: data.mapsUrl || '', instagram: data.instagram || '',
      logoUrl: data.logoUrl || '', description: data.description || '',
      allowOutsideHoursApproval: data.allowOutsideHoursApproval !== undefined
        ? !!data.allowOutsideHoursApproval
        : !!existingRow?.allowOutsideHoursApproval,
      updatedAt: new Date()
    };

    if (existingRow) {
      await db.update(schema.shopSettings).set(payload).where(eq(schema.shopSettings.id, 'default'));
    } else {
      await db.insert(schema.shopSettings).values(payload);
    }
    const [saved] = await db.select().from(schema.shopSettings).where(eq(schema.shopSettings.id, 'default'));
    res.json({ success: true, profile: saved, message: 'Perfil da barbearia atualizado com sucesso!' });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});


function calculateTier(points: number): 'Bronze' | 'Prata' | 'Ouro' | 'Diamante' {
  if (points >= 6000) return 'Diamante';
  if (points >= 3000) return 'Ouro';
  if (points >= 1000) return 'Prata';
  return 'Bronze';
}

async function awardPoints(clientId: string, points: number, type: string, description: string) {
  if (!clientId || clientId === 'usr_guest' || points === 0 || !db) return null;
  try {
    const user = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, clientId) });
    if (!user) return null;

    const currentPoints = Number(user.loyaltyPoints || 0);
    const newPoints = Math.max(0, currentPoints + points);
    const newTier = calculateTier(newPoints);

    await db.update(schema.profiles)
      .set({ loyaltyPoints: newPoints, loyaltyTier: newTier, updatedAt: new Date() })
      .where(eq(schema.profiles.id, clientId));

    const txId = `pt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    await db.insert(schema.pointTransactions).values({
      id: txId,
      clientId,
      amount: points,
      type,
      description,
      createdAt: new Date()
    });

    return { newPoints, newTier };
  } catch (e: any) {
    console.error('[Navo Rewards] Error awarding points:', e);
    return null;
  }
}

export async function processAppointmentCompletion(appointment: any) {
  if (!appointment || !appointment.clientId || appointment.clientId === 'usr_guest') return;

  const amount = Number(appointment.finalAmount || appointment.originalAmount || 0);
  if (amount <= 0) return;

  let tier: 'Bronze' | 'Prata' | 'Ouro' | 'Diamante' = 'Bronze';
  const clientUser = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, appointment.clientId) });
  if (clientUser && clientUser.loyaltyTier) {
    tier = clientUser.loyaltyTier as any;
  }

  const basePts = Math.round(amount / (loyaltyConfig.currencyPerPoint || 1.0));
  const mult = loyaltyConfig.tierMultipliers[tier] || 1.0;
  const pointsEarned = Math.round(basePts * mult);
  
  await awardPoints(
    appointment.clientId,
    pointsEarned,
    'purchase',
    `Pontos do atendimento em ${appointment.date} (R$ ${amount.toFixed(2)} - Multiplicador ${tier} ${mult}x)`
  );

  try {
    const completions = await db.query.appointments.findMany({
      where: (apt: any, { and, eq }: any) => and(
        eq(apt.clientId, appointment.clientId),
        eq(apt.status, 'completed')
      )
    });

    if (completions.length === 1) {
      const client = clientUser || await db.query.profiles.findFirst({
        where: eq(schema.profiles.id, appointment.clientId)
      });

      if (client && client.referredBy) {
        const referral = await db.query.referrals.findFirst({
          where: (ref: any, { and, eq }: any) => and(
            eq(ref.referrerId, client.referredBy),
            eq(ref.referredId, client.id),
            eq(ref.status, 'pending')
          )
        });

        if (referral) {
          const referrerPts = loyaltyConfig.referralPoints.referrerBonus || 100;
          const referredPts = loyaltyConfig.referralPoints.referredBonus || 50;

          await awardPoints(
            client.referredBy,
            referrerPts,
            'referral',
            `Indicação realizada com sucesso: ${client.name} fez o 1º corte (+${referrerPts} pts)`
          );

          await awardPoints(
            client.id,
            referredPts,
            'referral',
            `Bônus de Boas-Vindas por Indicação (+${referredPts} pts)`
          );

          await db.update(schema.referrals)
            .set({ status: 'completed', pointsAwarded: referrerPts })
            .where(eq(schema.referrals.id, referral.id));

          const completedRefs = await db.query.referrals.findMany({
            where: (ref: any, { and, eq }: any) => and(
              eq(ref.referrerId, client.referredBy),
              eq(ref.status, 'completed')
            )
          });

          const mCount = loyaltyConfig.referralPoints.milestoneCount || 5;
          const mBonus = loyaltyConfig.referralPoints.milestoneBonus || 1000;

          if (completedRefs.length === mCount) {
            await awardPoints(
              client.referredBy,
              mBonus,
              'bonus',
              `Bônus Super Embaixador Navo: ${mCount} indicações concluídas! (+${mBonus} pts)`
            );
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[Navo Rewards] Error processing referral bonus:', err);
  }
}

const DEFAULT_REWARDS = [
  {
    id: 'rw_500',
    title: 'Upgrade VIP de Experiência',
    pointsRequired: 500,
    rewardType: 'upgrade',
    valueDescription: 'Corte + Barba ganham Hidratação Capilar e Toalha Quente grátis',
    icon: 'Sparkles',
    isActive: true
  },
  {
    id: 'rw_1000',
    title: 'Produto Premium Grátis',
    pointsRequired: 1000,
    rewardType: 'product',
    valueDescription: 'Pomada Modeladora Efeito Matte Extra Forte (R$ 60,00)',
    icon: 'Package',
    isActive: true
  },
  {
    id: 'rw_2000',
    title: 'Corte Tradicional Grátis',
    pointsRequired: 2000,
    rewardType: 'free_cut',
    valueDescription: '1 Corte de Cabelo Completo totalmente grátis (1x por mês)',
    icon: 'Scissors',
    isActive: true
  },
  {
    id: 'rw_5000',
    title: 'Status Cliente VIP Navo',
    pointsRequired: 5000,
    rewardType: 'vip_status',
    valueDescription: 'Status permanente + Prioridade total na fila + 10% OFF em tudo',
    icon: 'Crown',
    isActive: true
  }
];

app.get("/api/rewards", async (req: any, res: any) => {
  try {
    let list = await db.query.rewards.findMany({ where: eq(schema.rewards.isActive, true) });
    if (list.length === 0) {
      for (const r of DEFAULT_REWARDS) {
        await db.insert(schema.rewards).values(r).onConflictDoNothing();
      }
      list = DEFAULT_REWARDS;
    }
    res.json(list);
  } catch (e: any) {
    res.json(DEFAULT_REWARDS);
  }
});

app.get("/api/loyalty/me", optionalAuth, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId || userId === 'usr_guest') {
      return res.json({
        loyaltyPoints: 0,
        loyaltyTier: 'Bronze',
        referralCode: 'NAV-GUEST',
        transactions: [],
        pendingReviews: [],
        referralStats: { totalInvited: 0, completedCount: 0, pointsEarned: 0 }
      });
    }

    let user = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, userId) });
    if (!user) {
      return res.json({
        loyaltyPoints: 0,
        loyaltyTier: 'Bronze',
        referralCode: 'NAV-CLIENT',
        transactions: [],
        pendingReviews: [],
        referralStats: { totalInvited: 0, completedCount: 0, pointsEarned: 0 }
      });
    }

    if (!user.referralCode) {
      const cleanName = (user.name || 'CLIENTE').split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
      const code = `NAV-${cleanName}${Math.floor(100 + Math.random() * 900)}`;
      await db.update(schema.profiles).set({ referralCode: code }).where(eq(schema.profiles.id, userId));
      user.referralCode = code;
    }

    const txs = await db.query.pointTransactions.findMany({
      where: eq(schema.pointTransactions.clientId, userId),
      orderBy: [desc(schema.pointTransactions.createdAt)]
    });

    const pendingApts = await db.query.appointments.findMany({
      where: (apt: any, { and, eq }: any) => and(
        eq(apt.clientId, userId),
        eq(apt.status, 'completed'),
        eq(apt.isReviewed, false)
      )
    });

    const userReferrals = await db.query.referrals.findMany({
      where: eq(schema.referrals.referrerId, userId)
    });

    const completedRefs = userReferrals.filter((r: any) => r.status === 'completed');
    const referralPoints = userReferrals.reduce((acc: number, r: any) => acc + (r.pointsAwarded || 0), 0);

    res.json({
      loyaltyPoints: user.loyaltyPoints || 0,
      loyaltyTier: user.loyaltyTier || calculateTier(user.loyaltyPoints || 0),
      referralCode: user.referralCode,
      birthday: user.birthday || null,
      transactions: txs,
      pendingReviews: pendingApts,
      referralStats: {
        totalInvited: userReferrals.length,
        completedCount: completedRefs.length,
        pointsEarned: referralPoints
      }
    });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.post("/api/loyalty/redeem", optionalAuth, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId || userId === 'usr_guest') {
      return res.status(401).json({ error: 'Faça login para resgatar recompensas.' });
    }

    const { rewardId } = req.body;
    let reward = await db.query.rewards.findFirst({ where: eq(schema.rewards.id, rewardId) });
    if (!reward) {
      reward = DEFAULT_REWARDS.find(r => r.id === rewardId);
    }
    if (!reward) {
      return res.status(404).json({ error: 'Recompensa não encontrada.' });
    }

    const user = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, userId) });
    if (!user || (user.loyaltyPoints || 0) < reward.pointsRequired) {
      return res.status(400).json({ error: `Pontos insuficientes. Você precisa de ${reward.pointsRequired} pontos.` });
    }

    const newPoints = user.loyaltyPoints - reward.pointsRequired;
    await db.update(schema.profiles)
      .set({ loyaltyPoints: newPoints, updatedAt: new Date() })
      .where(eq(schema.profiles.id, userId));

    const redemptionCode = `NAV-RWD-${Math.floor(100000 + Math.random() * 900000)}`;

    await db.insert(schema.pointTransactions).values({
      id: `red_${Date.now()}`,
      clientId: userId,
      amount: -reward.pointsRequired,
      type: 'redemption',
      description: `Resgate: ${reward.title} (Cód: ${redemptionCode})`,
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: 'Recompensa resgatada com sucesso!',
      redemptionCode,
      reward,
      newPoints
    });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.post("/api/loyalty/checkin-instagram", optionalAuth, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId || userId === 'usr_guest') {
      return res.status(401).json({ error: 'Faça login para fazer check-in e ganhar pontos.' });
    }

    const result = await awardPoints(
      userId,
      15,
      'checkin',
      'Check-in de Story no Instagram (@navobarber)'
    );

    res.json({
      success: true,
      pointsAdded: 15,
      newTotal: result?.newPoints || 0,
      message: 'Check-in verificado! +15 pontos adicionados à sua carteira.'
    });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.post("/api/reviews", optionalAuth, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    const {
      appointmentId,
      professionalId,
      rating,
      understoodRequest,
      waitTimeAcceptable,
      wouldRecommend,
      comment,
      hasPhoto,
      photoUrl
    } = req.body;

    if (!rating || !professionalId) {
      return res.status(400).json({ error: 'Classificação e profissional são obrigatórios.' });
    }

    let points = loyaltyConfig.reviewPoints.baseReview || 20;
    if (hasPhoto || photoUrl) points += (loyaltyConfig.reviewPoints.withPhotoBonus || 30);
    if (Number(rating) === 5) points += (loyaltyConfig.reviewPoints.fiveStarBonus || 10);

    const reviewId = `rev_${Date.now()}`;

    await db.insert(schema.reviews).values({
      id: reviewId,
      appointmentId: appointmentId || null,
      clientId: userId !== 'usr_guest' ? userId : null,
      professionalId,
      rating: Number(rating),
      understoodRequest,
      waitTimeAcceptable,
      wouldRecommend,
      comment,
      hasPhoto: Boolean(hasPhoto || photoUrl),
      photoUrl: photoUrl || null,
      pointsAwarded: points,
      createdAt: new Date()
    });

    if (appointmentId) {
      await db.update(schema.appointments)
        .set({ isReviewed: true, updatedAt: new Date() })
        .where(eq(schema.appointments.id, appointmentId));
    }

    let newPointsTotal = 0;
    if (userId && userId !== 'usr_guest') {
      const resPts = await awardPoints(
        userId,
        points,
        'review',
        `Avaliação pós-atendimento (${rating}⭐) (+${points} pts)`
      );
      if (resPts) newPointsTotal = resPts.newPoints;
    }

    res.json({
      success: true,
      pointsAwarded: points,
      newPointsTotal,
      message: `Obrigado por avaliar! Você ganhou +${points} pontos Navo.`
    });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.get("/api/reviews/public", async (req: any, res: any) => {
  try {
    const list = await db.query.reviews.findMany({
      where: eq(schema.reviews.rating, 5),
      orderBy: [desc(schema.reviews.createdAt)],
      limit: 10
    });

    const populated = await Promise.all(list.map(async (r: any) => {
      let clientName = 'Cliente Navo';
      let clientAvatar = null;
      let barberName = 'Barbeiro Navo';

      if (r.clientId) {
        const p = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, r.clientId) });
        if (p) {
          clientName = p.name || clientName;
          clientAvatar = p.avatarUrl;
        }
      }
      if (r.professionalId) {
        const prof = await db.query.professionals.findFirst({ where: eq(schema.professionals.id, r.professionalId) });
        if (prof) barberName = prof.name;
      }

      return {
        id: r.id,
        clientName,
        clientAvatar,
        barberName,
        rating: r.rating,
        comment: r.comment || 'Atendimento impecável, corte e barba perfeitos!',
        photoUrl: r.photoUrl,
        createdAt: r.createdAt
      };
    }));

    res.json(populated);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.get("/api/referrals/my-info", optionalAuth, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId || userId === 'usr_guest') {
      return res.json({
        referralCode: 'NAV-GUEST',
        referralUrl: 'https://navo.com.br/ref/NAV-GUEST',
        friends: [],
        totalPointsEarned: 0
      });
    }

    let user = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, userId) });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    if (!user.referralCode) {
      const cleanName = (user.name || 'CLIENTE').split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
      const code = `NAV-${cleanName}${Math.floor(100 + Math.random() * 900)}`;
      await db.update(schema.profiles).set({ referralCode: code }).where(eq(schema.profiles.id, userId));
      user.referralCode = code;
    }

    const userReferrals = await db.query.referrals.findMany({
      where: eq(schema.referrals.referrerId, userId),
      orderBy: [desc(schema.referrals.createdAt)]
    });

    const populatedFriends = await Promise.all(userReferrals.map(async (r: any) => {
      let friendName = 'Amigo Convidado';
      const friend = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, r.referredId) });
      if (friend) friendName = friend.name;

      return {
        id: r.id,
        name: friendName,
        status: r.status,
        pointsAwarded: r.pointsAwarded,
        date: r.createdAt
      };
    }));

    const totalPointsEarned = userReferrals.reduce((acc: number, r: any) => acc + (r.pointsAwarded || 0), 0);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;

    res.json({
      referralCode: user.referralCode,
      referralUrl: `${protocol}://${host}?ref=${user.referralCode}`,
      friends: populatedFriends,
      totalPointsEarned
    });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.post("/api/referrals/apply-code", optionalAuth, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    const { referralCode } = req.body;

    if (!referralCode) return res.status(400).json({ error: 'Código de indicação é obrigatório.' });

    const referrer = await db.query.profiles.findFirst({
      where: eq(schema.profiles.referralCode, referralCode.trim().toUpperCase())
    });

    if (!referrer) {
      return res.status(404).json({ error: 'Código de indicação não encontrado.' });
    }

    if (userId && userId === referrer.id) {
      return res.status(400).json({ error: 'Você não pode usar seu próprio código de indicação.' });
    }

    if (userId && userId !== 'usr_guest') {
      const existingRef = await db.query.referrals.findFirst({
        where: eq(schema.referrals.referredId, userId)
      });
      if (existingRef) {
        return res.status(400).json({ error: 'Você já utilizou um código de indicação anteriormente.' });
      }

      await db.update(schema.profiles)
        .set({ referredBy: referrer.id })
        .where(eq(schema.profiles.id, userId));

      await db.insert(schema.referrals).values({
        id: `ref_${Date.now()}`,
        referrerId: referrer.id,
        referredId: userId,
        status: 'pending',
        pointsAwarded: 0,
        createdAt: new Date()
      });
    }

    res.json({
      success: true,
      referrerName: referrer.name,
      message: `Código de ${referrer.name} ativado! Ganhe 50 pontos bônus no seu primeiro corte.`
    });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.get("/api/loyalty/admin/dashboard", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const allProfiles = await db.query.profiles.findMany();
    const allTxs = await db.query.pointTransactions.findMany();
    const allReviews = await db.query.reviews.findMany();
    const allReferrals = await db.query.referrals.findMany();

    const tierDistribution = {
      Bronze: allProfiles.filter((p: any) => (p.loyaltyTier || 'Bronze') === 'Bronze').length,
      Prata: allProfiles.filter((p: any) => p.loyaltyTier === 'Prata').length,
      Ouro: allProfiles.filter((p: any) => p.loyaltyTier === 'Ouro').length,
      Diamante: allProfiles.filter((p: any) => p.loyaltyTier === 'Diamante').length,
    };

    const totalIssued = allTxs.filter((t: any) => t.amount > 0).reduce((a: number, t: any) => a + t.amount, 0);
    const totalRedeemed = Math.abs(allTxs.filter((t: any) => t.amount < 0).reduce((a: number, t: any) => a + t.amount, 0));

    const totalRatings = allReviews.length;
    const promoters = allReviews.filter((r: any) => r.rating === 5).length;
    const passives = allReviews.filter((r: any) => r.rating === 4).length;
    const detractors = allReviews.filter((r: any) => r.rating <= 3).length;
    const npsScore = totalRatings > 0 ? Math.round(((promoters - detractors) / totalRatings) * 100) : 100;

    const referrerCounts: Record<string, number> = {};
    allReferrals.forEach((r: any) => {
      referrerCounts[r.referrerId] = (referrerCounts[r.referrerId] || 0) + 1;
    });

    const sortedAmbassadors = Object.entries(referrerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const ambassadorsList = await Promise.all(sortedAmbassadors.map(async ([profId, count]) => {
      const p = allProfiles.find((prof: any) => prof.id === profId);
      return {
        id: profId,
        name: p?.name || 'Cliente Embaixador',
        totalReferrals: count,
        tier: p?.loyaltyTier || 'Bronze',
        points: p?.loyaltyPoints || 0
      };
    }));

    res.json({
      tierDistribution,
      totalIssued,
      totalRedeemed,
      npsScore,
      promoters,
      passives,
      detractors,
      totalReviews: totalRatings,
      ambassadors: ambassadorsList,
      reviewsList: allReviews
    });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.post("/api/loyalty/admin/campaign-inactives", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const clients = await db.query.profiles.findMany({ where: eq(schema.profiles.role, 'client') });
    let rewardedCount = 0;

    for (const c of clients) {
      const pts = await awardPoints(
        c.id,
        100,
        'bonus',
        'Campanha Navo Re-engajamento: +100 pontos para você agendar seu novo corte!'
      );
      if (pts) rewardedCount++;
    }

    res.json({
      success: true,
      rewardedCount,
      message: `Campanha enviada com sucesso! +100 pontos creditados para ${rewardedCount} clientes.`
    });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.post("/api/rewards/admin/create", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const { title, pointsRequired, rewardType, valueDescription, icon } = req.body;
    if (!title || !pointsRequired) {
      return res.status(400).json({ error: 'Título e pontos necessários são obrigatórios.' });
    }

    const rewardId = `rw_${Date.now()}`;
    const newReward = {
      id: rewardId,
      title,
      pointsRequired: Number(pointsRequired),
      rewardType: rewardType || 'upgrade',
      valueDescription: valueDescription || '',
      icon: icon || 'Gift',
      isActive: true
    };

    await db.insert(schema.rewards).values(newReward);
    res.json({ success: true, reward: newReward });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.delete("/api/rewards/admin/:id", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    await db.delete(schema.rewards).where(eq(schema.rewards.id, id));
    res.json({ success: true, message: 'Recompensa removida.' });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.post("/api/loyalty/admin/manual-points", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const { clientId, points, description } = req.body;
    if (!clientId || !points) {
      return res.status(400).json({ error: 'Cliente e pontuação são obrigatórios.' });
    }

    const result = await awardPoints(
      clientId,
      Number(points),
      'manual_adjustment',
      description || `Ajuste manual administrativo (${points > 0 ? '+' : ''}${points} pts)`
    );

    res.json({
      success: true,
      result,
      message: `Pontuação de ${points > 0 ? '+' : ''}${points} pts creditada/debitada com sucesso!`
    });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

// Rota /api/* não reconhecida: resposta JSON uniforme em vez do texto
// padrão do Express ("Cannot GET /api/..."), que expõe detalhes do framework.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Recurso não encontrado.' });
});

export default app;