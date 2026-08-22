import crypto from 'node:crypto';
import { JWT_SECRET } from '../config/env.js';

const GOOGLE_ADS_API_VERSION = String(process.env.GOOGLE_ADS_API_VERSION || 'v25').trim();
const GOOGLE_ADS_BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';
const ENCRYPTION_SECRET = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || JWT_SECRET).digest();

export const GOOGLE_ADS_SCOPES = [GOOGLE_ADS_SCOPE];

export interface GoogleAdsConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  developerToken: string;
  loginCustomerId: string;
  apiVersion: string;
  configured: boolean;
}

export interface GoogleAdsError extends Error {
  status?: number;
  code?: string;
  requestId?: string;
  raw?: unknown;
}

export interface GoogleAdsCustomer {
  customerId: string;
  resourceName: string;
  name: string;
  currency: string;
  manager: boolean;
}

export interface GoogleAdsMetric {
  impressions: number;
  reach: number;
  clicks: number;
  spendCents: number;
  leads: number;
  conversions: number;
}

export interface GoogleAdsCampaignInput {
  name: string;
  dailyBudgetCents: number;
  startDate?: string;
  endDate?: string;
  locationLabel?: string;
  locationResourceName?: string;
  destinationUrl: string;
  headlines: string[];
  descriptions: string[];
  keywords: string[];
}

export function getGoogleAdsConfig(): GoogleAdsConfig {
  const clientId = String(process.env.GOOGLE_ADS_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_ADS_CLIENT_SECRET || '').trim();
  const redirectUri = String(process.env.GOOGLE_ADS_REDIRECT_URI || '').trim();
  const developerToken = String(process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '').trim();
  const loginCustomerId = normalizeCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '');
  return {
    clientId,
    clientSecret,
    redirectUri,
    developerToken,
    loginCustomerId,
    apiVersion: GOOGLE_ADS_API_VERSION,
    configured: Boolean(clientId && clientSecret && redirectUri && developerToken),
  };
}

