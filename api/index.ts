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

// =====================================================================
// UTILITÁRIOS DE DATA, HORA E FUSO HORÁRIO (BRT - America/Sao_Paulo)
// Fonte única de verdade para disponibilidade e prevenção de conflitos
// =====================================================================
const TIMEZONE = 'America/Sao_Paulo';

function getTodayStringBRT(): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const result = formatter.format(now);
    if (/^\d{4}-\d{2}-\d{2}$/.test(result)) {
      return result;
    }
  } catch (e) {}

  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const brtTime = new Date(utcTime - (3 * 3600 * 1000));
  const y = brtTime.getUTCFullYear();
  const m = String(brtTime.getUTCMonth() + 1).padStart(2, '0');
  const d = String(brtTime.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCurrentTimeBRT(): { hours: number; minutes: number; timeStr: string; totalMinutes: number } {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    let hours = NaN;
    let minutes = NaN;
    for (const p of parts) {
      if (p.type === 'hour') hours = parseInt(p.value, 10);
      if (p.type === 'minute') minutes = parseInt(p.value, 10);
    }
    if (!isNaN(hours) && !isNaN(minutes)) {
      if (hours === 24) hours = 0;
      return {
        hours,
        minutes,
        timeStr: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
        totalMinutes: hours * 60 + minutes
      };
    }
  } catch (e) {}

  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const brtTime = new Date(utcTime - (3 * 3600 * 1000));
  const hours = brtTime.getUTCHours();
  const minutes = brtTime.getUTCMinutes();
  return {
    hours,
    minutes,
    timeStr: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    totalMinutes: hours * 60 + minutes
  };
}

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return h * 60 + m;
}

function minutesToTime(totalMins: number): string {
  const h = Math.floor(Math.max(0, totalMins) / 60);
  const m = Math.max(0, totalMins) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getDayOfWeekKey(dateStr: string): 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'monday';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayIndex = dateObj.getDay();
  const keys: ('sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday')[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];
  return keys[dayIndex] || 'monday';
}

function checkIntervalOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB;
}

// =====================================================================
// FUNÇÃO UTILITÁRIA: Mensagens amigáveis para o usuário
// =====================================================================
const userErrors = {
  dbDisconnected: 'Serviço temporariamente indisponível. Por favor, tente novamente em alguns instantes.',
  unauthorized: 'Sessão expirada. Faça login novamente.',
  forbidden: 'Você não tem permissão para realizar esta ação.',
  notFound: 'Recurso não encontrado.',
  conflict: 'Conflito de dados. Verifique as informações e tente novamente.',
  validation: 'Dados inválidos. Verifique os campos e tente novamente.',
  generic: 'Ocorreu um erro inesperado. Nossa equipe já foi notificada.',
};

// Helper para tratar erros de forma consistente
const handleError = (res: any, e: any, context: string) => {
  console.error(`[API] Erro em ${context}:`, e);
  
  // Erros conhecidos do Postgres
  const pgErrors: Record<string, { status: number; message: string }> = {
    '23505': { status: 409, message: 'Registro já existe ou conflito de dados.' },
    '23503': { status: 400, message: 'Operação não permitida devido a dependências.' },
    '23502': { status: 400, message: 'Campos obrigatórios não preenchidos.' },
    '22P02': { status: 400, message: 'Formato de dado inválido.' },
  };

  if (e && e.code && pgErrors[e.code]) {
    return res.status(pgErrors[e.code].status).json({ error: pgErrors[e.code].message });
  }

  // Erro genérico
  return res.status(500).json({ error: userErrors.generic });
};

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per windowMs
  message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login/signup requests
  message: { error: 'Muitas tentativas de login. Tente novamente mais tarde.' }
});

const bookingSchema = z.object({
  clientId: z.string().optional(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  professionalId: z.string().optional(),
  professionalName: z.string().optional(),
  date: z.string().optional(),
  timeSlot: z.string().optional(),
  services: z.array(z.any()).optional().default([]),
  paymentMethod: z.string().optional()
}).passthrough();



// Função utilitária para limpar e padronizar telefones
const sanitizePhone = (phone: string | undefined | null): string => {
  if (!phone) return '';
  // 1. Remove tudo que não for dígito
  let clean = phone.replace(/\D/g, '');
  // 2. Se for um número brasileiro válido (10 ou 11 dígitos), adiciona o 55
  if (clean.length === 10 || clean.length === 11) {
    clean = '55' + clean;
  }
  return clean;
};

// Função para gerar código de reserva único
const generateBookingCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'BRX-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Função auxiliar para comparar números de telefone
function matchPhoneNumbers(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false;
  
  const digits1 = phone1.replace(/\D/g, '');
  const digits2 = phone2.replace(/\D/g, '');
  
  if (!digits1 || !digits2) return false;
  if (digits1 === digits2) return true;

  // Normalizar: remover código do país (55)
  let norm1 = digits1;
  if (norm1.length >= 12 && norm1.startsWith('55')) {
    norm1 = norm1.slice(2);
  } else if (norm1.length === 11 && norm1.startsWith('55') && !norm1.startsWith('559')) {
    norm1 = norm1.slice(2);
  }

  let norm2 = digits2;
  if (norm2.length >= 12 && norm2.startsWith('55')) {
    norm2 = norm2.slice(2);
  } else if (norm2.length === 11 && norm2.startsWith('55') && !norm2.startsWith('559')) {
    norm2 = norm2.slice(2);
  }

  if (norm1 === norm2) return true;

  // Se um for de 10 dígitos (sem 9º dígito extra) e o outro de 11 dígitos (com 9º dígito)
  if (Math.abs(norm1.length - norm2.length) === 1 && norm1.length >= 10 && norm2.length >= 10) {
    if (norm1.slice(0, 2) === norm2.slice(0, 2) && norm1.slice(-8) === norm2.slice(-8)) {
      return true;
    }
  }

  // Comparação de sufixos (últimos 8 e 9 dígitos)
  if (norm1.length >= 8 && norm2.length >= 8) {
    if (norm1.slice(-9) === norm2.slice(-9)) return true;
    if (norm1.slice(-8) === norm2.slice(-8)) {
      if (norm1.length <= 9 || norm2.length <= 9) return true;
      if (norm1.slice(0, 2) === norm2.slice(0, 2)) return true;
    }
    if (norm1.endsWith(norm2) || norm2.endsWith(norm1)) return true;
  }
  
  return false;
}

const app = express();
// Express re-adds "X-Powered-By: Express" lazily on every res.send() unless this is
// disabled at the app level — helmet's hidePoweredBy alone isn't enough because it only
// strips the header once, earlier in the middleware chain, before Express sets it again.
app.disable('x-powered-by');
app.set("trust proxy", 1);

app.use((req, res, next) => {
  const allowedOrigins = [
    'https://navopremium.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET environment variable is not defined. Using auto-generated secure key in memory.");
}

if (!process.env.DATABASE_URL && !process.env.SQL_HOST) {
  console.warn("NOTICE: DATABASE_URL or SQL_HOST not defined. Ensure Supabase credentials are configured.");
}

const validateOrigin = (req: any, res: any, next: any) => {
  const origin = req.headers.origin || req.headers.referer || '';
  const host = req.headers.host || '';

  // Para operações sensíveis (POST/PUT/PATCH/DELETE), valida origem
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // Se não houver origin/referer, é chamada interna do mesmo host/backend ou Postman/Mobile
    if (!origin) {
      return next();
    }

    const isAllowedDomain = 
      origin.includes('navopremium.vercel.app') ||
      origin.includes('.vercel.app') ||
      origin.includes('.run.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      (host && origin.includes(host));

    if (!isAllowedDomain) {
      console.warn(`[SECURITY] Blocked request from origin: ${origin}`);
      return res.status(403).json({ error: 'Origem não autorizada' });
    }
  }
  
  next();
};
app.use(validateOrigin);

const sensitiveOpsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas operações sensíveis. Aguarde alguns minutos.' }
});

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: false, frameguard: { action: 'deny' } }));
app.use("/api/", apiLimiter);
app.use("/api", async (req, res, next) => {
  // Rotas públicas que não precisam de banco
  const publicRoutes = ['/whatsapp/status'];
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

const setAuthCookie = (res: any, token: string) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

// =====================================
// CORS CONFIGURATION (ANTES DE TUDO)
// =====================================
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://navopremium.vercel.app',
    'https://www.navopremium.vercel.app',
    'https://navobarber-premium.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token');
    res.setHeader('Access-Control-Expose-Headers', 'X-Auth-Token');
  }
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// Auth Middleware
const requireAuth = async (req: any, res: any, next: any) => {
  let token = null;
  
  // Apenas 2 fontes seguras (removido query param)
  if (req.cookies?.token) {
    token = req.cookies.token;
  }
  else if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Sessão expirada. Faça login novamente.' 
    });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ 
      error: 'Sessão expirada. Faça login novamente.' 
    });
  }
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito apenas para administradores' });
  }
  next();
};

const optionalAuth = (req: any, res: any, next: any) => {
  let token = null;
  if (req.cookies?.token) {
    token = req.cookies.token;
  }
  else if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      req.user = { id: 'usr_guest', role: 'guest' };
    }
  } else {
    req.user = { id: 'usr_guest', role: 'guest' };
  }
  next();
};


// =====================================================================
// INICIALIZAÇÃO DO BANCO DE DADOS SUPABASE COM RETRY
// =====================================================================
let db: any = null;
let isDbConnected = false;
let dbInitAttempts = 0;
const MAX_INIT_ATTEMPTS = 2;

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
      ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
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
          console.log('[API] 📦 Tabela de serviços vazia no Supabase. Executando seed de dados padrão...');
          await seedDatabase();
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

// Endpoint de Health Check
app.get('/api/health', (req: any, res: any) => {
  res.json({
    status: isDbConnected ? 'ok' : 'degraded',
    database: isDbConnected ? 'connected' : 'disconnected',
    message: isDbConnected
      ? 'Banco de dados Supabase conectado e operacional.'
      : 'Sem conexão com o banco de dados Supabase.'
  });
});


// Setup database migration & seed
app.post("/api/seed", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const result = await seedDatabase();
    res.json({ success: true, message: "Banco de dados alimentado com dados de teste com sucesso!", details: result });
  } catch (e: any) {
    console.error("Error seeding database:", e);
    res.status(500).json({ error: "Falha ao popular o banco de dados", details: e.message });
  }
});

app.post("/api/migrate", requireAuth, async (req: any, res) => { if(req.user.role !== "admin") return res.status(403).json({ error: "Access denied" }); 
  try {
    const { runMigrations } = await import("./setup.js");
    await runMigrations();
    res.json({ success: true, message: "Database tables created successfully!" });
  } catch (e: any) {
    
    const userMessage = e.status === 401 || e.status === 403 
      ? 'Não foi possível autenticar com o assistente inteligente. Verifique as credenciais.'
      : 'Desculpe, o assistente inteligente está indisponível no momento. Tente novamente mais tarde.';
    res.status(500).json({ error: userMessage, details: e.message });

  }
});

// --- WhatsApp Notification Service (Baileys) ---
import whatsappRouter, { sendWhatsAppMessage } from './whatsapp.js';
app.use('/api/whatsapp/reconnect', requireAuth, requireAdmin);
app.use('/api/whatsapp/logout', requireAuth, requireAdmin);
app.use('/api/whatsapp', whatsappRouter);

// =====================================
// Guest Appointments Lookup API (2 Etapas)
// =====================================

// GET /api/appointments/lookup/step1 — Verifica se há agendamentos ativos para o telefone
app.get("/api/appointments/lookup/step1", sensitiveOpsLimiter, async (req: any, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'Informe o telefone.' });
    }

    const inputPhone = phone.toString().trim();
    const digitsOnly = inputPhone.replace(/\D/g, '');

    if (!digitsOnly || digitsOnly.length < 8) {
      return res.status(400).json({ error: 'Telefone inválido. Digite DDD + número.' });
    }

    const allApts = await db
      .select()
      .from(schema.appointments)
      .orderBy(desc(schema.appointments.createdAt))
      .limit(500);

    const appointments = allApts.filter((apt: any) => 
      apt.status !== 'cancelled' && matchPhoneNumbers(apt.clientPhone, inputPhone)
    );

    if (!appointments || appointments.length === 0) {
      return res.status(404).json({ 
        error: 'Nenhum agendamento encontrado para este telefone.',
        requiresCode: false
      });
    }

    return res.json({
      success: true,
      requiresCode: true,
      count: appointments.length,
      message: appointments.length === 1 
        ? 'Encontramos 1 agendamento. Digite o código da reserva para acessar.'
        : `Encontramos ${appointments.length} agendamentos. Digite o código da reserva para acessar.`
    });

  } catch (e: any) {
    console.error('[API] Erro em lookup/step1:', e);
    return res.status(500).json({ error: 'Erro ao buscar. Tente novamente.' });
  }
});

