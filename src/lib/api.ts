const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
export const API_BASE = configuredApiBase.replace(/\/$/, '');

export async function readApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const body = await response.text();

  if (!contentType.includes('application/json')) {
    throw new Error(
      `A API respondeu HTML/texto em ${response.url || 'rota desconhecida'} ` +
      `(HTTP ${response.status}). Verifique se o endpoint existe e se o rewrite /api está correto.`
    );
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

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('navo:auth-expired'));
  }

  return response;
};
