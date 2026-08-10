export const API_BASE = '';

export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
};

export const setStoredToken = (token: string | null | undefined) => {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

export const clearStoredToken = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
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

