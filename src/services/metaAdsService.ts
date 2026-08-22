import { authFetch, readApiJson } from '../lib/api';

export interface MetaAdAccount {
  id: string;
  name: string;
  currency?: string;
  accountStatus?: number;
}

export interface MetaPage {
  id: string;
  name: string;
}

export interface MetaAdsConnection {
  id: string;
  status: 'connected' | 'disconnected' | 'error' | string;
  metaUserId?: string | null;
  metaUserName?: string | null;
  adAccountId?: string | null;
  adAccountName?: string | null;
  currency?: string | null;
  pageId?: string | null;
  pageName?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  tokenExpiresAt?: string | null;
}

export interface MetaAdsStatusResponse {
  configured: boolean;
  graphApiVersion: string;
  connection: MetaAdsConnection | null;
}

export interface MetaCampaign {
  id: string;
  metaCampaignId: string;
  name: string;
  objective: string;
  status: string;
  dailyBudgetCents: number;
  startDate?: string | null;
  endDate?: string | null;
  locationLabel?: string | null;
  destinationUrl?: string | null;
  adText?: string | null;
  headline?: string | null;
  imageUrl?: string | null;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  spendCents: number;
  lastInsightAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MetaCampaignForm {
  name: string;
  objective: 'OUTCOME_TRAFFIC';
  dailyBudgetCents: number;
  startDate: string;
  endDate: string;
  locationLabel: string;
  locationKey: string;
  destinationUrl: string;
  adText: string;
  headline: string;
  imageUrl: string;
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await authFetch(endpoint, options);
  return readApiJson<T>(response);
}

export function getMetaAdsStatus(): Promise<MetaAdsStatusResponse> {
  return request('/api/meta-ads/status');
}

export async function startMetaAdsOAuth(): Promise<{ url: string }> {
  return request('/api/meta-ads/oauth/start');
}

export function getMetaAdsAssets(): Promise<{ accounts: MetaAdAccount[]; pages: MetaPage[]; connection: MetaAdsConnection | null }> {
  return request('/api/meta-ads/assets');
}

export function saveMetaAdsAssets(adAccountId: string, pageId: string): Promise<{ connection: MetaAdsConnection }> {
  return request('/api/meta-ads/assets', {
    method: 'PUT',
    body: JSON.stringify({ adAccountId, pageId }),
  });
}

export function disconnectMetaAds(): Promise<{ success: boolean }> {
  return request('/api/meta-ads/disconnect', { method: 'POST' });
}

export function getMetaCampaigns(): Promise<{ campaigns: MetaCampaign[]; totals: { spendCents: number; leads: number; clicks: number; reach: number; impressions: number } }> {
  return request('/api/meta-ads/campaigns');
}

export function syncMetaCampaigns(): Promise<{ campaigns: MetaCampaign[]; syncedAt: string }> {
  return request('/api/meta-ads/campaigns/sync', { method: 'POST' });
}

export function createMetaCampaign(payload: MetaCampaignForm): Promise<{ campaign: MetaCampaign; message: string }> {
  return request('/api/meta-ads/campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateMetaCampaignStatus(id: string, status: 'ACTIVE' | 'PAUSED'): Promise<{ campaign: MetaCampaign }> {
  return request(`/api/meta-ads/campaigns/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function formatCents(cents: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format((Number(cents) || 0) / 100);
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0);
}
