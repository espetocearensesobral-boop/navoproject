export const userErrors = {
  dbDisconnected: 'Serviço temporariamente indisponível. Por favor, tente novamente em alguns instantes.',
  unauthorized: 'Sessão expirada. Faça login novamente.',
  forbidden: 'Você não tem permissão para realizar esta ação.',
  notFound: 'Recurso não encontrado.',
  conflict: 'Conflito de dados. Verifique as informações e tente novamente.',
  validation: 'Dados inválidos. Verifique os campos e tente novamente.',
  generic: 'Ocorreu um erro inesperado. Nossa equipe já foi notificada.',
};

export const handleError = (res: any, e: any, context: string) => {
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

  const statusCode = e?.status || e?.statusCode || 400;

  // Extrai a mensagem de erro fornecida
  const errorMsg = typeof e === 'string' ? e : (e?.message || e?.error);

  if (typeof errorMsg === 'string' && errorMsg.trim().length > 0) {
    const trimmed = errorMsg.trim();
    // Filtra rigorosamente mensagens técnicas internas e consultas SQL vazadas
    const lowerMsg = trimmed.toLowerCase();
    const isTechnicalInternal = 
      lowerMsg.includes('failed query') ||
      lowerMsg.includes('select ') ||
      lowerMsg.includes('insert ') ||
      lowerMsg.includes('update ') ||
      lowerMsg.includes('delete ') ||
      lowerMsg.includes('params:') ||
      lowerMsg.includes('from "') ||
      lowerMsg.includes('relation ') ||
      lowerMsg.includes('column ') ||
      lowerMsg.includes('drizzle') || 
      lowerMsg.includes('postgres') || 
      lowerMsg.includes('pg_') || 
      lowerMsg.includes('econnrefused') || 
      lowerMsg.includes('enotfound') || 
      lowerMsg.includes('typeerror') || 
      lowerMsg.includes('referenceerror') || 
      lowerMsg.includes('syntaxerror');

    if (!isTechnicalInternal) {
      return res.status(statusCode).json({ error: trimmed });
    }
  }

  // Erro genérico para exceções internas de sistema não tratadas (ex: falhas de banco ou SQL)
  return res.status(500).json({ error: 'Não foi possível concluir a solicitação. Tente novamente mais tarde.' });
};

