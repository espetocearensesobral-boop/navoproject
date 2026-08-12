import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per windowMs
  message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login/signup requests
  message: { error: 'Muitas tentativas de login. Tente novamente mais tarde.' }
});

export const sensitiveOpsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas operações sensíveis. Aguarde alguns minutos.' }
});
