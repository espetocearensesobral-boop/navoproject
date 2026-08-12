import crypto from 'crypto';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn("WARNING: JWT_SECRET environment variable is not defined in production. Generating a random key for this session. Logins will expire on the next server cold-start. Please configure JWT_SECRET in Vercel.");
}

export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