export function normalizeCustomerId(value: string): string {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function encodeBase64(value: Buffer): string {
  return value.toString('base64url');
}

function decodeBase64(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export function encryptGoogleRefreshToken(token: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_SECRET, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return `v1:${encodeBase64(iv)}:${encodeBase64(cipher.getAuthTag())}:${encodeBase64(encrypted)}`;
}

export function decryptGoogleRefreshToken(value: string): string {
  if (!value) throw new Error('Token Google não encontrado.');
  if (!value.startsWith('v1:')) return value;
  const [, ivEncoded, tagEncoded, payloadEncoded] = value.split(':');
  if (!ivEncoded || !tagEncoded || !payloadEncoded) throw new Error('Token Google armazenado em formato inválido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_SECRET, decodeBase64(ivEncoded));
  decipher.setAuthTag(decodeBase64(tagEncoded));
  return Buffer.concat([decipher.update(decodeBase64(payloadEncoded)), decipher.final()]).toString('utf8');
}

export function createGoogleOAuthState(userId: string): string {
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const nonce = crypto.randomBytes(24).toString('hex');
  const payload = `${userId}.${expiresAt}.${nonce}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`google:${payload}`).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyGoogleOAuthState(state: string, expectedUserId: string): boolean {
  const parts = String(state || '').split('.');
  if (parts.length !== 4) return false;
  const [userId, expiresAt, nonce, signature] = parts;
  if (!userId || !expiresAt || !nonce || !signature || userId !== expectedUserId) return false;
  if (!Number.isFinite(Number(expiresAt)) || Number(expiresAt) < Date.now()) return false;
  const payload = `${userId}.${expiresAt}.${nonce}`;
  const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(`google:${payload}`).digest('base64url');
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

export function buildGoogleOAuthUrl(state: string): string {
  const config = getGoogleAdsConfig();
  if (!config.clientId || !config.redirectUri) throw new Error('A integração Google Ads ainda não está configurada no servidor.');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_ADS_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return url.toString();
}

async function parseJson(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: 'O Google retornou uma resposta inválida.' } };
  }
}

function normalizeGoogleError(status: number, body: any, requestId?: string): GoogleAdsError {
  const details = body?.error || body;
  const firstFailure = Array.isArray(body?.partialFailureError?.details) ? body.partialFailureError.details[0] : null;
  const message = details?.message || firstFailure?.message || `O Google Ads recusou a solicitação (HTTP ${status}).`;
  const error = new Error(String(message)) as GoogleAdsError;
  error.status = status;
  error.code = String(details?.status || details?.code || 'GOOGLE_ADS_ERROR');
  error.requestId = requestId;
  error.raw = body;
  return error;
}

export async function exchangeGoogleCode(code: string): Promise<{ refreshToken: string; accessToken?: string; expiresIn?: number }> {
  const config = getGoogleAdsConfig();
  if (!config.configured) throw new Error('A integração Google Ads ainda não está configurada no servidor.');
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await parseJson(response);
  if (!response.ok || !body.refresh_token) throw normalizeGoogleError(response.status, body);
  return { refreshToken: String(body.refresh_token), accessToken: body.access_token ? String(body.access_token) : undefined, expiresIn: Number(body.expires_in) || undefined };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn?: number }> {
  const config = getGoogleAdsConfig();
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await parseJson(response);
  if (!response.ok || !body.access_token) throw normalizeGoogleError(response.status, body);
  return { accessToken: String(body.access_token), expiresIn: Number(body.expires_in) || undefined };
}

export async function getGoogleUserInfo(accessToken: string): Promise<{ id: string; name: string; email?: string }> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await parseJson(response);
  if (!response.ok || !body.sub) throw normalizeGoogleError(response.status, body);
  return { id: String(body.sub), name: String(body.name || body.email || 'Conta Google'), email: body.email ? String(body.email) : undefined };
}

function customerPath(customerId: string): string {
  const normalized = normalizeCustomerId(customerId);
  if (!normalized || normalized.length !== 10) throw new Error('Customer ID Google Ads inválido. Use 10 dígitos, sem hífens.');
  return `customers/${normalized}`;
}

async function googleAdsRequest<T = any>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const config = getGoogleAdsConfig();
  if (!config.developerToken) throw new Error('Developer token do Google Ads não configurado no servidor.');
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('developer-token', config.developerToken);
  if (config.loginCustomerId) headers.set('login-customer-id', config.loginCustomerId);
  let response: Response;
  let body: any;
  try {
    response = await fetch(`${GOOGLE_ADS_BASE_URL}/${path.replace(/^\//, '')}`, { ...init, headers, signal: init.signal || AbortSignal.timeout(30_000) });
    body = await parseJson(response);
  } catch (cause: any) {
    const error = new Error(cause?.name === 'TimeoutError' ? 'O Google Ads demorou para responder.' : 'Não foi possível conectar ao Google Ads.') as GoogleAdsError;
    error.raw = cause?.message;
    throw error;
  }
  const requestId = response.headers.get('request-id') || undefined;
  if (!response.ok || body?.error) throw normalizeGoogleError(response.status, body, requestId);
  return body as T;
}

export async function googleAdsQuery<T = any>(accessToken: string, customerId: string, query: string): Promise<T[]> {
  const body = await googleAdsRequest<any>(`${customerPath(customerId)}/googleAds:search`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ query, pageSize: 1000 }),
  });
  return Array.isArray(body?.results) ? body.results as T[] : [];
}

export async function googleAdsMutate(accessToken: string, customerId: string, operations: any[]): Promise<any> {
  return googleAdsRequest(`${customerPath(customerId)}/googleAds:mutate`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ operations, partialFailure: false, validateOnly: false }),
  });
}

