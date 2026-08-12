const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
export const API_BASE = configuredApiBase.replace(/\/$/, '');

let inMemoryStorage: Record<string, string> = {};

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      // Storage access blocked by browser tracking prevention in iframe
    }
    return inMemoryStorage[key] || null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      // Storage access blocked by browser tracking prevention in iframe
    }
    inMemoryStorage[key] = value;
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      // Storage access blocked by browser tracking prevention in iframe
    }
    delete inMemoryStorage[key];
  }
};

export const getStoredToken = (): string | null => {
  return safeLocalStorage.getItem('auth_token');
};

export const setStoredToken = (token: string | null | undefined) => {
  if (token) {
    safeLocalStorage.setItem('auth_token', token);
  } else {
    safeLocalStorage.removeItem('auth_token');
  }
};

export const clearStoredToken = () => {
  safeLocalStorage.removeItem('auth_token');
};

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
  const token = getStoredToken();
  const headers: any = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  
  if (response.status === 401) {
    // Stale token, clear token storage
    clearStoredToken();
  }
  
  return response;
};


