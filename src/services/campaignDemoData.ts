import type { MetaAdAccount, MetaAdsConnection, MetaCampaign, MetaCampaignForm, MetaPage } from './metaAdsService';
import type { GoogleAdsConnection, GoogleAdsCustomer, GoogleCampaign, GoogleCampaignForm, GoogleCampaignTotals } from './googleAdsService';

/**
 * O padrão é demonstrativo para que a área Campanhas funcione sem OAuth, banco ou contas externas.
 * Defina VITE_CAMPAIGNS_DEMO_MODE=false somente quando a integração real estiver pronta para produção.
 */
const campaignDemoEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
export const CAMPAIGNS_DEMO_MODE = campaignDemoEnv?.VITE_CAMPAIGNS_DEMO_MODE !== 'false';

const demoTimestamp = '2026-08-22T12:00:00.000Z';

export const demoMetaAccounts: MetaAdAccount[] = [
  { id: 'act_demo_navo', name: 'NavoClub — Conta demonstrativa', currency: 'BRL', accountStatus: 1 },
];

export const demoMetaPages: MetaPage[] = [
  { id: 'demo-navo-page', name: 'NavoClub (Página demonstrativa)' },
];

export const demoMetaConnection: MetaAdsConnection = {
  id: 'demo-meta-connection',
  status: 'connected',
  metaUserId: 'demo-meta-user',
  metaUserName: 'NavoClub (demonstração)',
  adAccountId: 'act_demo_navo',
  adAccountName: 'NavoClub — Conta demonstrativa',
  currency: 'BRL',
  pageId: 'demo-navo-page',
  pageName: 'NavoClub',
  lastSyncedAt: demoTimestamp,
  lastError: null,
};

export const demoMetaCampaigns: MetaCampaign[] = [
  {
    id: 'demo-meta-campaign-1',
    metaCampaignId: 'demo_meta_001',
    name: 'Agenda de cortes — Sobral',
    objective: 'OUTCOME_TRAFFIC',
    status: 'ACTIVE',
    dailyBudgetCents: 2500,
    startDate: '2026-08-18',
    endDate: '2026-08-31',
    locationLabel: 'Sobral e região',
    destinationUrl: 'https://navoproject.vercel.app/?catalog=1',
    adText: 'Agende seu atendimento na NavoClub.',
    headline: 'Agende seu horário',
    imageUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=80',
    impressions: 12480,
    reach: 8230,
    clicks: 486,
    leads: 38,
    spendCents: 18750,
    lastInsightAt: demoTimestamp,
    errorMessage: null,
    createdAt: '2026-08-18T12:00:00.000Z',
    updatedAt: demoTimestamp,
  },
  {
    id: 'demo-meta-campaign-2',
    metaCampaignId: 'demo_meta_002',
    name: 'Catálogo e agendamento online',
    objective: 'OUTCOME_TRAFFIC',
    status: 'PAUSED',
    dailyBudgetCents: 1500,
    startDate: '2026-08-20',
    endDate: null,
    locationLabel: 'Sobral',
    destinationUrl: 'https://navoproject.vercel.app/?catalog=1',
    adText: 'Veja os serviços e escolha seu horário online.',
    headline: 'Conheça nosso catálogo',
    imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=80',
    impressions: 6540,
    reach: 4210,
    clicks: 214,
    leads: 17,
    spendCents: 9320,
    lastInsightAt: demoTimestamp,
    errorMessage: null,
    createdAt: '2026-08-20T12:00:00.000Z',
    updatedAt: '2026-08-21T12:00:00.000Z',
  },
];

export const demoGoogleCustomers: GoogleAdsCustomer[] = [
  { customerId: '000-000-0000', resourceName: 'customers/0000000000', name: 'NavoClub — Conta demonstrativa', currency: 'BRL', manager: false },
];

export const demoGoogleConnection: GoogleAdsConnection = {
  id: 'demo-google-connection',
  googleUserId: 'demo-google-user',
  googleUserName: 'NavoClub (demonstração)',
  customerId: '000-000-0000',
  customerName: 'NavoClub — Conta demonstrativa',
  managerCustomerId: null,
  currency: 'BRL',
  status: 'connected',
  tokenExpiresAt: null,
  lastSyncedAt: demoTimestamp,
  lastError: null,
};

