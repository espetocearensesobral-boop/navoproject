import { authFetch, readApiJson } from '../lib/api';
import { formatCents, formatCompactNumber } from './metaAdsService';
export { formatCents, formatCompactNumber } from './metaAdsService';

export interface GoogleAdsConnection {
  id: string;
  googleUserId?: string | null;
  googleUserName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  managerCustomerId?: string | null;
  currency?: string | null;
  status: string;
  tokenExpiresAt?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GoogleAdsStatusResponse {
  configured: boolean;
  apiVersion: string;
  connection: GoogleAdsConnection | null;
}

export interface GoogleAdsCustomer {
  customerId: string;
  resourceName: string;
  name: string;
  currency: string;
  manager: boolean;
}

export interface GoogleCampaign {
  id: string;
  googleCampaignId: string;
  googleAdGroupId?: string | null;
  googleAdId?: string | null;
  name: string;
  objective: string;
  status: string;
  dailyBudgetCents: number;
  startDate?: string | null;
  endDate?: string | null;
  locationLabel?: string | null;
  locationResourceName?: string | null;
  destinationUrl?: string | null;
  headline?: string | null;
  adText?: string | null;
  keywords: string[];
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  spendCents: number;
  conversions: number;
  lastInsightAt?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GoogleCampaignForm {
  name: string;
  dailyBudgetCents: number;
  startDate: string;
  endDate: string;
  locationLabel: string;
  locationResourceName: string;
  destinationUrl: string;
  headlines: string[];
  descriptions: string[];
  keywords: string[];
}

export interface GoogleCampaignTotals {
  spendCents: number;
  leads: number;
  clicks: number;
  reach: number;
  impressions: number;
  conversions: number;
}

export const googleAdsPresentation = { formatCents, formatCompactNumber };

export async function getGoogleAdsStatus(): Promise<GoogleAdsStatusResponse> {
  return readApiJson<GoogleAdsStatusResponse>(await authFetch('/api/google-ads/status'));
}

export async function startGoogleAdsOAuth(): Promise<{ url: string }> {
  return readApiJson<{ url: string }>(await authFetch('/api/google-ads/oauth/start'));
}

export async function getGoogleAdsAssets(): Promise<{ customers: GoogleAdsCustomer[]; connection: GoogleAdsConnection | null }> {
  return readApiJson(await authFetch('/api/google-ads/assets'));
}

export async function saveGoogleAdsCustomer(customerId: string): Promise<{ connection: GoogleAdsConnection }> {
  return readApiJson(await authFetch('/api/google-ads/assets', { method: 'PUT', body: JSON.stringify({ customerId }) }));
}

export async function disconnectGoogleAds(): Promise<{ success: boolean }> {
  return readApiJson(await authFetch('/api/google-ads/disconnect', { method: 'POST' }));
}

export async function getGoogleCampaigns(): Promise<{ campaigns: GoogleCampaign[]; totals: GoogleCampaignTotals }> {
  return readApiJson(await authFetch('/api/google-ads/campaigns'));
}

export async function syncGoogleCampaigns(): Promise<{ campaigns: GoogleCampaign[]; syncedAt: string }> {
  return readApiJson(await authFetch('/api/google-ads/campaigns/sync', { method: 'POST' }));
}

export async function createGoogleCampaign(input: GoogleCampaignForm): Promise<{ campaign: GoogleCampaign; message: string }> {
  return readApiJson(await authFetch('/api/google-ads/campaigns', { method: 'POST', body: JSON.stringify(input) }));
}

export async function updateGoogleCampaignStatus(id: string, status: 'ENABLED' | 'PAUSED'): Promise<{ campaign: GoogleCampaign }> {
  return readApiJson(await authFetch(`/api/google-ads/campaigns/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }));
}
