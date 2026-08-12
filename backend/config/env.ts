import crypto from 'crypto';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn("WARNING: JWT_SECRET environment variable is not defined. Using an insecure default key (NOT RECOMMENDED FOR PRODUCTION). Please configure it in Vercel.");
}

export const JWT_SECRET = process.env.JWT_SECRET || 'insecure_default_secret_for_development_only_1234567890';

