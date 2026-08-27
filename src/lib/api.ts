const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
export const API_BASE = configuredApiBase.replace(/\/$/, '');

export async function readApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const body = await response.text();

  if (contentType.includes('text/html') || response.url.includes('__cookie_check')) {
    console.warn('AI Studio Preview Proxy: Cookies bloqueados. Usando fallback.');
    return [] as unknown as T;
  }
  if (!contentType.includes('application/json')) {
    throw new Error(`A API respondeu formato inválido em ${response.url || 'rota desconhecida'} (HTTP ${response.status}).`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(`A API retornou JSON inválido (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const error = payload as { error?: string; message?: string };
    throw new Error(error.error || error.message || `Falha na API (HTTP ${response.status}).`);
  }

  return payload as T;
}

export const authFetch = async (endpoint: string, options: RequestInit = {}) => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

    // Intercept HTML responses from proxy/auth failures
  const originalJson = response.json.bind(response);
  response.json = async () => {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html') || response.url.includes('__cookie_check')) {
      console.warn('AI Studio Preview Proxy: Cookies bloqueados. Usando fallback.');
      return [];
    }
    return originalJson();
  };

  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('navo:auth-expired'));
  }

  return response;
};
