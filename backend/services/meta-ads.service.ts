import crypto from 'node:crypto';
import { JWT_SECRET } from '../config/env.js';

const GRAPH_API_VERSION = process.env.META_ADS_GRAPH_API_VERSION || 'v26.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const ENCRYPTION_SECRET = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || JWT_SECRET).digest();

export const META_ADS_SCOPES = [
  'ads_read',
  'ads_management',
  'pages_show_list',
  'pages_read_engagement',
];

export interface MetaAdsConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  graphApiVersion: string;
  configured: boolean;
}

export interface MetaGraphError extends Error {
  status?: number;
  code?: number;
  subcode?: number;
  raw?: unknown;
}

export interface MetaAsset {
  id: string;
  name: string;
  currency?: string;
  accountStatus?: number;
}

export interface MetaPageAsset {
  id: string;
  name: string;
}

export interface MetaInsight {
  impressions: number;
  reach: number;
  clicks: number;
  spendCents: number;
  leads: number;
}

export function getMetaAdsConfig(): MetaAdsConfig {
  const appId = String(process.env.META_ADS_APP_ID || process.env.META_APP_ID || '').trim();
  const appSecret = String(process.env.META_ADS_APP_SECRET || process.env.META_APP_SECRET || '').trim();
  const redirectUri = String(process.env.META_ADS_REDIRECT_URI || '').trim();
  return {
    appId,
    appSecret,
    redirectUri,
    graphApiVersion: GRAPH_API_VERSION,
    configured: Boolean(appId && appSecret && redirectUri),
  };
}

function encodeBase64(value: Buffer): string {
  return value.toString('base64url');
}

function decodeBase64(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export function encryptMetaAccessToken(token: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_SECRET, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return `v1:${encodeBase64(iv)}:${encodeBase64(cipher.getAuthTag())}:${encodeBase64(encrypted)}`;
}

export function decryptMetaAccessToken(value: string): string {
  if (!value) throw new Error('Token Meta não encontrado.');
  if (!value.startsWith('v1:')) return value;
  const [, ivEncoded, tagEncoded, payloadEncoded] = value.split(':');
  if (!ivEncoded || !tagEncoded || !payloadEncoded) throw new Error('Token Meta armazenado em formato inválido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_SECRET, decodeBase64(ivEncoded));
  decipher.setAuthTag(decodeBase64(tagEncoded));
  return Buffer.concat([decipher.update(decodeBase64(payloadEncoded)), decipher.final()]).toString('utf8');
}

export function createOAuthState(userId: string): string {
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const nonce = crypto.randomBytes(24).toString('hex');
  const payload = `${userId}.${expiresAt}.${nonce}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyOAuthState(state: string, expectedUserId: string): boolean {
  const parts = String(state || '').split('.');
  if (parts.length !== 4) return false;
  const [userId, expiresAt, nonce, signature] = parts;
  if (!userId || !expiresAt || !nonce || !signature || userId !== expectedUserId) return false;
  if (!Number.isFinite(Number(expiresAt)) || Number(expiresAt) < Date.now()) return false;
  const payload = `${userId}.${expiresAt}.${nonce}`;
  const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

export function buildMetaOAuthUrl(state: string): string {
  const config = getMetaAdsConfig();
  if (!config.configured) throw new Error('A integração Meta Ads ainda não está configurada no servidor.');
  const url = new URL('https://www.facebook.com/dialog/oauth');
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', META_ADS_SCOPES.join(','));
  url.searchParams.set('response_type', 'code');
  return url.toString();
}

function normalizeMetaError(status: number, body: any): MetaGraphError {
  const details = body?.error || body;
  const message = details?.message || `A Meta recusou a solicitação (HTTP ${status}).`;
  const error = new Error(message) as MetaGraphError;
  error.status = status;
  error.code = Number(details?.code) || undefined;
  error.subcode = Number(details?.error_subcode) || undefined;
  error.raw = body;
  return error;
}

function serializeParam(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export async function metaGraphRequest<T = any>(path: string, accessToken: string, params: Record<string, unknown> = {}, method: 'GET' | 'POST' | 'DELETE' = 'GET'): Promise<T> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${GRAPH_BASE_URL}${cleanPath}`);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  if (method === 'GET') {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, serializeParam(value));
    });
  }

  const requestInit: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(20_000),
  };

  if (method !== 'GET') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const body = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') body.set(key, serializeParam(value));
    });
    requestInit.body = body.toString();
  }

  let response: Response;
  let bodyText = '';
  try {
    response = await fetch(url, requestInit);
    bodyText = await response.text();
  } catch (cause: any) {
    const error = new Error(cause?.name === 'TimeoutError' ? 'A Meta demorou para responder.' : 'Não foi possível conectar à Meta.') as MetaGraphError;
    error.raw = cause?.message;
    throw error;
  }

  let body: any = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = { error: { message: 'A Meta retornou uma resposta inválida.' } };
  }

  if (!response.ok || body?.error) throw normalizeMetaError(response.status, body);
  return body as T;
}

export async function exchangeMetaCode(code: string): Promise<{ accessToken: string; expiresIn?: number }> {
  const config = getMetaAdsConfig();
  if (!config.configured) throw new Error('A integração Meta Ads ainda não está configurada no servidor.');
  const url = new URL(`${GRAPH_BASE_URL}/oauth/access_token`);
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('client_secret', config.appSecret);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('code', code);
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error || !body?.access_token) throw normalizeMetaError(response.status, body);
  return { accessToken: body.access_token, expiresIn: Number(body.expires_in) || undefined };
}

