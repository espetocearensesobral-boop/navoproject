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

  // Erro genérico
  return res.status(500).json({ error: userErrors.generic });
};
