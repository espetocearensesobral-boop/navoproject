import crypto from 'crypto';

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
if (!process.env.JWT_SECRET && isProduction) {
  throw new Error('JWT_SECRET must be configured in production.');
}
if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not defined. Using an ephemeral development key.');
}

export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// Web Push: a chave privada permanece exclusivamente no backend/Vercel.
export const WEB_PUSH_VAPID_PUBLIC_KEY = process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '';
export const WEB_PUSH_VAPID_PRIVATE_KEY = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || '';
export const WEB_PUSH_VAPID_SUBJECT = process.env.WEB_PUSH_VAPID_SUBJECT || 'mailto:admin@navoproject.com';
