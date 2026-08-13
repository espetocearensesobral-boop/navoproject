import crypto from 'crypto';

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
if (!process.env.JWT_SECRET && isProduction) {
  throw new Error('JWT_SECRET must be configured in production.');
}
if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not defined. Using an ephemeral development key.');
}

export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
