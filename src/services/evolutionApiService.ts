import { authFetch } from '../lib/api';

export interface EvolutionApiSettings {
  enabled: boolean;
  baseUrl: string;
  instanceName: string;
  webhookEnabled: boolean;
  webhookUrl: string;
  hasWebhookSecret: boolean;
  hasApiKey: boolean;
  navoBotEnabled: boolean;
  useInteractiveMessages: boolean;
}

export interface EvolutionApiSettingsInput {
  enabled: boolean;
  baseUrl: string;
  instanceName: string;
  webhookEnabled: boolean;
  webhookUrl: string;
  navoBotEnabled: boolean;
  useInteractiveMessages: boolean;
  apiKey?: string;
  webhookSecret?: string;
}

export interface NavoBotAiTestResult {
  ok: boolean;
  configured: boolean;
  usedGemini: boolean;
  model: string;
  latencyMs: number;
  response?: string;
  message: string;
}

export interface EvolutionApiStatus {
  configured: boolean;
  reachable: boolean;
  instanceName: string;
  instanceStatus: string;
  instanceExists?: boolean;
  message: string;
}

export const defaultEvolutionApiSettings: EvolutionApiSettings = {
  enabled: false,
  baseUrl: '',
  instanceName: '',
  webhookEnabled: false,
  webhookUrl: '',
  hasWebhookSecret: false,
  hasApiKey: false,
  navoBotEnabled: false,
  useInteractiveMessages: false,
};

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || data?.message || fallback);
  return data as T;
}

export async function fetchEvolutionApiSettings(): Promise<EvolutionApiSettings> {
  const response = await authFetch('/api/evolution/config');
  const data = await parseResponse<Partial<EvolutionApiSettings>>(response, 'Não foi possível carregar a configuração da Evolution API.');
  return { ...defaultEvolutionApiSettings, ...data };
}

export async function saveEvolutionApiSettings(data: EvolutionApiSettingsInput): Promise<EvolutionApiSettings> {
  const response = await authFetch('/api/evolution/config', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  const payload = await parseResponse<{ config?: EvolutionApiSettings }>(response, 'Não foi possível salvar a configuração da Evolution API.');
  return { ...defaultEvolutionApiSettings, ...(payload.config || {}) };
}

export async function fetchEvolutionApiStatus(): Promise<EvolutionApiStatus> {
  const response = await authFetch('/api/evolution/status');
  return parseResponse<EvolutionApiStatus>(response, 'Não foi possível consultar a Evolution API.');
}

export async function testEvolutionApi(): Promise<string> {
  const response = await authFetch('/api/evolution/test', { method: 'POST' });
  const data = await parseResponse<{ message?: string }>(response, 'Não foi possível testar a Evolution API.');
  return data.message || 'Conexão testada.';
}

export async function applyEvolutionWebhook(): Promise<string> {
  const response = await authFetch('/api/evolution/webhook/apply', { method: 'POST' });
  const data = await parseResponse<{ message?: string }>(response, 'Não foi possível aplicar o webhook.');
  return data.message || 'Webhook aplicado.';
}

export async function sendEvolutionApiTest(number: string, text: string): Promise<string> {
  const response = await authFetch('/api/evolution/send-test', {
    method: 'POST',
    body: JSON.stringify({ number, text }),
  });
  const data = await parseResponse<{ message?: string }>(response, 'Não foi possível enviar a mensagem de teste.');
  return data.message || 'Mensagem de teste enviada.';
}

export async function testNavoBotAi(): Promise<NavoBotAiTestResult> {
  const response = await authFetch('/api/admin/navobot/ai-test', { method: 'POST' });
  return parseResponse<NavoBotAiTestResult>(response, 'Não foi possível testar o Gemini do NavoBot.');
}