export async function extendMetaAccessToken(shortLivedToken: string): Promise<{ accessToken: string; expiresIn?: number }> {
  const config = getMetaAdsConfig();
  const url = new URL(`${GRAPH_BASE_URL}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('client_secret', config.appSecret);
  url.searchParams.set('fb_exchange_token', shortLivedToken);
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error || !body?.access_token) throw normalizeMetaError(response.status, body);
  return { accessToken: body.access_token, expiresIn: Number(body.expires_in) || undefined };
}

export async function getMetaProfile(accessToken: string): Promise<{ id: string; name: string }> {
  return metaGraphRequest('/me', accessToken, { fields: 'id,name' });
}

export async function listMetaAdAccounts(accessToken: string): Promise<MetaAsset[]> {
  const response = await metaGraphRequest<{ data?: any[] }>('/me/adaccounts', accessToken, {
    fields: 'id,name,account_currency,account_status',
    limit: 100,
  });
  return (response.data || []).map((item) => ({
    id: String(item.id || ''),
    name: String(item.name || item.id || 'Conta de anúncios'),
    currency: String(item.account_currency || 'BRL'),
    accountStatus: Number(item.account_status) || undefined,
  })).filter((item) => item.id);
}

export async function listMetaPages(accessToken: string): Promise<MetaPageAsset[]> {
  const response = await metaGraphRequest<{ data?: any[] }>('/me/accounts', accessToken, {
    fields: 'id,name',
    limit: 100,
  });
  return (response.data || []).map((item) => ({ id: String(item.id || ''), name: String(item.name || item.id || 'Página') })).filter((item) => item.id);
}

export function normalizeInsight(raw: any): MetaInsight {
  const actions = Array.isArray(raw?.actions) ? raw.actions : [];
  const leads = actions
    .filter((action: any) => ['lead', 'leadgen_grouped', 'onsite_conversion.lead_grouped'].includes(String(action?.action_type || '')))
    .reduce((sum: number, action: any) => sum + Number(action?.value || 0), 0);
  const spend = Number(raw?.spend || 0);
  return {
    impressions: Number(raw?.impressions || 0),
    reach: Number(raw?.reach || 0),
    clicks: Number(raw?.clicks || 0),
    spendCents: Math.round((Number.isFinite(spend) ? spend : 0) * 100),
    leads: Number.isFinite(leads) ? Math.round(leads) : 0,
  };
}

export async function getCampaignInsight(accessToken: string, campaignId: string): Promise<MetaInsight> {
  const response = await metaGraphRequest<{ data?: any[] }>(`/${encodeURIComponent(campaignId)}/insights`, accessToken, {
    fields: 'impressions,reach,clicks,spend,actions',
    date_preset: 'maximum',
    level: 'campaign',
    limit: 1,
  });
  return normalizeInsight(response.data?.[0] || {});
}

export async function listMetaCampaigns(accessToken: string, adAccountId: string): Promise<any[]> {
  const response = await metaGraphRequest<{ data?: any[] }>(`/act_${encodeURIComponent(adAccountId.replace(/^act_/, ''))}/campaigns`, accessToken, {
    fields: 'id,name,objective,status,daily_budget,start_time,stop_time,created_time',
    limit: 100,
  });
  return response.data || [];
}

export async function createMetaCampaign(accessToken: string, adAccountId: string, input: { name: string; objective: string }): Promise<{ id: string }> {
  return metaGraphRequest(`/act_${encodeURIComponent(adAccountId.replace(/^act_/, ''))}/campaigns`, accessToken, {
    name: input.name,
    objective: input.objective,
    status: 'PAUSED',
    special_ad_categories: [],
  }, 'POST');
}

export async function createMetaAdSet(accessToken: string, adAccountId: string, input: { name: string; campaignId: string; dailyBudgetCents: number; targeting: Record<string, unknown>; startDate?: string; endDate?: string }): Promise<{ id: string }> {
  return metaGraphRequest(`/act_${encodeURIComponent(adAccountId.replace(/^act_/, ''))}/adsets`, accessToken, {
    name: input.name,
    campaign_id: input.campaignId,
    daily_budget: input.dailyBudgetCents,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'LINK_CLICKS',
    targeting: input.targeting,
    start_time: input.startDate ? `${input.startDate}T08:00:00-03:00` : undefined,
    end_time: input.endDate ? `${input.endDate}T23:59:59-03:00` : undefined,
    status: 'PAUSED',
  }, 'POST');
}

export async function createMetaCreative(accessToken: string, adAccountId: string, input: { name: string; pageId: string; adText: string; headline: string; destinationUrl: string; imageUrl?: string }): Promise<{ id: string }> {
  return metaGraphRequest(`/act_${encodeURIComponent(adAccountId.replace(/^act_/, ''))}/adcreatives`, accessToken, {
    name: input.name,
    object_story_spec: {
      page_id: input.pageId,
      link_data: {
        message: input.adText,
        link: input.destinationUrl,
        name: input.headline,
        picture: input.imageUrl || undefined,
        call_to_action: {
          type: 'LEARN_MORE',
          value: { link: input.destinationUrl },
        },
      },
    },
  }, 'POST');
}

export async function createMetaAd(accessToken: string, adAccountId: string, input: { name: string; adSetId: string; creativeId: string }): Promise<{ id: string }> {
  return metaGraphRequest(`/act_${encodeURIComponent(adAccountId.replace(/^act_/, ''))}/ads`, accessToken, {
    name: input.name,
    adset_id: input.adSetId,
    creative: { creative_id: input.creativeId },
    status: 'PAUSED',
  }, 'POST');
}

export async function updateMetaStatus(accessToken: string, objectId: string, status: 'ACTIVE' | 'PAUSED'): Promise<{ success?: boolean }> {
  return metaGraphRequest(`/${encodeURIComponent(objectId)}`, accessToken, { status }, 'POST');
}
