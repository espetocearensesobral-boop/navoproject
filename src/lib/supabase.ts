import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const SUPABASE_URL = env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || '';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const isSupabaseConfigured = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);

export interface ConnectionStatus {
  connected: boolean;
  mode: 'real';
  url: string;
  latencyMs: number;
  message: string;
}

// Health Check Utility for Real Supabase Database
export async function testSupabaseConnection(): Promise<ConnectionStatus> {
  const startTime = performance.now();
  
  try {
    const res = await fetch('/api/services');
    const latencyMs = Math.round(performance.now() - startTime);
    
    if (!res.ok) {
      return {
        connected: false,
        mode: 'real',
        url: SUPABASE_URL || 'Supabase PostgreSQL',
        latencyMs,
        message: `Erro na conexão com o Banco de Dados Real do Supabase: ${res.statusText}`
      };
    }
    
    return {
      connected: true,
      mode: 'real',
      url: SUPABASE_URL || 'Supabase PostgreSQL',
      latencyMs,
      message: `Conectado ao Banco de Dados Real do Supabase em ${latencyMs}ms!`
    };
  } catch (err: any) {
    return {
      connected: false,
      mode: 'real',
      url: SUPABASE_URL || 'Supabase PostgreSQL',
      latencyMs: 999,
      message: `Falha na requisição para o Supabase: ${err?.message || 'Verifique a conexão de rede'}`
    };
  }
}