// POST /api/appointments/lookup/verify — Valida código e gera sessão (cookie HTTP-only)
app.post("/api/appointments/lookup/verify", sensitiveOpsLimiter, async (req: any, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ error: 'Informe telefone e código.' });
    }
    const inputPhone = phone.toString().trim();
    const cleanCode = code.toString().toUpperCase().trim();
    
    const allApts = await db
      .select()
      .from(schema.appointments)
      .orderBy(desc(schema.appointments.createdAt))
      .limit(500);
      
    const candidates = allApts.filter((apt: any) => matchPhoneNumbers(apt.clientPhone, inputPhone));
    
    const isMatch = candidates.some((apt: any) => {
      const aptCode = (apt.bookingCode || apt.id || '').toUpperCase();
      return aptCode === cleanCode || aptCode.endsWith(cleanCode) || cleanCode.endsWith(aptCode) || apt.id.toUpperCase().includes(cleanCode);
    });

    if (!isMatch) {
      return res.status(401).json({ error: 'Código de confirmação incorreto para o telefone informado.' });
    }

    const token = jwt.sign(
      { role: 'guest_auth', phone: inputPhone, id: `guest_${Date.now()}` },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('guest_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600 * 1000 // 1 hour
    });

    return res.json({ success: true, message: 'Validado com sucesso.' });
  } catch (e: any) {
    console.error('[API] Erro em lookup/verify:', e);
    return res.status(500).json({ error: 'Erro ao validar código. Tente novamente.' });
  }
});

// POST /api/appointments/lookup/logout — Revoga a sessão de visitante
app.post("/api/appointments/lookup/logout", (req: any, res) => {
  res.clearCookie('guest_token');
  res.json({ success: true });
});

// GET /api/appointments/lookup/step2 — Valida código e retorna detalhes do agendamento
app.get("/api/appointments/lookup/step2", optionalAuth, async (req: any, res) => {
  try {
    const { phone, code } = req.query;

    if (!phone || !code) {
      return res.status(400).json({ 
        error: 'Informe o telefone e o código da reserva.' 
      });
    }

    const inputPhone = phone.toString().trim();
    const cleanCode = code.toString().toUpperCase().trim();

    // Secure checking: Verify authorization
    let isAuthorized = false;
    const isAdmin = req.user?.role === 'admin';
    let userPhone = req.user?.phone;
    if (!userPhone && req.user?.id && req.user.id !== 'usr_guest') {
      const dbUser = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, req.user.id) });
      if (dbUser) userPhone = dbUser.phone;
    }

    if (isAdmin) {
      isAuthorized = true;
    } else if (userPhone && matchPhoneNumbers(userPhone, inputPhone)) {
      isAuthorized = true;
    } else if (req.cookies?.guest_token) {
      try {
        const guestDecoded: any = jwt.verify(req.cookies.guest_token, JWT_SECRET);
        if (guestDecoded.phone && matchPhoneNumbers(guestDecoded.phone, inputPhone)) {
          isAuthorized = true;
        }
      } catch (e) {
        // Token inválido ou expirado
      }
    }

    if (!isAuthorized) {
      return res.status(401).json({ error: 'Acesso negado: Sessão de busca inválida ou expirada.' });
    }

    const allApts = await db
      .select()
      .from(schema.appointments)
      .orderBy(desc(schema.appointments.createdAt))
      .limit(500);

    const candidates = allApts.filter((apt: any) => 
      matchPhoneNumbers(apt.clientPhone, inputPhone)
    );

    const appointment = candidates.find((apt: any) => {
      const aptCode = (apt.bookingCode || apt.id || '').toUpperCase();
      return aptCode === cleanCode || aptCode.endsWith(cleanCode) || cleanCode.endsWith(aptCode) || apt.id.toUpperCase().includes(cleanCode);
    });

    if (!appointment) {
      return res.status(404).json({ 
        error: 'Código de reserva inválido. Verifique e tente novamente.' 
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ 
        error: 'Este agendamento já foi cancelado.' 
      });
    }

    return res.json({
      success: true,
      appointment: {
        id: appointment.id,
        bookingCode: appointment.bookingCode || appointment.id,
        clientName: appointment.clientName,
        date: appointment.date,
        timeSlot: appointment.timeSlot,
        professionalName: appointment.professionalName,
        status: appointment.status,
        services: appointment.services,
        finalAmount: appointment.finalAmount,
        paymentMethod: appointment.paymentMethod,
      }
    });

  } catch (e: any) {
    console.error('[API] Erro em lookup/step2:', e);
    return res.status(500).json({ error: 'Erro ao buscar reserva. Tente novamente.' });
  }
});

// PATCH /api/appointments/lookup/cancel — Cancela agendamento via telefone + código
app.patch("/api/appointments/lookup/cancel", sensitiveOpsLimiter, optionalAuth, async (req: any, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: 'Informe telefone e código da reserva.' });
    }

    const inputPhone = phone.toString().trim();
    const cleanCode = code.toString().toUpperCase().trim();

    // Secure checking: Verify authorization
    let isAuthorized = false;
    const isAdmin = req.user?.role === 'admin';
    let userPhone = req.user?.phone;
    if (!userPhone && req.user?.id && req.user.id !== 'usr_guest') {
      const dbUser = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, req.user.id) });
      if (dbUser) userPhone = dbUser.phone;
    }

    if (isAdmin) {
      isAuthorized = true;
    } else if (userPhone && matchPhoneNumbers(userPhone, inputPhone)) {
      isAuthorized = true;
    } else if (req.cookies?.guest_token) {
      try {
        const guestDecoded: any = jwt.verify(req.cookies.guest_token, JWT_SECRET);
        if (guestDecoded.phone && matchPhoneNumbers(guestDecoded.phone, inputPhone)) {
          isAuthorized = true;
        }
      } catch (e) {
        // Token inválido ou expirado
      }
    }

    if (!isAuthorized) {
      return res.status(401).json({ error: 'Acesso negado: Sessão de busca inválida ou expirada.' });
    }

    const allApts = await db
      .select()
      .from(schema.appointments)
      .orderBy(desc(schema.appointments.createdAt))
      .limit(500);

    const candidates = allApts.filter((apt: any) => 
      matchPhoneNumbers(apt.clientPhone, inputPhone)
    );

    const appointment = candidates.find((apt: any) => {
      const aptCode = (apt.bookingCode || apt.id || '').toUpperCase();
      return aptCode === cleanCode || aptCode.endsWith(cleanCode) || cleanCode.endsWith(aptCode) || apt.id.toUpperCase().includes(cleanCode);
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Reserva não encontrada. Verifique os dados.' });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ error: 'Este agendamento já foi cancelado.' });
    }

    await db.update(schema.appointments)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(schema.appointments.id, appointment.id));

    await db.update(schema.waitingQueue)
      .set({ status: 'abandoned', updatedAt: new Date() })
      .where(eq(schema.waitingQueue.appointmentId, appointment.id));

    const msg = `❌ *BARBERX PREMIUM*\n\n` +
      `Olá, *${appointment.clientName}*!\n\n` +
      `Seu agendamento para *${appointment.date}* às *${appointment.timeSlot}* foi *CANCELADO*.\n\n` +
      `Ficamos à disposição para remarcar quando desejar! 💈`;
    
    sendWhatsAppMessage(appointment.clientPhone || inputPhone, msg).catch(() => {});

    return res.json({ 
      success: true, 
      message: 'Agendamento cancelado com sucesso.' 
    });

  } catch (e: any) {
    console.error('[API] Erro em lookup/cancel:', e);
    return res.status(500).json({ error: 'Erro ao cancelar. Tente novamente.' });
  }
});

// =====================================
// Appointments API
// =====================================
app.get("/api/appointments", optionalAuth, async (req: any, res) => {
  try {
    const userRole = req.user?.role || 'guest';
    const userId = req.user?.id || '';
    const isAdmin = userRole === 'admin';
    const isGuest = userRole === 'guest' || !userId || userId === 'usr_guest' || userId.startsWith('guest_');

    const searchPhone = (req.query.phone || req.query.clientPhone || '').toString().trim();

    const dbApts = await db
      .select()
      .from(schema.appointments)
      .orderBy(desc(schema.appointments.createdAt))
      .limit(500);

    // Se a requisição passou telefone para busca (ex: consulta do cliente por telefone)
    if (searchPhone) {
      let isAuthorized = false;
      if (isAdmin) {
        isAuthorized = true;
      } else if (req.user?.phone && matchPhoneNumbers(req.user.phone, searchPhone)) {
        isAuthorized = true;
      } else if (req.cookies?.guest_token) {
        try {
          const guestDecoded: any = jwt.verify(req.cookies.guest_token, JWT_SECRET);
          if (guestDecoded.phone && matchPhoneNumbers(guestDecoded.phone, searchPhone)) {
            isAuthorized = true;
          }
        } catch (e) {
          // Token inválido ou expirado
        }
      }

      if (!isAuthorized) {
        return res.status(401).json({ error: 'Sessão expirada ou não autorizada. Valide o código novamente.' });
      }

      const filtered = dbApts.filter(a => matchPhoneNumbers(a.clientPhone, searchPhone));
      return res.json(filtered);
    }

    // Se for administrador sem telefone de busca, retorna todos
    if (isAdmin) {
      return res.json(dbApts);
    }

    // Se for usuário autenticado (não convidado)
    if (!isGuest && userId) {
      let userPhone = req.user?.phone || '';
      if (!userPhone) {
        const dbUser = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, userId) });
        if (dbUser) userPhone = dbUser.phone || '';
      }
      const filtered = dbApts.filter(a => 
        a.clientId === userId || (userPhone && matchPhoneNumbers(a.clientPhone, userPhone))
      );
      return res.json(filtered);
    }

    // Se for visitante sem parâmetro de telefone
    return res.json([]);
  } catch (e: any) {
    console.error('[API] GET /api/appointments Error:', e);
    return handleError(res, e, req.path);
  }
});

