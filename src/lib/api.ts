export const API_BASE = '';

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


