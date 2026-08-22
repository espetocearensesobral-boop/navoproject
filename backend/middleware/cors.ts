const configuredOrigins = [
  process.env.PUBLIC_APP_ORIGIN,
  process.env.APP_URL,
  'https://navopremium.vercel.app',
]
  .filter(Boolean)
  .map((value) => normalizeOrigin(value as string));

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function isLocalOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string | undefined, host: string): boolean {
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;

  if (configuredOrigins.includes(normalized)) return true;
  if (process.env.NODE_ENV !== 'production' && isLocalOrigin(normalized)) return true;

  try {
    return new URL(normalized).host === host;
  } catch {
    return false;
  }
}

export const corsMiddleware = (req: any, res: any, next: any) => {
  const origin = req.headers.origin;
  const host = req.headers.host || '';
  const allowed = isAllowedOrigin(origin, host);

  if (origin && allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token');
    res.setHeader('Access-Control-Expose-Headers', 'X-Auth-Token');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    return allowed ? res.status(204).end() : res.status(403).json({ error: 'Origem não autorizada' });
  }

  next();
};

export const validateOrigin = (req: any, res: any, next: any) => {
  const origin = req.headers.origin || req.headers.referer || '';
  const host = req.headers.host || '';

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && origin && !isAllowedOrigin(origin, host)) {
    console.warn(`[SECURITY] Blocked request from origin: ${origin}`);
    return res.status(403).json({ error: 'Origem não autorizada' });
  }

  next();
};