export const demoGoogleCampaigns: GoogleCampaign[] = [
  {
    id: 'demo-google-campaign-1',
    googleCampaignId: 'demo_google_001',
    googleAdGroupId: 'demo_google_group_001',
    googleAdId: 'demo_google_ad_001',
    name: 'Barbearia em Sobral — Pesquisa local',
    objective: 'SEARCH',
    status: 'ENABLED',
    dailyBudgetCents: 3000,
    startDate: '2026-08-17',
    endDate: '2026-08-31',
    locationLabel: 'Sobral e região',
    locationResourceName: 'geoTargetConstants/2076',
    destinationUrl: 'https://navoproject.vercel.app/?catalog=1',
    headline: 'Agende seu corte em Sobral',
    adText: 'Escolha o serviço e o horário de atendimento online.',
    keywords: ['barbearia em Sobral', 'corte masculino Sobral', 'barbeiro em Sobral'],
    impressions: 9340,
    reach: 6120,
    clicks: 392,
    leads: 31,
    spendCents: 22140,
    conversions: 31,
    lastInsightAt: demoTimestamp,
    errorMessage: null,
    createdAt: '2026-08-17T12:00:00.000Z',
    updatedAt: demoTimestamp,
  },
  {
    id: 'demo-google-campaign-2',
    googleCampaignId: 'demo_google_002',
    googleAdGroupId: 'demo_google_group_002',
    googleAdId: 'demo_google_ad_002',
    name: 'Agendamento online — Navo',
    objective: 'SEARCH',
    status: 'PAUSED',
    dailyBudgetCents: 1800,
    startDate: '2026-08-21',
    endDate: null,
    locationLabel: 'Sobral',
    locationResourceName: 'geoTargetConstants/2076',
    destinationUrl: 'https://navoproject.vercel.app/?catalog=1',
    headline: 'Escolha seu horário online',
    adText: 'Catálogo de serviços e agendamento em poucos passos.',
    keywords: ['agendar corte Sobral', 'corte de cabelo perto de mim'],
    impressions: 3180,
    reach: 2410,
    clicks: 126,
    leads: 9,
    spendCents: 6840,
    conversions: 9,
    lastInsightAt: demoTimestamp,
    errorMessage: null,
    createdAt: '2026-08-21T12:00:00.000Z',
    updatedAt: '2026-08-21T18:00:00.000Z',
  },
];

export const calculateMetaCampaignTotals = (campaigns: readonly MetaCampaign[]) => campaigns.reduce((totals, campaign) => ({
  spendCents: totals.spendCents + campaign.spendCents,
  leads: totals.leads + campaign.leads,
  clicks: totals.clicks + campaign.clicks,
  reach: totals.reach + campaign.reach,
  impressions: totals.impressions + campaign.impressions,
}), { spendCents: 0, leads: 0, clicks: 0, reach: 0, impressions: 0 });

export const calculateGoogleCampaignTotals = (campaigns: readonly GoogleCampaign[]): GoogleCampaignTotals => campaigns.reduce((totals, campaign) => ({
  spendCents: totals.spendCents + campaign.spendCents,
  leads: totals.leads + campaign.leads,
  clicks: totals.clicks + campaign.clicks,
  reach: totals.reach + campaign.reach,
  impressions: totals.impressions + campaign.impressions,
  conversions: totals.conversions + campaign.conversions,
}), { spendCents: 0, leads: 0, clicks: 0, reach: 0, impressions: 0, conversions: 0 });

export const demoMetaTotals = calculateMetaCampaignTotals(demoMetaCampaigns);
export const demoGoogleTotals = calculateGoogleCampaignTotals(demoGoogleCampaigns);

export const createDemoMetaCampaign = (form: MetaCampaignForm, sequence: number): MetaCampaign => ({
  id: `demo-meta-campaign-${Date.now()}`,
  metaCampaignId: `demo_meta_new_${sequence + 1}`,
  ...form,
  status: 'PAUSED',
  impressions: 0,
  reach: 0,
  clicks: 0,
  leads: 0,
  spendCents: 0,
  lastInsightAt: null,
  errorMessage: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const createDemoGoogleCampaign = (form: GoogleCampaignForm, sequence: number): GoogleCampaign => ({
  id: `demo-google-campaign-${Date.now()}`,
  googleCampaignId: `demo_google_new_${sequence + 1}`,
  googleAdGroupId: null,
  googleAdId: null,
  name: form.name,
  objective: 'SEARCH',
  status: 'PAUSED',
  dailyBudgetCents: form.dailyBudgetCents,
  startDate: form.startDate || null,
  endDate: form.endDate || null,
  locationLabel: form.locationLabel,
  locationResourceName: form.locationResourceName,
  destinationUrl: form.destinationUrl,
  headline: form.headlines[0] || null,
  adText: form.descriptions[0] || null,
  keywords: form.keywords,
  impressions: 0,
  reach: 0,
  clicks: 0,
  leads: 0,
  spendCents: 0,
  conversions: 0,
  lastInsightAt: null,
  errorMessage: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
