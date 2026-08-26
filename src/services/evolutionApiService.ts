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
  whatsappAccountType: 'personal_qr' | 'business_qr';
  useInteractiveMessages: boolean;
  managerNotificationPhone?: string;
  notifyBarberOnHandoff?: boolean;
  notifyManagerOnHandoff?: boolean;
}

export interface EvolutionApiSettingsInput {
  enabled: boolean;
  baseUrl: string;
  instanceName: string;
  webhookEnabled: boolean;
  webhookUrl: string;
  navoBotEnabled: boolean;
  whatsappAccountType: 'personal_qr' | 'business_qr';
  useInteractiveMessages: boolean;
  apiKey?: string;
  webhookSecret?: string;
  managerNotificationPhone?: string;
  notifyBarberOnHandoff?: boolean;
  notifyManagerOnHandoff?: boolean;
}

export interface BotConversationMessage {
  id: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  text: string;
  intent?: string | null;
  createdAt: string;
}

export interface BotConversation {
  id: string;
  phone: string;
  cleanPhone: string;
  state: string;
  handoffRequested: boolean;
  handoffReason: string | null;
  assignedProfessionalId: string | null;
  assignedProfessionalName: string | null;
  clientName: string;
  clientEmail: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  resolvedAt: string | null;
  context: any;
  messages: BotConversationMessage[];
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
  whatsappAccountType: 'personal_qr',
  useInteractiveMessages: false,
  managerNotificationPhone: '',
  notifyBarberOnHandoff: true,
  notifyManagerOnHandoff: true,
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
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (data && typeof data === 'object' && 'model' in data && 'usedGemini' in data) return data as NavoBotAiTestResult;
    throw new Error(data?.error || data?.message || 'Não foi possível testar o Gemini do NavoBot.');
  }
  return data as NavoBotAiTestResult;
}

export async function fetchBotConversations(): Promise<BotConversation[]> {
  const response = await authFetch('/api/evolution/conversations');
  return parseResponse<BotConversation[]>(response, 'Não foi possível carregar as conversas do WhatsApp.');
}

export async function resolveBotConversation(id: string): Promise<void> {
  const response = await authFetch(`/api/evolution/conversations/${id}/resolve`, {
    method: 'POST',
  });
  await parseResponse(response, 'Não foi possível concluir o atendimento da conversa.');
}

export async function resumeBotForConversation(id: string, notifyClient = true): Promise<void> {
  const response = await authFetch(`/api/evolution/conversations/${id}/resume-bot`, {
    method: 'POST',
    body: JSON.stringify({ notifyClient }),
  });
  await parseResponse(response, 'Não foi possível reativar o bot.');
}

export async function sendManualBotMessage(id: string, text: string): Promise<void> {
  const response = await authFetch(`/api/evolution/conversations/${id}/send-manual`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  await parseResponse(response, 'Não foi possível enviar a mensagem.');
}
