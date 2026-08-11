import crypto from 'crypto';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  // Em produção (especialmente serverless), um segredo gerado em memória muda a
  // cada cold start e invalida sessões de usuários aleatoriamente. Falhar cedo
  // e de forma explícita é mais seguro do que operar com esse comportamento.
  console.error("FATAL: JWT_SECRET não está definido. Configure a variável de ambiente JWT_SECRET antes de iniciar em produção.");
  process.exit(1);
}

export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

if (!process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET environment variable is not defined. Using auto-generated secure key in memory (apenas aceitável em desenvolvimento).");
}
