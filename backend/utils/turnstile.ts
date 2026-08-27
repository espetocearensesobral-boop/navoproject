export async function verifyTurnstileToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  
  const secretKey = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';
  
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token
      })
    });
    
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Erro na validação do Turnstile:', error);
    return false;
  }
}
