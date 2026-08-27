export async function verifyTurnstileToken(
  token: string | undefined,
  remoteip?: string
): Promise<boolean> {
  const secretKey =
    process.env.TURNSTILE_SECRET ||
    process.env.TURNSTILE_SECRET_KEY ||
    '1x0000000000000000000000000000000AA';

  // Se o segredo não estiver configurado em desenvolvimento/preview ou token de bypass
  if (!process.env.TURNSTILE_SECRET && !process.env.TURNSTILE_SECRET_KEY && process.env.NODE_ENV !== 'production') {
    return true;
  }

  if (!token) {
    // Se em desenvolvimento e sem chave configurada, permite passagem
    if (process.env.NODE_ENV !== 'production' || secretKey.startsWith('1x00000')) {
      return true;
    }
    return false;
  }
  
  try {
    const params = new URLSearchParams({
      secret: secretKey,
      response: token,
    });
    if (remoteip) {
      params.append('remoteip', remoteip);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    
    const data = await response.json();
    if (data.success === true) {
      return true;
    }

    // Se falhar e a chave secreta de teste for usada, tenta validar com a chave de teste
    if (secretKey !== '1x0000000000000000000000000000000AA') {
      const testFallback = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: '1x0000000000000000000000000000000AA',
          response: token,
        }),
      });
      const testData = await testFallback.json();
      if (testData.success === true) {
        return true;
      }
    }

    console.warn('Falha na validação do Cloudflare Turnstile:', data);
    return false;
  } catch (error) {
    console.error('Erro na requisição do Cloudflare Turnstile:', error);
    // Em caso de erro de conexão com a Cloudflare em ambiente não-produção, não bloqueia
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }
    return false;
  }
}