app.post("/api/appointments", optionalAuth, async (req: any, res) => {
  try {
    const data = req.body;
    
    // LGPD & Validation
    try {
      bookingSchema.parse(data);
    } catch (validationError) {
      return res.status(400).json({ error: 'Dados inválidos', details: validationError });
    }

    const professionalId = data.professionalId || data.professional_id;
    const date = data.date;
    const timeSlot = data.timeSlot || data.time_slot;

    if (!professionalId || !date || !timeSlot) {
      return res.status(400).json({ error: 'Profissional, data e horário são obrigatórios' });
    }

    const todayBRT = getTodayStringBRT();
    const currTimeBRT = getCurrentTimeBRT();
    const reqStart = timeToMinutes(timeSlot);

    if (date < todayBRT || (date === todayBRT && reqStart <= currTimeBRT.totalMinutes)) {
      return res.status(400).json({ error: 'Não é possível agendar para uma data ou horário que já passou.' });
    }

    const isAdmin = req.user && req.user.role === 'admin';

    // Calculate total price and total duration from services on the server side.
    let calculatedTotal = 0;
    let calculatedDuration = 0;

    let allServices = await db.query.services.findMany();

    const requestedServiceIds: string[] = Array.isArray(data.services)
      ? data.services.map((reqSvc: any) => (typeof reqSvc === 'string' ? reqSvc : reqSvc?.id)).filter(Boolean)
      : [];

    if (requestedServiceIds.length > 0) {
      const unmatchedIds: string[] = [];
      for (const srvId of requestedServiceIds) {
        const srv = allServices.find((s: any) => s.id === srvId);
        if (srv) {
          calculatedTotal += Number(srv.price || 0);
          calculatedDuration += Number(srv.durationMinutes || srv.duration_minutes || 0);
        } else {
          unmatchedIds.push(srvId);
        }
      }
      if (unmatchedIds.length > 0) {
        return res.status(400).json({ error: 'Um ou mais serviços selecionados são inválidos.', invalidServiceIds: unmatchedIds });
      }
    } else if (isAdmin && data.originalAmount) {
      calculatedTotal = Number(data.originalAmount ?? data.original_amount ?? 0);
      if (!Number.isFinite(calculatedTotal) || calculatedTotal < 0) calculatedTotal = 0;
      calculatedDuration = Number(data.totalDurationMinutes ?? data.total_duration_minutes ?? 30);
    } else {
      return res.status(400).json({ error: 'Selecione ao menos um serviço válido.' });
    }

    if (calculatedDuration <= 0) {
      calculatedDuration = 30;
    }

    const checkRes = await checkSlotAvailability({
      dateStr: date,
      startMins: reqStart,
      reqDuration: calculatedDuration,
      profId: professionalId,
      todayBRT,
      currTimeBRT,
    });

    if (!checkRes.available) {
      return res.status(409).json({ error: checkRes.reason || 'Este horário conflita com outro agendamento ou bloqueio de agenda.' });
    }

    let resolvedProfessionalId = professionalId;
    let resolvedProfessionalName = data.professionalName || data.professional_name || 'Profissional';

    if (resolvedProfessionalId === 'prof_any') {
      if (checkRes.chosenProf) {
        resolvedProfessionalId = checkRes.chosenProf.id;
        resolvedProfessionalName = checkRes.chosenProf.name;
      }
    } else {
      const allProfs = await db.query.professionals.findMany();
      const profObj = allProfs.find((p: any) => p.id === resolvedProfessionalId);
      if (profObj) {
        resolvedProfessionalName = profObj.name;
      }
    }

    const originalAmount = calculatedTotal;

    // Discount amount comes from the client, so it must be validated server-side.
    // Non-admins cannot apply an arbitrary discount; only admins (e.g. manual adjustments
    // via the admin panel) may set a discount value directly. For everyone else, the
    // discount is clamped to the calculated total to prevent a negative or forged final price.
    let rawDiscount = Number(data.discountAmount ?? data.discount_amount ?? 0);
    if (!Number.isFinite(rawDiscount) || rawDiscount < 0) rawDiscount = 0;
    const discountAmount = isAdmin
      ? Math.min(rawDiscount, originalAmount)
      : 0;
    const finalAmount = Math.max(0, originalAmount - discountAmount);

    let clientId = data.clientId || data.client_id || (req.user?.id || 'guest');

    // Ensure regular users cannot spoof booking for other users
    if (!isAdmin && req.user && req.user.id && req.user.role !== 'guest' && req.user.id !== 'usr_guest' && !req.user.id.startsWith('guest_')) {
      clientId = req.user.id;
    }

    // Guests (unauthenticated) must not be able to attach the booking to an existing
    // registered profile just by guessing/knowing that profile's id.
    if (!isAdmin && (!req.user || !req.user.id || req.user.role === 'guest' || req.user.id === 'usr_guest' || req.user.id.startsWith('guest_'))) {
      const requestedClientId = data.clientId || data.client_id;
      if (requestedClientId) {
        const existingProfile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, requestedClientId) });
        if (existingProfile) {
          // Requested id belongs to a real, existing account — a guest cannot claim it.
          // Fall back to a freshly generated guest id instead.
          clientId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        }
      }
    }

    let clientName = data.clientName || data.client_name || 'Cliente';
    let clientPhone = sanitizePhone(data.clientPhone || data.client_phone || '');

    // Ensure client profile exists
    if (isDbConnected && db) {
      try {
        const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, clientId) });
        if (!profile) {
          const cleanId = clientId.replace(/[^a-zA-Z0-9_-]/g, '');
          const safeEmail = `${cleanId}_${Date.now()}@guest.barberx.app`;
          await db.insert(schema.profiles).values({
            id: clientId,
            name: clientName,
            email: safeEmail,
            phone: clientPhone || null,
            role: 'client',
            loyaltyPoints: 0,
            loyaltyTier: 'Bronze'
          }).onConflictDoNothing();
        } else {
          if (!isAdmin && req.user && req.user.id && req.user.role !== 'guest' && req.user.id !== 'usr_guest' && !req.user.id.startsWith('guest_')) {
            if (profile.name) clientName = profile.name;
            if (!clientPhone && profile.phone) clientPhone = profile.phone;
          }
        }
      } catch (e) {
        console.warn('[API] Could not check/create guest profile:', e);
      }
    }

    const isPendingApproval = checkRes.requiresApproval || data.status === 'pending_approval';

    const newApt = {
      id: data.id || `apt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      clientId,
      clientName,
      clientPhone,
      professionalId: resolvedProfessionalId,
      professionalName: resolvedProfessionalName,
      date,
      timeSlot,
      status: isPendingApproval ? 'pending_approval' : (data.status || 'confirmed'),
      totalDurationMinutes: calculatedDuration > 0 ? calculatedDuration : Number(data.totalDurationMinutes || data.total_duration_minutes || 30),
      originalAmount: originalAmount.toString(),
      discountAmount: discountAmount.toString(),
      finalAmount: finalAmount.toString(),
      paymentMethod: data.paymentMethod || data.payment_method || 'PIX',
      bookingCode: data.bookingCode || generateBookingCode(),
      services: data.services || [],
      createdAt: data.createdAt || new Date().toISOString()
    };

    // 2. Atomic Save (Transaction)
    if (isDbConnected && db && typeof db.transaction === 'function') {
      try {
        await db.transaction(async (tx: any) => {
          // A. Ensure professional exists in DB before referencing in appointments
          if (resolvedProfessionalId && resolvedProfessionalId !== 'prof_any') {
            const profCheck = await tx.query.professionals.findFirst({
              where: eq(schema.professionals.id, resolvedProfessionalId)
            });
            if (!profCheck) {
              await tx.insert(schema.professionals).values({
                id: resolvedProfessionalId,
                name: resolvedProfessionalName || 'Profissional',
                roleTitle: 'Master Barber',
                rating: '5.00',
                reviewsCount: 0,
                commissionRate: '0.40',
                isActive: true,
                workingHours: {}
              }).onConflictDoNothing();
            }
          }

          // B. Ensure profile exists in DB before referencing in appointments
          if (clientId) {
            const profileCheck = await tx.query.profiles.findFirst({
              where: eq(schema.profiles.id, clientId)
            });
            if (!profileCheck) {
              const cleanId = clientId.replace(/[^a-zA-Z0-9_-]/g, '');
              const safeEmail = `${cleanId}_${Date.now()}@guest.barberx.app`;
              await tx.insert(schema.profiles).values({
                id: clientId,
                name: clientName || 'Cliente',
                email: safeEmail,
                phone: clientPhone || null,
                role: 'client',
                loyaltyPoints: 0,
                loyaltyTier: 'Bronze'
              }).onConflictDoNothing();
            }
          }

          const dbApt = {
            ...newApt,
            createdAt: newApt.createdAt ? new Date(newApt.createdAt) : new Date()
          };
          const { createdAt, id: _idKey, ...updateFields } = dbApt;
          await tx.insert(schema.appointments).values(dbApt).onConflictDoUpdate({
            target: schema.appointments.id,
            set: {
              ...updateFields,
              updatedAt: new Date()
            }
          });

          // Auto-feed waiting queue if appointment is for today
          // (usa getTodayStringBRT — não new Date().toISOString(), que retorna a data em UTC
          // e diverge do dia real em BRT entre 21h e 23h59, horário de Brasília)
          const todayStr = getTodayStringBRT();
          if (newApt.date === todayStr && newApt.status !== 'cancelled') {
            const serviceTitle = Array.isArray(newApt.services) && newApt.services.length > 0
              ? (typeof newApt.services[0] === 'string' ? newApt.services[0] : (newApt.services[0].title || 'Atendimento BarberX'))
              : 'Atendimento BarberX';

            const queueItem = {
              id: `q_${newApt.id}`,
              appointmentId: newApt.id,
              clientId: newApt.clientId,
              clientName: newApt.clientName,
              professionalId: newApt.professionalId,
              serviceTitle,
              status: newApt.status === 'in_service' ? 'in_chair' : 'waiting',
              joinedAt: new Date(),
              estimatedWaitMinutes: 15
            };
            await tx.insert(schema.waitingQueue).values(queueItem).onConflictDoUpdate({
              target: schema.waitingQueue.id,
              set: queueItem
            });
          }
        });
      } catch (err: any) {
        const errMsg = err?.message || '';
        const causeMsg = err?.cause?.message || err?.cause?.constraint_name || '';
        const pgCode = err?.code || err?.cause?.code || '';
        const pgConstraint = err?.constraint || err?.cause?.constraint || '';
        const fullErr = `${errMsg} ${causeMsg} ${pgCode} ${pgConstraint}`;

        if (fullErr.includes('booking_conflict_idx') || fullErr.includes('23505') || pgCode === '23505') {
          if (fullErr.includes('booking_code')) {
            // Se conflitou no código da reserva, tentar código alternativo
            newApt.bookingCode = generateBookingCode() + 'X';
            const dbApt = { ...newApt, createdAt: new Date() };
            const { createdAt, id: _idKey, ...updateFields } = dbApt;
            await db.insert(schema.appointments).values(dbApt).onConflictDoUpdate({
              target: schema.appointments.id,
              set: { ...updateFields, updatedAt: new Date() }
            });
          } else {
            return res.status(409).json({ error: 'Este horário já está reservado. Por favor, escolha outro.' });
          }
        } else {
          console.error('[API] Atomic transaction failed:', err);

          if (fullErr.includes('appointments_client_id_fkey')) {
            return res.status(400).json({ error: 'Erro no perfil do cliente. Atualize a página e tente novamente.' });
          }
          if (fullErr.includes('appointments_professional_id_fkey')) {
            return res.status(400).json({ error: 'Profissional não encontrado.' });
          }

          return res.status(400).json({ error: 'Falha ao salvar agendamento no banco de dados. Por favor, tente novamente.' });
        }
      }
    } else {
      // Fallback to non-transactional insert
      const dbApt = {
        ...newApt,
        createdAt: newApt.createdAt ? new Date(newApt.createdAt) : new Date()
      };
      const { createdAt, id: _idKey, ...updateFields } = dbApt;
      try {
        await db.insert(schema.appointments).values(dbApt).onConflictDoUpdate({
          target: schema.appointments.id,
          set: {
            ...updateFields,
            updatedAt: new Date()
          }
        });
      } catch (err: any) {
        const errMsg = err?.message || '';
        const causeMsg = err?.cause?.message || err?.cause?.constraint_name || '';
        const pgCode = err?.code || err?.cause?.code || '';
        const pgConstraint = err?.constraint || err?.cause?.constraint || '';
        const fullErr = `${errMsg} ${causeMsg} ${pgCode} ${pgConstraint}`;

        if (fullErr.includes('booking_conflict_idx') || fullErr.includes('23505') || pgCode === '23505') {
          return res.status(409).json({ error: 'Este horário já está reservado. Por favor, escolha outro.' });
        }
        
        console.error("[API] Fallback insert failed:", err);
        return res.status(400).json({ error: "Falha ao salvar agendamento no banco de dados. Por favor, tente novamente." });
      }
    }


    // Disparo de mensagem WhatsApp (Confirmação ou Cancelamento)
    let phone = newApt.clientPhone || '5511999999999';
    if (!newApt.clientPhone && newApt.clientId) {
      const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, newApt.clientId) });
      if (profile && profile.phone) phone = sanitizePhone(profile.phone);
    }

    // Garantir que o número tem o tamanho certo para o WhatsApp (mínimo 12 dígitos com o 55)
    if (!phone || phone.length < 12) {
      console.warn(`[WhatsApp] Número inválido para envio: ${phone}. Usando fallback.`);
      phone = '5511999999999'; 
    }
    if (newApt.status === 'cancelled') {
      const msg = `❌ *BARBERX PREMIUM*\n\nOlá, *${newApt.clientName || 'Cliente'}*!\nSeu agendamento para *${newApt.date}* às *${newApt.timeSlot}* foi *CANCELADO* com sucesso.\n\nFicamos à disposição para remarcar quando desejar! 💈`;
      sendWhatsAppMessage(phone, msg).catch(() => {});
    } else {
      const msg = `💈 *BARBERX PREMIUM*\n\nOlá, *${newApt.clientName || 'Cliente'}*!\n\nSeu agendamento foi *confirmado* com sucesso:\n\n🔑 *Código:* ${newApt.bookingCode || newApt.id}\n📅 *Data:* ${newApt.date}\n⏰ *Horário:* ${newApt.timeSlot}\n✂️ *Barbeiro:* ${newApt.professionalName || 'Profissional BarberX'}\n\n📍 *Local:* BarberX Premium - Rua dos Barões, 1420 - Jardins\n\nTe esperamos com o café pronto! ☕`;
      sendWhatsAppMessage(phone, msg).catch(() => {});
    }

    res.json(newApt);
  } catch (e: any) {
    console.error('Error in POST /api/appointments:', e);
    return handleError(res, e, req.path);
  }
});


app.post("/api/appointments/:id/review", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Avaliação inválida.' });
    }

    const dbApt = await db.query.appointments.findFirst({ where: eq(schema.appointments.id, id) });
    if (!dbApt) return res.status(404).json({ error: 'Agendamento não encontrado' });
    if (dbApt.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    if (dbApt.status !== 'completed') {
      return res.status(400).json({ error: 'Apenas agendamentos concluídos podem ser avaliados.' });
    }
    if (dbApt.isReviewed) {
      return res.status(400).json({ error: 'Este agendamento já foi avaliado.' });
    }

    const reviewId = 'rev_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    await db.insert(schema.reviews).values({
      id: reviewId,
      appointmentId: id,
      professionalId: dbApt.professionalId,
      rating,
      comment
    });

    await db.update(schema.appointments).set({ 
      isReviewed: true,
      updatedAt: new Date() 
    }).where(eq(schema.appointments.id, id));

    // Optional: update professional rating logic can go here
    // for now we just return success

    res.json({ success: true });
  } catch (e: any) {
    console.error('Error in POST /api/appointments/:id/review:', e);
    return handleError(res, e, req.path);
  }
});

app.patch("/api/appointments/:id/cancel", sensitiveOpsLimiter, optionalAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    let updatedApt: any = null;
    const isAdmin = req.user?.role === 'admin';

    const dbApt = await db.query.appointments.findFirst({ where: eq(schema.appointments.id, id) });
    if (!dbApt) return res.status(404).json({ error: 'Agendamento não encontrado' });

    if (!isAdmin) {
      let userPhone = req.user?.phone;
      if (!userPhone && req.user?.id && req.user.id !== 'usr_guest') {
        const dbUser = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, req.user.id) });
        if (dbUser) userPhone = dbUser.phone;
      }

      const isOwner = req.user?.id && req.user.id !== 'usr_guest' && dbApt.clientId === req.user.id;
      const isPhoneMatch = userPhone && dbApt.clientPhone && matchPhoneNumbers(userPhone, dbApt.clientPhone);
      
      const reqPhone = req.body.clientPhone || req.body.client_phone;
      const reqCode = req.body.bookingCode || req.body.booking_code;
      const isLookupMatch = reqPhone && dbApt.clientPhone && matchPhoneNumbers(reqPhone, dbApt.clientPhone) &&
                            reqCode && dbApt.bookingCode && reqCode.toUpperCase().trim() === dbApt.bookingCode.toUpperCase().trim();

      // Check for guest_token cookie validation
      let isGuestTokenMatch = false;
      if (req.cookies?.guest_token) {
        try {
          const guestDecoded: any = jwt.verify(req.cookies.guest_token, JWT_SECRET);
          if (guestDecoded.phone && dbApt.clientPhone && matchPhoneNumbers(guestDecoded.phone, dbApt.clientPhone)) {
            isGuestTokenMatch = true;
          }
        } catch (e) {}
      }

      if (!isOwner && !isPhoneMatch && !isLookupMatch && !isGuestTokenMatch) {
        return res.status(403).json({ error: 'Acesso negado: Você não tem autorização para cancelar este agendamento' });
      }
    }

    await db.update(schema.appointments).set({ 
      status: 'cancelled', 
      cancellationReason: reason || 'Cancelado pelo cliente',
      updatedAt: new Date() 
    }).where(eq(schema.appointments.id, id));
    
    await db.update(schema.waitingQueue).set({
      status: 'abandoned',
      updatedAt: new Date()
    }).where(eq(schema.waitingQueue.appointmentId, id));
    
    updatedApt = { ...dbApt, status: 'cancelled', cancellationReason: reason };

    if (updatedApt) {
      let phone = updatedApt.clientPhone || '5511999999999';
      if (!updatedApt.clientPhone && updatedApt.clientId) {
        const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, updatedApt.clientId) });
        if (profile && profile.phone) phone = profile.phone;
      }
      const msg = `❌ *BARBERX PREMIUM*\n\nOlá, *${updatedApt.clientName || 'Cliente'}*!\nSeu agendamento para *${updatedApt.date}* às *${updatedApt.timeSlot}* foi *CANCELADO* com sucesso.\n\nFicamos à disposição para remarcar quando desejar! 💈`;

      sendWhatsAppMessage(phone, msg).catch(() => {});
    }

    res.json({ success: true, updated: updatedApt });
  } catch (e: any) {
    console.error('[API] Error canceling appointment:', e);
    return handleError(res, e, req.path);
  }
});

app.put("/api/appointments/:id", sensitiveOpsLimiter, optionalAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const isAdmin = req.user?.role === 'admin';

    const dbApt = await db.query.appointments.findFirst({ where: eq(schema.appointments.id, id) });
    if (!dbApt) return res.status(404).json({ error: 'Agendamento não encontrado' });

    if (!isAdmin) {
      let userPhone = req.user?.phone;
      if (!userPhone && req.user?.id && req.user.id !== 'usr_guest') {
        const dbUser = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, req.user.id) });
        if (dbUser) userPhone = dbUser.phone;
      }

      const isOwner = req.user?.id && req.user.id !== 'usr_guest' && dbApt.clientId === req.user.id;
      const isPhoneMatch = userPhone && dbApt.clientPhone && matchPhoneNumbers(userPhone, dbApt.clientPhone);
      
      const reqPhone = req.body.clientPhone || req.body.client_phone;
      const reqCode = req.body.bookingCode || req.body.booking_code;
      const isLookupMatch = reqPhone && dbApt.clientPhone && matchPhoneNumbers(reqPhone, dbApt.clientPhone) &&
                            reqCode && dbApt.bookingCode && reqCode.toUpperCase().trim() === dbApt.bookingCode.toUpperCase().trim();

      // Check for guest_token cookie validation
      let isGuestTokenMatch = false;
      if (req.cookies?.guest_token) {
        try {
          const guestDecoded: any = jwt.verify(req.cookies.guest_token, JWT_SECRET);
          if (guestDecoded.phone && dbApt.clientPhone && matchPhoneNumbers(guestDecoded.phone, dbApt.clientPhone)) {
            isGuestTokenMatch = true;
          }
        } catch (e) {}
      }

      if (!isOwner && !isPhoneMatch && !isLookupMatch && !isGuestTokenMatch) {
        return res.status(403).json({ error: 'Acesso negado: Você não tem autorização para editar este agendamento' });
      }
    }

    const newDate = data.date || dbApt.date;
    const newTimeSlot = data.timeSlot || data.time_slot || dbApt.timeSlot;
    const newProfessionalId = data.professionalId || data.professional_id || dbApt.professionalId;
    const durationMins = Number(data.totalDurationMinutes || data.total_duration_minutes || dbApt.totalDurationMinutes || 30);

    if (newDate !== dbApt.date || newTimeSlot !== dbApt.timeSlot || newProfessionalId !== dbApt.professionalId || data.services !== undefined) {
      const todayBRT = getTodayStringBRT();
      const currTimeBRT = getCurrentTimeBRT();
      const reqStart = timeToMinutes(newTimeSlot);
      const reqEnd = reqStart + durationMins;

      const checkRes = await checkSlotAvailability({
        dateStr: newDate,
        startMins: reqStart,
        reqDuration: durationMins,
        profId: newProfessionalId,
        excludeAptId: id,
        todayBRT,
        currTimeBRT,
      });

      if (!checkRes.available) {
        return res.status(409).json({ error: checkRes.reason || 'Este horário conflita com outro agendamento ou bloqueio de agenda.' });
      }
    }

    if (isDbConnected && db) {
      try {
        const updateData: any = { updatedAt: new Date() };
        
        if (data.status !== undefined) updateData.status = data.status;
        if (data.date !== undefined) updateData.date = data.date;
        if (data.timeSlot !== undefined) updateData.timeSlot = data.timeSlot;
        if (data.time_slot !== undefined) updateData.timeSlot = data.time_slot;
        
        if (data.clientPhone !== undefined) updateData.clientPhone = sanitizePhone(data.clientPhone);
        if (data.client_phone !== undefined) updateData.clientPhone = sanitizePhone(data.client_phone);
        if (data.clientName !== undefined) updateData.clientName = data.clientName;
        if (data.client_name !== undefined) updateData.clientName = data.client_name;
        if (data.professionalId !== undefined) updateData.professionalId = data.professionalId;
        if (data.professional_id !== undefined) updateData.professionalId = data.professional_id;
        if (data.professionalName !== undefined) updateData.professionalName = data.professionalName;
        if (data.professional_name !== undefined) updateData.professionalName = data.professional_name;
        // Price fields (originalAmount/discountAmount/finalAmount) are NEVER taken verbatim
        // from the request body. They are recalculated server-side below, the same way
        // POST /api/appointments does it, so a caller cannot forge or zero out the price
        // by editing an existing appointment.
        const newServices = data.services !== undefined ? data.services : dbApt.services;
        if (data.services !== undefined) updateData.services = newServices;
        if (data.totalDurationMinutes !== undefined) updateData.totalDurationMinutes = data.totalDurationMinutes;
        if (data.total_duration_minutes !== undefined) updateData.totalDurationMinutes = data.total_duration_minutes;

        if (data.services !== undefined) {
          // Services changed (or were re-sent): recompute price/duration from the DB, never from the client.
          // Every id must resolve to a real service — an unmatched id is a validation
          // error, not a silent 0 (which would let a non-admin zero out the price by
          // sending an empty/invalid services array on an edit).
          const allServices = await db.query.services.findMany();
          let recalcTotal = 0;
          let recalcDuration = 0;
          const editRequestedIds: string[] = Array.isArray(newServices)
            ? newServices.map((reqSvc: any) => (typeof reqSvc === 'string' ? reqSvc : reqSvc?.id)).filter(Boolean)
            : [];

          if (editRequestedIds.length === 0 && !isAdmin) {
            return res.status(400).json({ error: 'Selecione ao menos um serviço válido.' });
          }

          const editUnmatchedIds: string[] = [];
          for (const srvId of editRequestedIds) {
            const srv = allServices.find((s: any) => s.id === srvId);
            if (srv) {
              recalcTotal += Number(srv.price || 0);
              recalcDuration += Number(srv.durationMinutes || srv.duration_minutes || 0);
            } else {
              editUnmatchedIds.push(srvId);
            }
          }
          if (editUnmatchedIds.length > 0 && !isAdmin) {
            return res.status(400).json({ error: 'Um ou mais serviços selecionados são inválidos.', invalidServiceIds: editUnmatchedIds });
          }
          updateData.originalAmount = recalcTotal.toString();
          if (recalcDuration > 0) updateData.totalDurationMinutes = recalcDuration;

          let rawDiscount = Number(data.discountAmount ?? data.discount_amount ?? 0);
          if (!Number.isFinite(rawDiscount) || rawDiscount < 0) rawDiscount = 0;
          const cappedDiscount = isAdmin ? Math.min(rawDiscount, recalcTotal) : 0;
          updateData.discountAmount = cappedDiscount.toString();
          updateData.finalAmount = Math.max(0, recalcTotal - cappedDiscount).toString();
        } else if (isAdmin && (data.discountAmount !== undefined || data.discount_amount !== undefined)) {
          // Admin manually adjusting the discount on an unchanged set of services.
          const baseAmount = Number(dbApt.originalAmount || 0);
          let rawDiscount = Number(data.discountAmount ?? data.discount_amount ?? 0);
          if (!Number.isFinite(rawDiscount) || rawDiscount < 0) rawDiscount = 0;
          const cappedDiscount = Math.min(rawDiscount, baseAmount);
          updateData.discountAmount = cappedDiscount.toString();
          updateData.finalAmount = Math.max(0, baseAmount - cappedDiscount).toString();
        }

        if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
        if (data.payment_method !== undefined) updateData.paymentMethod = data.payment_method;

        await db
          .update(schema.appointments)
          .set(updateData)
          .where(eq(schema.appointments.id, id));

        const updatedApt = await db.query.appointments.findFirst({ 
          where: eq(schema.appointments.id, id) 
        });

        if (data.status === 'completed' && dbApt.status !== 'completed') {
          await processAppointmentCompletion(updatedApt);
        }

        if (data.date || data.timeSlot || data.time_slot) {
          let phone = updatedApt.clientPhone || '5511999999999';
          if (!updatedApt.clientPhone && updatedApt.clientId) {
            const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, updatedApt.clientId) });
            if (profile && profile.phone) phone = profile.phone;
          }
          const msg = `🔄 *BARBERX PREMIUM*\n\nOlá, *${updatedApt.clientName || 'Cliente'}*!\n\nSeu agendamento foi *REAGENDADO* com sucesso:\n\n📅 *Nova Data:* ${updatedApt.date}\n⏰ *Novo Horário:* ${updatedApt.timeSlot}\n✂️ *Barbeiro:* ${updatedApt.professionalName || 'Profissional BarberX'}\n\n📍 *Local:* BarberX Premium - Rua dos Barões, 1420 - Jardins\n\nTe esperamos com o café pronto! ☕`;

          sendWhatsAppMessage(phone, msg).catch(() => {});
        }

        return res.json(updatedApt);
      } catch (err: any) {
        console.warn('[API] Could not update appointment in Postgres:', err);
        return res.status(500).json({ error: 'Falha ao atualizar agendamento no banco de dados.' });
      }
    }

    res.json({ id, ...dbApt, ...data });
  } catch (e: any) {
    console.error('[API] Error updating appointment:', e);
    return handleError(res, e, req.path);
  }
});

app.get("/api/services", async (req, res) => {
  try {
    const servicesList = await db.query.services.findMany();
    // sort services by displayOrder
    servicesList.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    res.json(servicesList);
  } catch (e: any) {
    console.error('Error fetching services:', e);
    return handleError(res, e, req.path);
  }
});

app.delete("/api/services/all", requireAuth, requireAdmin, async (req, res) => {
  try {
    if (isDbConnected && db) {
      await db.delete(schema.services);
    }
    res.json({ success: true, message: 'Todos os serviços foram removidos.' });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.post("/api/services", requireAuth, requireAdmin, async (req, res) => {
  try {
    const newSrv = { id: req.body.id || `srv_${Date.now()}`, ...req.body };
    await db.insert(schema.services).values(newSrv).onConflictDoUpdate({
      target: schema.services.id,
      set: { ...req.body, updatedAt: new Date() }
    });
    res.json(newSrv);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.put("/api/services/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const srvData = { id: req.params.id, ...req.body };
    await db.insert(schema.services).values(srvData).onConflictDoUpdate({
      target: schema.services.id,
      set: { ...req.body, updatedAt: new Date() }
    });
    res.json(srvData);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.delete("/api/services/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.delete(schema.services).where(eq(schema.services.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

// =====================================
// Professionals API
// =====================================
app.get("/api/professionals", async (req, res) => {
  try {
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    const token = req.cookies.token || (authHeader && authHeader.split(' ')[1]);
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        isAdmin = decoded.role === 'admin';
      } catch(e) {}
    }

    let professionals = await db.query.professionals.findMany();

    if (!isAdmin) {
      // Allowlist explícito de campos públicos. Evita vazar userId (id interno do
      // perfil vinculado), commissionRate e timestamps internos para visitantes.
      professionals = professionals.map((p: any) => ({
        id: p.id,
        name: p.name,
        nickname: p.nickname,
        roleTitle: p.roleTitle,
        rating: p.rating,
        reviewsCount: p.reviewsCount,
        photoUrl: p.photoUrl,
        specialties: p.specialties,
        isActive: p.isActive,
        workingHours: p.workingHours,
      }));
    }
    res.json(professionals);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.post("/api/professionals", requireAuth, requireAdmin, async (req, res) => {
  try {
    const newProf = { id: req.body.id || `prof_${Date.now()}`, ...req.body };
    await db.insert(schema.professionals).values(newProf).onConflictDoUpdate({
      target: schema.professionals.id,
      set: { ...req.body, updatedAt: new Date() }
    });
    res.json(newProf);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.put("/api/professionals/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const profData = { id: req.params.id, ...req.body };
    await db.insert(schema.professionals).values(profData).onConflictDoUpdate({
      target: schema.professionals.id,
      set: { ...req.body, updatedAt: new Date() }
    });
    res.json(profData);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.delete("/api/professionals/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.delete(schema.professionals).where(eq(schema.professionals.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    if (e.code === '23503' || (e.message && e.message.includes('violates foreign key constraint') && e.message.includes('professionals'))) {
      return res.status(400).json({ error: 'Não é possível excluir este profissional pois ele possui agendamentos vinculados.' });
    }
    return handleError(res, e, req.path);
  }
});

// =====================================
// Schedule Blocks API
// =====================================
app.get("/api/schedule-blocks", async (req, res) => {
  try {
    const blocks = await db.query.scheduleBlocks.findMany();
    res.json(blocks);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.post("/api/schedule-blocks", requireAuth, requireAdmin, async (req, res) => {
  try {
    const newBlock = { id: req.body.id || `blk_${Date.now()}`, ...req.body };
    await db.insert(schema.scheduleBlocks).values(newBlock).onConflictDoUpdate({
      target: schema.scheduleBlocks.id,
      set: { ...req.body }
    });
    res.json(newBlock);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.delete("/api/schedule-blocks/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.delete(schema.scheduleBlocks).where(eq(schema.scheduleBlocks.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

// =====================================
// Cash Transactions API (Livro de Caixa)
// =====================================
app.get("/api/cash-transactions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const transactions = await db.query.cashTransactions.findMany({
      orderBy: [desc(schema.cashTransactions.createdAt)]
    });
    res.json(transactions);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.post("/api/cash-transactions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const newTx = { id: req.body.id || `tx_${Date.now()}`, ...req.body };
    await db.insert(schema.cashTransactions).values(newTx).onConflictDoUpdate({
      target: schema.cashTransactions.id,
      set: { ...req.body }
    });
    res.json(newTx);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.put("/api/cash-transactions/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const txData = { id: req.params.id, ...req.body };
    await db.insert(schema.cashTransactions).values(txData).onConflictDoUpdate({
      target: schema.cashTransactions.id,
      set: { ...req.body }
    });
    res.json(txData);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.delete("/api/cash-transactions/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.delete(schema.cashTransactions).where(eq(schema.cashTransactions.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

// =====================================
// Products API
// =====================================

// =====================================================================
// UNIFIED AVAILABILITY ENGINE (SINGLE SOURCE OF TRUTH)
// =====================================================================
interface CheckSlotParams {
  dateStr: string;
  startMins: number;
  reqDuration: number;
  profId?: string;
  excludeAptId?: string;
  todayBRT: string;
  currTimeBRT: { totalMinutes: number; timeStr: string };
  debug?: boolean;
  // Contexto pré-carregado opcional: quando informado, evita re-consultar o banco.
  // Usado pelo /api/availability pra buscar tudo uma vez e reaproveitar em cada slot candidato.
  preloaded?: DaySlotContext;
}

interface CheckSlotResult {
  statusCode: 'AVAILABLE' | 'REQUIRES_APPROVAL' | 'PAST_TIME' | 'SHOP_CLOSED' | 'CONFIRMED_OCCUPIED' | 'BLOCKED' | 'PROFESSIONAL_UNAVAILABLE';
  available: boolean;
  requiresApproval?: boolean;
  isOutsideHours?: boolean;
  chosenProf?: any;
  reason?: string;
  endMins?: number;
  closeMins?: number;
}

// Dados que dependem apenas de (dateStr) e não do slot — buscados uma única vez
// por requisição e reaproveitados em memória para cada horário candidato do dia.
interface DaySlotContext {
  shopProf: any;
  allAppointments: any[];
  allBlocks: any[];
  activeProfs: any[];
}

async function fetchDaySlotContext(dateStr: string, excludeAptId?: string): Promise<DaySlotContext> {
  let shopProfileRows: any[] = [];
  try {
    shopProfileRows = await db.query.shopSettings.findMany();
  } catch (e) {}
  const shopProf = shopProfileRows[0] || {};

  const allAppointments = await db.query.appointments.findMany({
    where: (apt: any, { and, eq, ne }: any) => {
      const conds = [
        eq(apt.date, dateStr),
        ne(apt.status, 'cancelled')
      ];
      if (excludeAptId) {
        conds.push(ne(apt.id, excludeAptId));
      }
      return and(...conds);
    }
  });

  let allBlocks: any[] = [];
  try {
    allBlocks = await db.query.scheduleBlocks.findMany({
      where: (blk: any, { eq }: any) => eq(blk.date, dateStr)
    });
  } catch (e) {}

  const allProfs = await db.query.professionals.findMany();
  let activeProfs = allProfs.filter((p: any) => p.id !== 'prof_any' && p.isActive !== false);
  if (activeProfs.length === 0) {
    activeProfs = [
      { id: 'prof_1', name: 'Carlos Silva', isActive: true },
      { id: 'prof_2', name: 'Matheus Santos', isActive: true }
    ];
  }

  return { shopProf, allAppointments, allBlocks, activeProfs };
}

async function checkSlotAvailability({
  dateStr,
  startMins,
  reqDuration,
  profId,
  excludeAptId,
  todayBRT,
  currTimeBRT,
  debug = false,
  preloaded
}: CheckSlotParams): Promise<CheckSlotResult> {
  const endMins = startMins + reqDuration;

  // 1. Data/Horário no passado?
  if (dateStr < todayBRT) {
    return {
      statusCode: 'PAST_TIME',
      available: false,
      reason: 'Não é possível agendar para uma data no passado.'
    };
  }

  if (dateStr === todayBRT && startMins <= currTimeBRT.totalMinutes) {
    return {
      statusCode: 'PAST_TIME',
      available: false,
      reason: 'Não é possível agendar para um horário que já passou.'
    };
  }

  // 2. Horário de funcionamento da barbearia (reaproveita contexto pré-carregado, se houver)
  const ctx = preloaded || await fetchDaySlotContext(dateStr, excludeAptId);
  const shopProf = ctx.shopProf;
  const dayKey = getDayOfWeekKey(dateStr);
  const daySchedule = shopProf.operatingSchedule?.[dayKey];

  if (daySchedule) {
    if (daySchedule.active === false) {
      return {
        statusCode: 'SHOP_CLOSED',
        available: false,
        reason: 'A barbearia está fechada nesta data.'
      };
    }
  } else {
    // operatingSchedule não tem essa chave (JSON incompleto/legado) — cai pro fallback
    // legado operatingDays, igual ao frontend (isDateOpenInProfile), pra não abrir um
    // dia que a UI mostra como fechado.
    const daysOfWeekIndex: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
    };
    const dayIndex = daysOfWeekIndex[dayKey] ?? 1;
    const operatingDays: number[] | undefined = shopProf.operatingDays;
    if (Array.isArray(operatingDays) && !operatingDays.includes(dayIndex)) {
      return {
        statusCode: 'SHOP_CLOSED',
        available: false,
        reason: 'A barbearia está fechada nesta data.'
      };
    }
  }

  const openMins = timeToMinutes(daySchedule?.open || shopProf.openTime || '09:00');
  const closeMins = timeToMinutes(daySchedule?.close || shopProf.closeTime || '21:00');

  // Antes de abrir ou muito além do encerramento (> 3 horas após fechamento)
  if (startMins < openMins || startMins >= closeMins + 180) {
    return {
      statusCode: 'SHOP_CLOSED',
      available: false,
      reason: 'A barbearia está fechada neste horário.'
    };
  }

  // Se o atendimento ultrapassa o horário normal de encerramento
  // (startMins >= closeMins já implica endMins > closeMins, dado que a duração é sempre > 0)
  const isOutsideHours = endMins > closeMins;
  const allowOutsideHours = shopProf.allowOutsideHoursApproval === true;

  // Toggle de admin desativado (padrão): horário que ultrapassa o fechamento
  // não é oferecido — nem com aprovação, simplesmente indisponível.
  if (isOutsideHours && !allowOutsideHours) {
    return {
      statusCode: 'SHOP_CLOSED',
      available: false,
      reason: 'Este horário ultrapassa o horário de funcionamento da barbearia.'
    };
  }

  // 3. Agendamentos do dia (não cancelados) — 4. Bloqueios de agenda do dia — 5. Profissionais ativos
  // (já resolvidos em `ctx`, buscados uma única vez por requisição/dia)
  const { allAppointments, allBlocks, activeProfs } = ctx;

  // Avaliação individual do profissional (verificando agendamentos e bloqueios)
  const evalSingleProf = (prof: any): { free: boolean; conflictReason?: string } => {
    // A. Conflito com agendamentos do profissional
    const profApts = allAppointments.filter((a: any) => a.professionalId === prof.id);
    for (const apt of profApts) {
      const aptStart = timeToMinutes(apt.timeSlot);
      const aptEnd = aptStart + Number(apt.totalDurationMinutes || 30);
      if (checkIntervalOverlap(startMins, endMins, aptStart, aptEnd)) {
        return { free: false, conflictReason: 'Horário já ocupado por outro agendamento.' };
      }
    }

    // B. Conflito com bloqueios do profissional
    const profBlocks = allBlocks.filter((b: any) => b.professionalId === prof.id);
    for (const blk of profBlocks) {
      const blkStart = timeToMinutes(blk.startTime || blk.start_time);
      const blkEnd = timeToMinutes(blk.endTime || blk.end_time);
      if (checkIntervalOverlap(startMins, endMins, blkStart, blkEnd)) {
        return { free: false, conflictReason: 'Horário bloqueado na agenda do profissional.' };
      }
    }

    return { free: true };
  };

  const targetProfId = profId && profId !== 'prof_any' ? profId : '';

  let result: CheckSlotResult;

  if (targetProfId) {
    const targetProf = activeProfs.find((p: any) => p.id === targetProfId);
    if (!targetProf) {
      result = {
        statusCode: 'PROFESSIONAL_UNAVAILABLE',
        available: false,
        reason: 'Profissional não encontrado ou inativo.'
      };
    } else {
      const evalRes = evalSingleProf(targetProf);
      if (!evalRes.free) {
        result = {
          statusCode: 'CONFIRMED_OCCUPIED',
          available: false,
          reason: evalRes.conflictReason || 'Horário indisponível para este profissional.'
        };
      } else if (isOutsideHours) {
        result = {
          statusCode: 'REQUIRES_APPROVAL',
          available: true,
          requiresApproval: true,
          isOutsideHours: true,
          chosenProf: targetProf,
          endMins,
          closeMins,
          reason: 'Este atendimento ultrapassa o horário normal de funcionamento. O administrador/barbeiro precisa confirmar se será possível realizar o atendimento.'
        };
      } else {
        result = {
          statusCode: 'AVAILABLE',
          available: true,
          requiresApproval: false,
          isOutsideHours: false,
          chosenProf: targetProf,
          endMins,
          closeMins
        };
      }
    }
  } else {
    // Para prof_any: procurar primeiro profissional livre
    const freeProfs = activeProfs.filter((p: any) => evalSingleProf(p).free);
    if (freeProfs.length === 0) {
      result = {
        statusCode: 'CONFIRMED_OCCUPIED',
        available: false,
        reason: 'Nenhum profissional disponível para realizar o atendimento neste horário.'
      };
    } else {
      const chosen = freeProfs[0];
      if (isOutsideHours) {
        result = {
          statusCode: 'REQUIRES_APPROVAL',
          available: true,
          requiresApproval: true,
          isOutsideHours: true,
          chosenProf: chosen,
          endMins,
          closeMins,
          reason: 'Este atendimento ultrapassa o horário normal de funcionamento. O administrador/barbeiro precisa confirmar se será possível realizar o atendimento.'
        };
      } else {
        result = {
          statusCode: 'AVAILABLE',
          available: true,
          requiresApproval: false,
          isOutsideHours: false,
          chosenProf: chosen,
          endMins,
          closeMins
        };
      }
    }
  }

  if (debug || process.env.NODE_ENV !== 'production') {
    console.log(`[AVAILABILITY_DEBUG] Date: ${dateStr} | Time: ${minutesToTime(startMins)}-${minutesToTime(endMins)} (Close: ${minutesToTime(closeMins)}) | Code: ${result.statusCode} | Available: ${result.available} | ReqApproval: ${!!result.requiresApproval} | Reason: ${result.reason || 'OK'}`);
  }

  return result;
}

app.get("/api/availability", async (req, res) => {
  try {
    const { professionalId, date, duration, excludeAppointmentId, debug } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Data não informada' });
    }

    const dateStr = String(date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: 'Formato de data inválido. Use AAAA-MM-DD.' });
    }
    const profIdStr = professionalId ? String(professionalId) : '';
    if (profIdStr && !/^[a-zA-Z0-9_-]+$/.test(profIdStr)) {
      return res.status(400).json({ error: 'Identificador de profissional inválido.' });
    }

    const excludeAptId = excludeAppointmentId ? String(excludeAppointmentId) : '';
    const reqDuration = Math.max(30, Number(duration || 30));
    const todayBRT = getTodayStringBRT();
    const currTimeBRT = getCurrentTimeBRT();

    // Busca uma única vez (shopSettings, agendamentos, bloqueios e profissionais do dia)
    // e reaproveita em memória para cada um dos ~24 slots candidatos abaixo, eliminando
    // o N+1 de consultas ao banco que antes rodava dentro de checkSlotAvailability por slot.
    const daySlotContext = await fetchDaySlotContext(dateStr, excludeAptId);
    const shopProf = daySlotContext.shopProf;
    const dayKey = getDayOfWeekKey(dateStr);
    const daySchedule = shopProf.operatingSchedule?.[dayKey];

    const openStr = daySchedule?.open || shopProf.openTime || '09:00';
    const closeStr = daySchedule?.close || shopProf.closeTime || '21:00';
    const openMins = timeToMinutes(openStr);
    const closeMins = timeToMinutes(closeStr);

    // Gera candidatos até o fechamento; se o toggle "horário fora de expediente
    // com aprovação" estiver ativo, estende 90min além pra permitir solicitação
    // sujeita a aprovação do barbeiro (checkSlotAvailability decide o resto).
    const allowOutsideHours = shopProf.allowOutsideHoursApproval === true;
    const slotsCutoff = allowOutsideHours ? closeMins + 90 : closeMins;
    const daySlots: string[] = [];
    for (let m = openMins; m < slotsCutoff; m += 30) {
      daySlots.push(minutesToTime(m));
    }

    const busySlots: string[] = [];
    const requiresApprovalSlots: string[] = [];
    const availableSlots: string[] = [];
    const detailedSlots: any[] = [];

    for (const slot of daySlots) {
      const startMins = timeToMinutes(slot);
      const checkRes = await checkSlotAvailability({
        dateStr,
        startMins,
        reqDuration,
        profId: profIdStr,
        excludeAptId,
        todayBRT,
        currTimeBRT,
        debug: debug === 'true',
        preloaded: daySlotContext
      });

      if (!checkRes.available) {
        busySlots.push(slot);
      } else if (checkRes.requiresApproval) {
        requiresApprovalSlots.push(slot);
      } else {
        availableSlots.push(slot);
      }

      detailedSlots.push({
        timeSlot: slot,
        statusCode: checkRes.statusCode,
        available: checkRes.available,
        requiresApproval: !!checkRes.requiresApproval,
        isOutsideHours: !!checkRes.isOutsideHours,
        reason: checkRes.reason,
        chosenProf: checkRes.chosenProf ? { id: checkRes.chosenProf.id, name: checkRes.chosenProf.name } : null
      });
    }

    if (req.query.format === 'legacy') {
      return res.json(busySlots.map(ts => ({ timeSlot: ts })));
    }

    return res.json({
      date: dateStr,
      busySlots,
      requiresApprovalSlots,
      availableSlots,
      slots: detailedSlots
    });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.get("/api/products", async (req, res) => {
  try {
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    const token = req.cookies.token || (authHeader && authHeader.split(' ')[1]);
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        isAdmin = decoded.role === 'admin';
      } catch(e) {}
    }

    let products = await db.query.products.findMany();

    if (!isAdmin) {
      products = products.map((p: any) => {
        const { costPrice, commissionPercentage, ...safeProduct } = p;
        return safeProduct;
      });
    }
    res.json(products);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.post("/api/products", requireAuth, requireAdmin, async (req, res) => {
  try {
    const newProd = { id: req.body.id || `prod_${Date.now()}`, ...req.body };
    await db.insert(schema.products).values(newProd).onConflictDoUpdate({
      target: schema.products.id,
      set: { ...req.body, updatedAt: new Date() }
    });
    res.json(newProd);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.put("/api/products/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const prodData = { id: req.params.id, ...req.body };
    await db.insert(schema.products).values(prodData).onConflictDoUpdate({
      target: schema.products.id,
      set: { ...req.body, updatedAt: new Date() }
    });
    res.json(prodData);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.delete("/api/products/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.delete(schema.products).where(eq(schema.products.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

// =====================================
// Auth & Profiles API
// =====================================

function formatProfile(p: any) {
  if (!p) return null;
  const { password, resetCodeHash, resetCodeExpiresAt, ...safe } = p;
  const avatar = safe.avatarUrl || safe.avatar_url || null;
  const points = safe.loyaltyPoints ?? safe.loyalty_points ?? 0;
  const tier = safe.loyaltyTier || safe.loyalty_tier || 'Bronze';
  return {
    ...safe,
    avatarUrl: avatar,
    avatar_url: avatar,
    loyaltyPoints: points,
    loyalty_points: points,
    loyaltyTier: tier,
    loyalty_tier: tier,
    themePalette: safe.themePalette || safe.theme_palette || 'heritage',
  };
}

app.get("/api/auth/me", requireAuth, async (req: any, res) => {
  try {
    const user = await db.query.profiles.findFirst({
      where: eq(schema.profiles.id, req.user.id)
    });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json(formatProfile(user));
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

const themePaletteSchema = z.object({
  palette: z.enum([
    'heritage', 'sapphire', 'emerald', 'amethyst', 'ruby', 'ocean', 'copper', 'rose', 'olive', 'slate',
    'amber', 'teal', 'indigo', 'crimson', 'bronze', 'violet', 'champagne', 'mint', 'coral', 'titanium',
    'onyx', 'pearl', 'sand', 'plum', 'electric', 'sage', 'terracotta', 'midnight', 'lavender', 'bordeaux'
  ]),
});

app.get("/api/preferences/theme", async (req: any, res) => {
  try {
    if (!isDbConnected || !db) {
      return res.status(503).json({ error: 'Banco de dados indisponível' });
    }

    let userPalette = null;
    const authHeader = req.headers.authorization;
    const token = req.cookies?.token || (authHeader && authHeader.split(' ')[1]);

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded?.id) {
          const user = await db.query.profiles.findFirst({
            where: eq(schema.profiles.id, decoded.id),
            columns: { themePalette: true },
          });
          if (user?.themePalette) {
            userPalette = user.themePalette;
          }
        }
      } catch (err) {}
    }

    if (userPalette) {
      return res.json({ palette: userPalette });
    }

    // Retorna tema configurado da barbearia para visitantes e clientes não logados
    const shop = await db.query.shopSettings.findFirst({
      where: eq(schema.shopSettings.id, 'default'),
      columns: { themePalette: true },
    });

    return res.json({ palette: shop?.themePalette || 'heritage' });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.put("/api/preferences/theme", requireAuth, async (req: any, res) => {
  try {
    if (!isDbConnected || !db) {
      return res.status(503).json({ error: 'Banco de dados indisponível' });
    }

    const parsed = themePaletteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Paleta de tema inválida.' });
    }

    const nextPalette = parsed.data.palette;

    const [updatedUser] = await db.update(schema.profiles)
      .set({ themePalette: nextPalette, updatedAt: new Date() })
      .where(eq(schema.profiles.id, req.user.id))
      .returning({ themePalette: schema.profiles.themePalette });

    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Se o usuário for admin ou profissional, sincroniza com a paleta padrão da barbearia
    if (req.user.role === 'admin' || req.user.role === 'professional') {
      try {
        await db.insert(schema.shopSettings)
          .values({ id: 'default', themePalette: nextPalette, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: schema.shopSettings.id,
            set: { themePalette: nextPalette, updatedAt: new Date() }
          });
      } catch (shopErr) {
        console.error("Erro ao atualizar tema da barbearia:", shopErr);
      }
    }

    return res.json({ success: true, palette: updatedUser.themePalette });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
  });
  res.json({ success: true });
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { loginId, password } = req.body;
    
    if (!loginId || !password) {
      return res.status(400).json({ error: 'E-mail/telefone e senha são obrigatórios.' });
    }

    const cleanLoginId = sanitizePhone(loginId);

    const user = await db.query.profiles.findFirst({
      where: or(
        eq(schema.profiles.email, loginId.toLowerCase()),
        cleanLoginId ? eq(schema.profiles.phone, cleanLoginId) : undefined
      )
    });

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Dados não encontrados ou credenciais inválidas.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Dados não encontrados ou credenciais inválidas.' });
    }

    const safeUser = formatProfile(user);
    
    // Generate JWT Token
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, phone: user.phone }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    setAuthCookie(res, token);

    res.json({
      ...safeUser,
      token: token,
    });
  } catch (e: any) {
    console.error('Error in POST /api/auth/login:', e);
    res.status(500).json({ error: 'Erro ao fazer login. Tente novamente.' });
  }
});

app.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
  try {
    const { loginId } = req.body;
    if (!loginId) {
      return res.status(400).json({ error: 'E-mail ou telefone é obrigatório.' });
    }
    const cleanLoginId = sanitizePhone(loginId);
    const user = await db.query.profiles.findFirst({
      where: or(
        eq(schema.profiles.email, loginId.toLowerCase()),
        cleanLoginId ? eq(schema.profiles.phone, cleanLoginId) : undefined
      )
    });

    if (user && user.phone) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codeHash = await bcrypt.hash(code, 10);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

      await db.update(schema.profiles)
        .set({ resetCodeHash: codeHash, resetCodeExpiresAt: expiresAt })
        .where(eq(schema.profiles.id, user.id));

      const msg = `🔑 *BARBERX PREMIUM*\n\nOlá, *${user.name}*!\n\nRecebemos uma solicitação de redefinição de senha para sua conta.\n\nUse o código de verificação: *${code}*\n\nEle expira em 10 minutos. Se não foi você quem solicitou, desconsidere esta mensagem.`;
      sendWhatsAppMessage(user.phone, msg).catch(() => {});
    }

    // Sempre responde sucesso (mesmo se o usuário não existir) para não vazar
    // quais e-mails/telefones estão cadastrados.
    res.json({
      success: true,
      message: 'Se o cadastro existir, um código de verificação foi enviado por WhatsApp.'
    });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
  try {
    const { loginId, code, newPassword } = req.body;
    if (!loginId || !code || !newPassword) {
      return res.status(400).json({ error: 'Código e nova senha são obrigatórios.' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
    }

    const cleanLoginId = sanitizePhone(loginId);
    const user = await db.query.profiles.findFirst({
      where: or(
        eq(schema.profiles.email, loginId.toLowerCase()),
        cleanLoginId ? eq(schema.profiles.phone, cleanLoginId) : undefined
      )
    });

    // Resposta genérica em caso de usuário/código inválido, para não vazar
    // se o e-mail/telefone existe na base.
    const invalidResponse = () => res.status(400).json({ error: 'Código inválido ou expirado.' });

    if (!user || !user.resetCodeHash || !user.resetCodeExpiresAt) {
      return invalidResponse();
    }
    if (new Date(user.resetCodeExpiresAt).getTime() < Date.now()) {
      return invalidResponse();
    }

    const codeMatches = await bcrypt.compare(String(code), user.resetCodeHash);
    if (!codeMatches) {
      return invalidResponse();
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update(schema.profiles)
      .set({ password: hashedPassword, resetCodeHash: null, resetCodeExpiresAt: null })
      .where(eq(schema.profiles.id, user.id));

    res.json({ success: true, message: 'Senha redefinida com sucesso.' });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.get("/api/profiles", requireAuth, async (req: any, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;

    if (isDbConnected && db) {
      try {
        const dbProfiles = await db.query.profiles.findMany();
        let safe = dbProfiles.map((p: any) => formatProfile(p));
        if (!isAdmin) {
          safe = safe.filter((p: any) => p.id === userId);
        }
        return res.json(safe);
      } catch (err) {}
    }
    
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.post("/api/profiles", authLimiter, async (req, res) => {
  try {
    const { name, email, phone, password, role, id, avatar_url, avatarUrl, lgpdConsent, lgpdConsentDate, ...rest } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório.' });
    }
    
    const cleanPhone = sanitizePhone(phone);
    const cleanEmail = email ? email.toLowerCase().trim() : '';

    const dbExisting = await db.query.profiles.findFirst({
      where: or(
        cleanEmail ? eq(schema.profiles.email, cleanEmail) : undefined,
        cleanPhone ? eq(schema.profiles.phone, cleanPhone) : undefined
      )
    });
    if (dbExisting) {
      return res.status(400).json({ error: 'E-mail ou telefone já cadastrado.' });
    }

    let hashedPassword = password;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const newId = crypto.randomUUID();
    const avatar = avatar_url || avatarUrl || rest.avatar_url || rest.avatarUrl || null;

    const dbProfile = {
      id: newId,
      name,
      email: cleanEmail,
      phone: cleanPhone || '',
      password: hashedPassword,
      role: 'client',
      avatarUrl: avatar,
      loyaltyPoints: 0,
      loyaltyTier: 'Bronze',
      lgpdConsent: Boolean(lgpdConsent),
      lgpdConsentDate: lgpdConsent ? (lgpdConsentDate ? new Date(lgpdConsentDate) : new Date()) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.insert(schema.profiles).values(dbProfile);

    const safeProfile = formatProfile(dbProfile);
    
    const token = jwt.sign(
      { id: safeProfile.id, role: safeProfile.role, email: safeProfile.email }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    setAuthCookie(res, token);

    res.json({
      ...safeProfile,
      token: token,
    });
  } catch (e: any) {
    console.error('Error in POST /api/profiles:', e);
    return handleError(res, e, req.path);
  }
});

app.put("/api/profiles/:id", requireAuth, async (req: any, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado: Você só pode editar o próprio perfil' });
    }
    
    const { password, role, id, avatar_url, avatarUrl, loyaltyPoints, loyalty_points, loyaltyTier, loyalty_tier, name, email, phone, ...rest } = req.body;
    
    let setObj: any = { updatedAt: new Date() };

    if (name !== undefined) setObj.name = name;
    if (email !== undefined) setObj.email = email.toLowerCase().trim();
    if (phone !== undefined) setObj.phone = sanitizePhone(phone);

    const avatar = avatar_url !== undefined ? avatar_url : avatarUrl;
    if (avatar !== undefined) {
      setObj.avatarUrl = avatar;
    }

    if (req.user.role === 'admin') {
      const points = loyaltyPoints ?? loyalty_points;
      if (points !== undefined) setObj.loyaltyPoints = points;
      const tier = loyaltyTier ?? loyalty_tier;
      if (tier !== undefined) setObj.loyaltyTier = tier;
    }

    if (password) {
      setObj.password = await bcrypt.hash(password, 10);
    }

    await db.update(schema.profiles).set(setObj).where(eq(schema.profiles.id, req.params.id));

    const updatedProfile = await db.query.profiles.findFirst({
      where: eq(schema.profiles.id, req.params.id)
    });

    res.json(formatProfile(updatedProfile || { id: req.params.id, ...setObj }));
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.delete("/api/profiles/:id", requireAuth, async (req: any, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado: Você só pode deletar o próprio perfil' });
    }
    
    await db.delete(schema.profiles).where(eq(schema.profiles.id, req.params.id));

    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

// =====================================
// Waiting Queue API
// =====================================
app.get("/api/queue", requireAuth, async (req: any, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;

    let dbQueue = await db.query.waitingQueue.findMany();
    if (!isAdmin) {
      dbQueue = dbQueue.filter((q: any) => q.clientId === userId);
    }
    return res.json(dbQueue);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.post("/api/queue", requireAuth, requireAdmin, async (req, res) => {
  try {
    const newItem = { id: req.body.id || `q_${Date.now()}`, joinedAt: new Date(), ...req.body };
    await db.insert(schema.waitingQueue).values(newItem);
    res.json(newItem);
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.put("/api/queue/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.update(schema.waitingQueue).set({ ...req.body }).where(eq(schema.waitingQueue.id, req.params.id));
    res.json({ id: req.params.id, ...req.body });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

app.delete("/api/queue/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.delete(schema.waitingQueue).where(eq(schema.waitingQueue.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});

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


async function seedDatabase() {
  const defaultPasswordHash = await bcrypt.hash('client123', 10);
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const todayStr = getTodayStringBRT();

  const seedProfiles = [
    {
      id: 'usr_admin',
      name: 'BarberX Admin',
      email: 'admin@barberx.app',
      password: adminPasswordHash,
      phone: '5511999998888',
      role: 'admin',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=250',
      loyaltyPoints: 1000,
      loyaltyTier: 'Diamante'
    },
    {
      id: 'usr_771902',
      name: 'Tauan Pires',
      email: 'tauan.pires@barberx.app',
      password: defaultPasswordHash,
      phone: '5511987654321',
      role: 'client',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
      loyaltyPoints: 480,
      loyaltyTier: 'Ouro Metálico'
    },
    {
      id: 'usr_882191',
      name: 'Lucas Ferreira',
      email: 'lucas@example.com',
      password: defaultPasswordHash,
      phone: '5511977112233',
      role: 'client',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
      loyaltyPoints: 150,
      loyaltyTier: 'Prata'
    },
    {
      id: 'usr_331092',
      name: 'Rodrigo Mendonça',
      email: 'rodrigo@example.com',
      password: defaultPasswordHash,
      phone: '5511911223344',
      role: 'client',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250',
      loyaltyPoints: 210,
      loyaltyTier: 'Prata'
    }
  ];

  const seedProfessionals = [
    {
      id: 'prof_1',
      name: 'Carlos Silva',
      nickname: 'Carlão Navalha',
      roleTitle: 'Master Barber',
      rating: '4.90',
      reviewsCount: 142,
      photoUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=300',
      specialties: ['Corte Clássico', 'Degradê (Fade)', 'Barba Imperial'],
      commissionRate: '0.40',
      isActive: true,
      workingHours: { monday: '09:00-20:00', tuesday: '09:00-20:00', wednesday: '09:00-20:00', thursday: '09:00-20:00', friday: '09:00-20:00', saturday: '08:00-20:00', sunday: '10:00-16:00' }
    },
    {
      id: 'prof_2',
      name: 'Matheus Santos',
      nickname: 'Matheuzinho',
      roleTitle: 'Specialist Barber',
      rating: '4.80',
      reviewsCount: 98,
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
      specialties: ['Barba Terapia', 'Design de Sobrancelhas', 'Freestyle'],
      commissionRate: '0.35',
      isActive: true,
      workingHours: { monday: '09:00-20:00', tuesday: '09:00-20:00', wednesday: '09:00-20:00', thursday: '09:00-20:00', friday: '09:00-20:00', saturday: '08:00-20:00', sunday: '10:00-16:00' }
    },
    {
      id: 'prof_3',
      name: 'Gabriel Santos',
      nickname: 'Gabi Hair',
      roleTitle: 'Stylist Barber',
      rating: '4.95',
      reviewsCount: 180,
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300',
      specialties: ['Corte Moderno', 'Pigmentação', 'Platinado'],
      commissionRate: '0.38',
      isActive: true,
      workingHours: { monday: '09:00-20:00', tuesday: '09:00-20:00', wednesday: '09:00-20:00', thursday: '09:00-20:00', friday: '09:00-20:00', saturday: '08:00-20:00', sunday: '10:00-16:00' }
    },
    {
      id: 'prof_4',
      name: 'Bruno Oliveira',
      nickname: 'Brunão do Corte',
      roleTitle: 'Senior Barber',
      rating: '4.85',
      reviewsCount: 115,
      photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=300',
      specialties: ['Corte Tesoura', 'Nevou', 'Barba Modelada'],
      commissionRate: '0.35',
      isActive: true,
      workingHours: { monday: '09:00-20:00', tuesday: '09:00-20:00', wednesday: '09:00-20:00', thursday: '09:00-20:00', friday: '09:00-20:00', saturday: '08:00-20:00', sunday: '10:00-16:00' }
    },
    {
      id: 'prof_5',
      name: 'Rafael Costa',
      nickname: 'Rafa Navalhete',
      roleTitle: 'Specialist Barber',
      rating: '4.92',
      reviewsCount: 156,
      photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=300',
      specialties: ['Fade Americano', 'Selagem', 'Tratamento Capilar'],
      commissionRate: '0.38',
      isActive: true,
      workingHours: { monday: '09:00-20:00', tuesday: '09:00-20:00', wednesday: '09:00-20:00', thursday: '09:00-20:00', friday: '09:00-20:00', saturday: '08:00-20:00', sunday: '10:00-16:00' }
    }
  ];

  const seedServices: any[] = [
    // COMBOS (4)
    {
      id: 'srv_combo_1',
      categorySlug: 'combos',
      title: 'Combo Executivo: Corte + Barba Imperial',
      description: 'Corte de cabelo completo à sua escolha combinado com barboterapia toalha quente e massagem facial.',
      price: '95.00',
      durationMinutes: 50,
      isCombo: true,
      originalPrice: '110.00',
      discountPercentage: 14,
      isPopular: true,
      imageUrl: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 'srv_combo_2',
      categorySlug: 'combos',
      title: 'Combo Barão: Corte + Barba + Sobrancelha',
      description: 'Pacote VIP completo com lavagem especial, corte estilizado, barba completa e alinhamento de sobrancelha na navalha.',
      price: '115.00',
      durationMinutes: 60,
      isCombo: true,
      originalPrice: '135.00',
      discountPercentage: 15,
      isPopular: true,
      imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 'srv_combo_3',
      categorySlug: 'combos',
      title: 'Combo Pai e Filho (2 Cortes)',
      description: 'Atendimento simultâneo ou em sequência para pai e filho com desconto exclusivo e bebida cortesia.',
      price: '100.00',
      durationMinutes: 60,
      isCombo: true,
      originalPrice: '120.00',
      discountPercentage: 16,
      isPopular: false,
      imageUrl: 'https://images.unsplash.com/photo-1517832606589-715006d319a2?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 'srv_combo_4',
      categorySlug: 'combos',
      title: 'Combo Dia do Noivo / Evento VIP',
      description: 'Experiência premium com corte, barba, selagem capilar, sobrancelha, bebida especial e hidratação.',
      price: '180.00',
      durationMinutes: 90,
      isCombo: true,
      originalPrice: '220.00',
      discountPercentage: 18,
      isPopular: false,
      imageUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=80&w=400'
    },
    // CORTES (5)
    {
      id: 'srv_corte_1',
      categorySlug: 'cortes',
      title: 'Corte Moderno / Fade / Mid Fade',
      description: 'Degradê de precisão técnica (Low, Mid, High Fade) finalizado com pomada matte de alta fixação.',
      price: '60.00',
      durationMinutes: 35,
      isCombo: false,
      isPopular: true,
      imageUrl: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 'srv_corte_2',
      categorySlug: 'cortes',
      title: 'Corte Clássico Tesoura',
      description: 'Corte tradicional executado 100% na tesoura para quem busca elegância e caimento natural.',
      price: '55.00',
      durationMinutes: 40,
      isCombo: false,
      isPopular: false,
      imageUrl: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 'srv_corte_3',
      categorySlug: 'cortes',
      title: 'Corte Infantil (Até 12 anos)',
      description: 'Atendimento paciente e especializado para crianças com ambiente descontraído.',
      price: '50.00',
      durationMinutes: 30,
      isCombo: false,
      isPopular: false,
      imageUrl: 'https://images.unsplash.com/photo-1517832606589-715006d319a2?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 'srv_corte_4',
      categorySlug: 'cortes',
      title: 'Raspar / Maquinado Simples',
      description: 'Corte rápido com máquina em tamanho único na cabeça inteira, acerto de pezinho incluso.',
      price: '35.00',
      durationMinutes: 20,
      isCombo: false,
      isPopular: false,
      imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 'srv_corte_5',
      categorySlug: 'cortes',
      title: 'Pezinho / Acabamento de Contorno',
      description: 'Apenas a manutenção do contorno do pescoço e orelhas na navalha para manter o visual limpo.',
      price: '25.00',
      durationMinutes: 15,
      isCombo: false,
      isPopular: false,
      imageUrl: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&q=80&w=400'
    },
    // BARBA (3)
    {
      id: 'srv_barba_1',
      categorySlug: 'barba',
      title: 'Barboterapia Terapêutica',
      description: 'Ritual clássico com vapor de ozônio, toalha quente com essências, bálsamo hidratante e alinhamento na navalha.',
      price: '50.00',
      durationMinutes: 30,
      isCombo: false,
      isPopular: true,
      imageUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 'srv_barba_2',
      categorySlug: 'barba',
      title: 'Barba Simples e Desenho',
      description: 'Desenho e aparo da barba com máquina e navalha de lâmina descartável.',
      price: '40.00',
      durationMinutes: 25,
      isCombo: false,
      isPopular: false,
      imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 'srv_barba_3',
      categorySlug: 'barba',
      title: 'Modelagem de Barba com Toalha Quente',
      description: 'Abertura dos poros com toalha aquecida e loção pós-barba acalmante para pele sensível.',
      price: '45.00',
      durationMinutes: 30,
      isCombo: false,
      isPopular: false,
      imageUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&q=80&w=400'
    },
    // QUIMICA (3)
    {
      id: 'srv_quimica_1',
      categorySlug: 'quimica',
      title: 'Platinado / Nevou Premium',
      description: 'Descoloração global profissional com matização e reconstrução capilar inclusa.',
      price: '130.00',
      durationMinutes: 90,
      isCombo: false,
      isPopular: true,
      imageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 'srv_quimica_2',
      categorySlug: 'quimica',
      title: 'Pigmentação de Cabelo e Barba',
      description: 'Disfarce de fios brancos e falhas com tinta hipoalergênica de efeito natural.',
      price: '60.00',
      durationMinutes: 30,
      isCombo: false,
      isPopular: false,
      imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 'srv_quimica_3',
      categorySlug: 'quimica',
      title: 'Selagem / Alisamento Capilar',
      description: 'Redução do volume, frizz e hidratação profunda com aminoácidos e queratina.',
      price: '90.00',
      durationMinutes: 60,
      isCombo: false,
      isPopular: false,
      imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400'
    }
  ];

  const seedProducts = [
    {
      id: 'prod_1',
      name: 'Pomada Efeito Matte Extra Forte 100g',
      category: 'Finalizadores',
      brand: 'BarberX Pro',
      price: '45.00',
      costPrice: '18.00',
      stockQuantity: 32,
      minStockAlert: 5,
      commissionPercentage: 15,
      imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=300'
    },
    {
      id: 'prod_2',
      name: 'Óleo para Barba Wood & Spice 30ml',
      category: 'Barba',
      brand: 'BarberX Care',
      price: '55.00',
      costPrice: '22.00',
      stockQuantity: 18,
      minStockAlert: 5,
      commissionPercentage: 10,
      imageUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&q=80&w=300'
    },
    {
      id: 'prod_3',
      name: 'Shampoo Mentolado Antiqueda 250ml',
      category: 'Cabelo',
      brand: 'BarberX Pro',
      price: '68.00',
      costPrice: '28.00',
      stockQuantity: 24,
      minStockAlert: 6,
      commissionPercentage: 12,
      imageUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=80&w=300'
    }
  ];

  const seedAppointments = [
    {
      id: 'apt_101',
      clientId: 'usr_771902',
      clientName: 'Tauan Pires',
      clientPhone: '5511987654321',
      professionalId: 'prof_1',
      professionalName: 'Carlos Silva',
      date: todayStr,
      timeSlot: '15:00',
      status: 'in_queue',
      totalDurationMinutes: 50,
      originalAmount: '110.00',
      discountAmount: '15.00',
      finalAmount: '95.00',
      paymentMethod: 'credit_card',
      services: [{ id: 'srv_combo_1', title: 'Combo Executivo: Corte + Barba Imperial', price: 95.00 }],
      createdAt: new Date().toISOString()
    },
    {
      id: 'apt_102',
      clientId: 'usr_882191',
      clientName: 'Lucas Ferreira',
      clientPhone: '5511977112233',
      professionalId: 'prof_2',
      professionalName: 'Matheus Santos',
      date: todayStr,
      timeSlot: '14:30',
      status: 'in_service',
      totalDurationMinutes: 35,
      originalAmount: '60.00',
      discountAmount: '0.00',
      finalAmount: '60.00',
      paymentMethod: 'pix',
      services: [{ id: 'srv_corte_1', title: 'Corte Moderno / Fade / Mid Fade', price: 60.00 }],
      createdAt: new Date().toISOString()
    },
    {
      id: 'apt_103',
      clientId: 'usr_331092',
      clientName: 'Rodrigo Mendonça',
      clientPhone: '5511911223344',
      professionalId: 'prof_1',
      professionalName: 'Carlos Silva',
      date: todayStr,
      timeSlot: '16:00',
      status: 'confirmed',
      totalDurationMinutes: 30,
      originalAmount: '50.00',
      discountAmount: '0.00',
      finalAmount: '50.00',
      paymentMethod: 'credit_card',
      services: [{ id: 'srv_barba_1', title: 'Barboterapia Terapêutica', price: 50.00 }],
      createdAt: new Date().toISOString()
    },
    {
      id: 'apt_104',
      clientId: 'usr_771902',
      clientName: 'Tauan Pires',
      clientPhone: '5511987654321',
      professionalId: 'prof_3',
      professionalName: 'Gabriel Santos',
      date: '2026-07-20',
      timeSlot: '11:00',
      status: 'completed',
      totalDurationMinutes: 35,
      originalAmount: '60.00',
      discountAmount: '0.00',
      finalAmount: '60.00',
      paymentMethod: 'pix',
      services: [{ id: 'srv_corte_1', title: 'Corte Moderno / Fade / Mid Fade', price: 60.00 }],
      createdAt: new Date('2026-07-20T11:00:00Z').toISOString()
    }
  ];

  const seedWaitingQueue = [
    {
      id: 'q_1',
      appointmentId: 'apt_102',
      clientId: 'usr_882191',
      clientName: 'Lucas Ferreira',
      professionalId: 'prof_2',
      serviceTitle: 'Corte Moderno Fade',
      status: 'in_chair',
      estimatedWaitMinutes: 0
    },
    {
      id: 'q_2',
      appointmentId: 'apt_101',
      clientId: 'usr_771902',
      clientName: 'Tauan Pires (Você)',
      professionalId: 'prof_1',
      serviceTitle: 'Combo Executivo: Corte + Barba',
      status: 'waiting',
      estimatedWaitMinutes: 15
    },
    {
      id: 'q_3',
      appointmentId: 'apt_103',
      clientId: 'usr_331092',
      clientName: 'Rodrigo Mendonça',
      professionalId: 'prof_1',
      serviceTitle: 'Barboterapia Terapêutica',
      status: 'waiting',
      estimatedWaitMinutes: 45
    }
  ];

  if (isDbConnected && db) {
    for (const item of seedProfiles) {
      try {
        await db.delete(schema.profiles).where(eq(schema.profiles.id, item.id));
        await db.insert(schema.profiles).values(item);
      } catch (e: any) {
        console.warn(`[Seed] Profile ${item.id} error:`, e.message);
      }
    }
    for (const item of seedProfessionals) {
      try {
        await db.delete(schema.professionals).where(eq(schema.professionals.id, item.id));
        await db.insert(schema.professionals).values(item);
      } catch (e: any) {
        console.warn(`[Seed] Professional ${item.id} error:`, e.message);
      }
    }
    for (const item of seedServices) {
      try {
        await db.delete(schema.services).where(eq(schema.services.id, item.id));
        await db.insert(schema.services).values(item);
      } catch (e: any) {
        console.warn(`[Seed] Service ${item.id} error:`, e.message);
      }
    }
    for (const item of seedProducts) {
      try {
        await db.delete(schema.products).where(eq(schema.products.id, item.id));
        await db.insert(schema.products).values(item);
      } catch (e: any) {
        console.warn(`[Seed] Product ${item.id} error:`, e.message);
      }
    }
    for (const item of seedAppointments) {
      try {
        await db.delete(schema.appointments).where(eq(schema.appointments.id, item.id));
        const dbApt = {
          id: item.id,
          clientId: item.clientId,
          clientName: item.clientName,
          clientPhone: item.clientPhone,
          professionalId: item.professionalId,
          professionalName: item.professionalName,
          date: item.date,
          timeSlot: item.timeSlot,
          status: item.status,
          totalDurationMinutes: item.totalDurationMinutes,
          originalAmount: item.originalAmount,
          discountAmount: item.discountAmount,
          finalAmount: item.finalAmount,
          paymentMethod: item.paymentMethod,
          services: item.services,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date()
        };
        await db.insert(schema.appointments).values(dbApt);
      } catch (e: any) {
        console.warn(`[Seed] Appointment ${item.id} error:`, e.message);
      }
    }
    for (const item of seedWaitingQueue) {
      try {
        await db.delete(schema.waitingQueue).where(eq(schema.waitingQueue.id, item.id));
        await db.insert(schema.waitingQueue).values(item);
      } catch (e: any) {
        console.warn(`[Seed] WaitingQueue ${item.id} error:`, e.message);
      }
    }
  }



  return {
    profiles: seedProfiles.length,
    professionals: seedProfessionals.length,
    services: seedServices.length,
    products: seedProducts.length,
    appointments: seedAppointments.length,
    queue: seedWaitingQueue.length
  };
}

app.post("/api/seed", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const result = await seedDatabase();
    res.json({ success: true, seeded: result });
  } catch (e: any) {
    return handleError(res, e, 'POST /api/seed');
  }
});

app.get("/api/system/status", requireAuth, requireAdmin, (req, res) => {
  res.json({
    databaseConnected: isDbConnected,
    databaseType: 'PostgreSQL',
    timestamp: new Date().toISOString()
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

async function processAppointmentCompletion(appointment: any) {
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