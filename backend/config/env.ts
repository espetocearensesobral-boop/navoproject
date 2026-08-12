import crypto from 'crypto';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error("FATAL: JWT_SECRET não está definido nas variáveis de ambiente em produção. Configure JWT_SECRET no Vercel.");
  process.exit(1);
}

export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
