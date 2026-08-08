export const API_BASE = '';

export const authFetch = async (endpoint: string, options: RequestInit = {}) => {
  
  const headers: any = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  
  if (response.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/') {
    window.location.href = '/';
  }
  
  return response;
};