export async function listAccessibleGoogleCustomers(accessToken: string): Promise<GoogleAdsCustomer[]> {
  const body = await googleAdsRequest<{ resourceNames?: string[] }>('customers:listAccessibleCustomers', accessToken, { method: 'GET' });
  const resourceNames = Array.isArray(body.resourceNames) ? body.resourceNames : [];
  const candidates = resourceNames.map((resourceName) => normalizeCustomerId(String(resourceName).split('/').pop() || '')).filter((id) => id.length === 10);
  const accounts: GoogleAdsCustomer[] = [];
  for (const customerId of candidates.slice(0, 50)) {
    try {
      const rows = await googleAdsQuery<any>(accessToken, customerId, 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager FROM customer LIMIT 1');
      const customer = rows[0]?.customer;
      if (!customer?.id) continue;
      accounts.push({
        customerId: normalizeCustomerId(String(customer.id)),
        resourceName: String(customer.resourceName || `customers/${customer.id}`),
        name: String(customer.descriptiveName || customer.id),
        currency: String(customer.currencyCode || 'BRL'),
        manager: Boolean(customer.manager),
      });
    } catch {
      // O usuário pode ter acesso ao recurso sem permissão de leitura detalhada.
    }
  }
  return accounts;
}

export function normalizeGoogleMetric(raw: any): GoogleAdsMetric {
  const metrics = raw?.metrics || {};
  const micros = Number(metrics.costMicros || 0);
  const conversions = Number(metrics.conversions || 0);
  return {
    impressions: Math.max(0, Number(metrics.impressions || 0)),
    reach: 0,
    clicks: Math.max(0, Number(metrics.clicks || 0)),
    spendCents: Math.max(0, Math.round((Number.isFinite(micros) ? micros : 0) / 10_000)),
    leads: Math.max(0, Math.round(Number.isFinite(conversions) ? conversions : 0)),
    conversions: Number.isFinite(conversions) ? conversions : 0,
  };
}

export function normalizeGoogleCampaign(raw: any): any {
  const campaign = raw?.campaign || {};
  const metric = normalizeGoogleMetric(raw);
  const budgetMicros = Number(raw?.campaignBudget?.amountMicros || 0);
  const status = String(campaign.status || 'PAUSED') === 'ENABLED' ? 'ACTIVE' : String(campaign.status || 'PAUSED');
  return {
    googleCampaignId: String(campaign.id || String(campaign.resourceName || '').split('/').pop() || ''),
    googleAdGroupId: raw?.adGroup?.id ? String(raw.adGroup.id) : null,
    googleAdId: raw?.adGroupAd?.ad?.id ? String(raw.adGroupAd.ad.id) : null,
    name: String(campaign.name || 'Campanha Google'),
    objective: String(campaign.advertisingChannelType || 'SEARCH'),
    status,
    dailyBudgetCents: Math.max(0, Math.round(budgetMicros / 10_000)),
    startDate: campaign.startDate ? String(campaign.startDate) : null,
    endDate: campaign.endDate ? String(campaign.endDate) : null,
    ...metric,
  };
}

export async function listGoogleCampaigns(accessToken: string, customerId: string): Promise<any[]> {
  return googleAdsQuery(accessToken, customerId, `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.start_date, campaign.end_date, campaign_budget.amount_micros, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE campaign.status != 'REMOVED' ORDER BY campaign.id DESC`);
}

function asGoogleDate(value?: string): string | undefined {
  return value ? value.replace(/-/g, '') : undefined;
}

function resourceId(resourceName: string | undefined): string {
  return String(resourceName || '').split('/').pop() || '';
}

export async function createGoogleSearchCampaign(accessToken: string, customerId: string, input: GoogleAdsCampaignInput): Promise<{ campaignResourceName: string; adGroupResourceName: string; adResourceName: string }> {
  const budgetResponse = await googleAdsMutate(accessToken, customerId, [{ campaignBudgetOperation: { create: { name: `${input.name} · Orçamento`, amountMicros: String(Math.max(1_000, Math.round(input.dailyBudgetCents * 10_000))), deliveryMethod: 'STANDARD' } } }]);
  const budgetResourceName = String(budgetResponse?.results?.[0]?.campaignBudgetResult?.resourceName || '');
  if (!budgetResourceName) throw new Error('O Google não retornou o orçamento criado.');

  const campaignResponse = await googleAdsMutate(accessToken, customerId, [{ campaignOperation: { create: {
    name: input.name,
    advertisingChannelType: 'SEARCH',
    status: 'PAUSED',
    campaignBudget: budgetResourceName,
    startDate: asGoogleDate(input.startDate),
    endDate: asGoogleDate(input.endDate),
    biddingStrategyType: 'MAXIMIZE_CLICKS',
    networkSettings: { targetGoogleSearch: true, targetSearchNetwork: true, targetContentNetwork: false, targetPartnerSearchNetwork: false },
  } } }]);
  const campaignResourceName = String(campaignResponse?.results?.[0]?.campaignResult?.resourceName || '');
  if (!campaignResourceName) throw new Error('O Google não retornou a campanha criada.');

  const operations: any[] = [{ adGroupOperation: { create: { name: `${input.name} · Grupo`, campaign: campaignResourceName, status: 'PAUSED', type: 'SEARCH_STANDARD', cpcBidMicros: '1000000' } } }];
  const adGroupResponse = await googleAdsMutate(accessToken, customerId, operations);
  const adGroupResourceName = String(adGroupResponse?.results?.[0]?.adGroupResult?.resourceName || '');
  if (!adGroupResourceName) throw new Error('O Google não retornou o grupo de anúncios criado.');

  const keywordOperations = input.keywords.filter(Boolean).slice(0, 20).map((keyword) => ({ adGroupCriterionOperation: { create: { adGroup: adGroupResourceName, status: 'PAUSED', keyword: { text: keyword, matchType: 'PHRASE' } } } }));
  if (keywordOperations.length) await googleAdsMutate(accessToken, customerId, keywordOperations);

  const headlines = input.headlines.map((text) => String(text || '').trim()).filter(Boolean).slice(0, 15);
  const descriptions = input.descriptions.map((text) => String(text || '').trim()).filter(Boolean).slice(0, 4);
  if (headlines.length < 3 || descriptions.length < 2) throw new Error('Informe pelo menos 3 títulos e 2 descrições para o anúncio responsivo.');
  const adResponse = await googleAdsMutate(accessToken, customerId, [{ adGroupAdOperation: { create: { adGroup: adGroupResourceName, status: 'PAUSED', ad: { finalUrls: [input.destinationUrl], responsiveSearchAd: { headlines: headlines.map((text) => ({ text })), descriptions: descriptions.map((text) => ({ text })) } } } } }]);
  const adResourceName = String(adResponse?.results?.[0]?.adGroupAdResult?.resourceName || '');
  if (!adResourceName) throw new Error('O Google não retornou o anúncio criado.');

  if (input.locationResourceName) {
    await googleAdsMutate(accessToken, customerId, [{ campaignCriterionOperation: { create: { campaign: campaignResourceName, location: { geoTargetConstant: input.locationResourceName } } } }]);
  }
  return { campaignResourceName, adGroupResourceName, adResourceName };
}

export async function updateGoogleCampaignStatus(accessToken: string, customerId: string, campaignId: string, status: 'ENABLED' | 'PAUSED'): Promise<void> {
  const resourceName = `${customerPath(customerId)}/campaigns/${encodeURIComponent(normalizeCustomerId(campaignId))}`;
  await googleAdsMutate(accessToken, customerId, [{ campaignOperation: { update: { resourceName, status }, updateMask: 'status' } }]);
}

export function googleCampaignIdFromResource(resourceName: string): string {
  return resourceId(resourceName);
}
