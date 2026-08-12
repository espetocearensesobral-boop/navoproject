export const corsMiddleware = (req: any, res: any, next: any) => {
  const origin = req.headers.origin;
  const host = req.headers.host || '';

  const isAllowedOrigin = 
    !origin ||
    origin.includes('navopremium.vercel.app') ||
    origin.endsWith('.vercel.app') ||
    origin.endsWith('.run.app') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    (host && origin.includes(host));

  if (origin && isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token');
    res.setHeader('Access-Control-Expose-Headers', 'X-Auth-Token');
  }

  if (req.method === 'OPTIONS') {
    if (origin && isAllowedOrigin) {
      return res.status(204).end();
    }
    return res.status(403).end();
  }

  next();
};

export const validateOrigin = (req: any, res: any, next: any) => {
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
