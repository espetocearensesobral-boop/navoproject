import crypto from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, dbReadyPromise, isDbConnected } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { JWT_SECRET } from '../config/env.js';
import { requireAdmin, requireAuth } from '../middleware/index.js';
import {
  buildGoogleOAuthUrl,
  createGoogleOAuthState,
  createGoogleSearchCampaign,
  decryptGoogleRefreshToken,
  encryptGoogleRefreshToken,
  exchangeGoogleCode,
  getGoogleAdsConfig,
  getGoogleUserInfo,
  googleCampaignIdFromResource,
  listAccessibleGoogleCustomers,
  listGoogleCampaigns,
  normalizeCustomerId,
  normalizeGoogleCampaign,
  refreshGoogleAccessToken,
  updateGoogleCampaignStatus,
  verifyGoogleOAuthState,
} from '../services/google-ads.service.js';

export const googleAdsRouter = express.Router();

const campaignInputSchema = z.object({
  name: z.string().trim().min(3).max(120),
  dailyBudgetCents: z.coerce.number().int().min(100).max(100_000_000),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  locationLabel: z.string().trim().max(120).optional().or(z.literal('')),
  locationResourceName: z.string().regex(/^geoTargetConstants\/\d+$/).optional().or(z.literal('')),
  destinationUrl: z.string().url().max(1000),
  headlines: z.array(z.string().trim().min(1).max(30)).min(3).max(15),
  descriptions: z.array(z.string().trim().min(1).max(90)).min(2).max(4),
  keywords: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
});

const assetsSchema = z.object({ customerId: z.string().transform(normalizeCustomerId) });
const statusSchema = z.object({ status: z.enum(['ENABLED', 'PAUSED']) });

const getCurrentUserId = (req: express.Request): string => String((req as any).user?.id || '');

const publicConnection = (connection: any) => connection ? {
  id: connection.id,
  googleUserId: connection.googleUserId,
  googleUserName: connection.googleUserName,
  customerId: connection.customerId,
  customerName: connection.customerName,
  managerCustomerId: connection.managerCustomerId,
  currency: connection.currency || 'BRL',
  status: connection.status,
  tokenExpiresAt: connection.tokenExpiresAt,
  lastSyncedAt: connection.lastSyncedAt,
  lastError: connection.lastError,
  createdAt: connection.createdAt,
  updatedAt: connection.updatedAt,
} : null;

const publicCampaign = (campaign: any) => ({
  id: campaign.id,
  googleCampaignId: campaign.googleCampaignId,
  googleAdGroupId: campaign.googleAdGroupId,
  googleAdId: campaign.googleAdId,
  name: campaign.name,
  objective: campaign.objective,
  status: campaign.status,
  dailyBudgetCents: Number(campaign.dailyBudgetCents || 0),
  startDate: campaign.startDate,
  endDate: campaign.endDate,
  locationLabel: campaign.locationLabel,
  locationResourceName: campaign.locationResourceName,
  destinationUrl: campaign.destinationUrl,
  headline: campaign.headline,
  adText: campaign.adText,
  keywords: Array.isArray(campaign.keywords) ? campaign.keywords : [],
  impressions: Number(campaign.impressions || 0),
  reach: Number(campaign.reach || 0),
  clicks: Number(campaign.clicks || 0),
  leads: Number(campaign.leads || 0),
  spendCents: Number(campaign.spendCents || 0),
  conversions: Number(campaign.conversions || 0),
  lastInsightAt: campaign.lastInsightAt,
  errorMessage: campaign.errorMessage,
  createdAt: campaign.createdAt,
  updatedAt: campaign.updatedAt,
});

const getConnection = async (ownerId: string) => db.query.googleAdsConnections.findFirst({ where: eq(schema.googleAdsConnections.ownerId, ownerId) });

const ensureGoogleAdsDatabase = async () => {
  if (!isDbConnected && dbReadyPromise) await Promise.race([
    dbReadyPromise.catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (!isDbConnected || !db) throw Object.assign(new Error('O banco de dados do Navo está indisponível no momento.'), { status: 503 });
};

const databaseError = (error: any) => {
  const message = String(error?.message || '');
  const missingTable = error?.code === '42P01' || (/google_ads_(connections|campaigns|leads)/i.test(message) && /does not exist|não existe/i.test(message));
  return Object.assign(new Error(missingTable
    ? 'A estrutura do Google Ads ainda não foi criada no banco. Aplique a migração drizzle/0032_google_ads.sql no Supabase e tente novamente.'
    : 'O banco de dados do Navo está indisponível no momento.'), { status: 503 });
};

const redirectToAdmin = (res: express.Response, result: 'connected' | 'error', reason?: string) => {
  const base = String(process.env.PUBLIC_APP_ORIGIN || process.env.APP_URL || 'https://navoproject.vercel.app').replace(/\/$/, '');
  const url = new URL(`${base}/admin`);
  url.searchParams.set('system_tab', 'google_ads');
  url.searchParams.set('google_ads_result', result);
  if (reason) url.searchParams.set('reason', reason.slice(0, 300));
  return res.redirect(url.toString());
};

googleAdsRouter.get('/status', requireAuth, requireAdmin, async (_req, res) => {
  try {
    await ensureGoogleAdsDatabase();
    const config = getGoogleAdsConfig();
    const connection = await getConnection(getCurrentUserId(_req));
    return res.json({ configured: config.configured, apiVersion: config.apiVersion, connection: publicConnection(connection) });
  } catch (error: any) {
    const normalized = databaseError(error);
    return res.status(normalized.status || 503).json({ error: normalized.message, code: error?.code || 'GOOGLE_ADS_DATABASE_UNAVAILABLE' });
  }
});

googleAdsRouter.get('/oauth/start', requireAuth, requireAdmin, async (req, res) => {
  try {
    const state = createGoogleOAuthState(getCurrentUserId(req));
    const url = buildGoogleOAuthUrl(state);
    res.cookie('google_ads_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });
    return res.json({ url });
  } catch (error: any) {
    return res.status(503).json({ error: error?.message || 'A integração Google Ads não está configurada.' });
  }
});

googleAdsRouter.get('/oauth/callback', async (req, res) => {
  const token = req.cookies?.token;
  const state = String(req.query.state || '');
  const code = String(req.query.code || '');
  try {
    await ensureGoogleAdsDatabase();
    if (!token || !state || !code) return redirectToAdmin(res, 'error', 'A autorização Google foi interrompida.');
    const user: any = jwt.verify(token, JWT_SECRET);
    if (user?.role !== 'admin' || !verifyGoogleOAuthState(state, String(user.id))) return redirectToAdmin(res, 'error', 'A autorização expirou ou não pertence a esta sessão.');

    const exchanged = await exchangeGoogleCode(code);
    const accessToken = exchanged.accessToken || (await refreshGoogleAccessToken(exchanged.refreshToken)).accessToken;
    const [profile, customers] = await Promise.all([
      getGoogleUserInfo(accessToken),
      listAccessibleGoogleCustomers(accessToken),
    ]);
    const firstCustomer = customers.find((customer) => !customer.manager) || customers[0];
    const config = getGoogleAdsConfig();
    const expiresAt = exchanged.expiresIn ? new Date(Date.now() + exchanged.expiresIn * 1000) : null;
    const existing = await db.query.googleAdsConnections.findFirst({ where: eq(schema.googleAdsConnections.ownerId, String(user.id)) });
    const values = {
      googleUserId: profile.id,
      googleUserName: profile.name,
      refreshToken: encryptGoogleRefreshToken(exchanged.refreshToken),
      tokenExpiresAt: expiresAt,
      customerId: firstCustomer?.customerId || null,
      customerName: firstCustomer?.name || null,
      managerCustomerId: config.loginCustomerId || null,
      currency: firstCustomer?.currency || 'BRL',
      status: 'connected',
      lastError: null,
      updatedAt: new Date(),
    };
    if (existing) {
      await db.update(schema.googleAdsConnections).set(values).where(eq(schema.googleAdsConnections.id, existing.id));
    } else {
      await db.insert(schema.googleAdsConnections).values({ id: `google_conn_${crypto.randomUUID()}`, ownerId: String(user.id), ...values });
    }
    res.clearCookie('google_ads_oauth_state', { path: '/' });
    return redirectToAdmin(res, 'connected');
  } catch (error: any) {
    console.error('[Google Ads] OAuth callback failed:', error?.message || error);
    return redirectToAdmin(res, 'error', error?.message || 'Não foi possível concluir a conexão com o Google Ads.');
  }
});

googleAdsRouter.get('/assets', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureGoogleAdsDatabase();
    const connection = await getConnection(getCurrentUserId(req));
    if (!connection?.refreshToken) return res.status(409).json({ error: 'Conecte uma conta Google Ads antes de carregar as contas.' });
    const accessToken = (await refreshGoogleAccessToken(decryptGoogleRefreshToken(connection.refreshToken))).accessToken;
    return res.json({ customers: await listAccessibleGoogleCustomers(accessToken), connection: publicConnection(connection) });
  } catch (error: any) {
    return res.status(error?.status || 502).json({ error: error?.message || 'Não foi possível carregar as contas Google Ads.' });
  }
});

googleAdsRouter.put('/assets', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureGoogleAdsDatabase();
    const parsed = assetsSchema.safeParse(req.body);
    if (!parsed.success || parsed.data.customerId.length !== 10) return res.status(400).json({ error: 'Informe um Customer ID Google Ads válido com 10 dígitos.' });
    const ownerId = getCurrentUserId(req);
    const connection = await getConnection(ownerId);
    if (!connection?.refreshToken) return res.status(409).json({ error: 'Conecte uma conta Google Ads antes de selecionar o cliente.' });
    const accessToken = (await refreshGoogleAccessToken(decryptGoogleRefreshToken(connection.refreshToken))).accessToken;
    const customers = await listAccessibleGoogleCustomers(accessToken);
    const customer = customers.find((item) => item.customerId === parsed.data.customerId);
    if (!customer) return res.status(400).json({ error: 'Essa conta Google Ads não pertence à autorização atual.' });
    const [updated] = await db.update(schema.googleAdsConnections).set({
      customerId: customer.customerId,
      customerName: customer.name,
      currency: customer.currency || 'BRL',
      status: 'connected',
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(schema.googleAdsConnections.id, connection.id)).returning();
    return res.json({ connection: publicConnection(updated) });
  } catch (error: any) {
    return res.status(error?.status || 502).json({ error: error?.message || 'Não foi possível salvar a conta Google Ads.' });
  }
});

googleAdsRouter.post('/disconnect', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureGoogleAdsDatabase();
    const connection = await getConnection(getCurrentUserId(req));
    if (!connection) return res.json({ connection: null });
    await db.update(schema.googleAdsConnections).set({ refreshToken: '', status: 'disconnected', lastError: null, updatedAt: new Date() }).where(eq(schema.googleAdsConnections.id, connection.id));
    return res.json({ success: true });
  } catch (error: any) {
    const normalized = databaseError(error);
    return res.status(normalized.status || 503).json({ error: normalized.message });
  }
});

googleAdsRouter.get('/campaigns', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureGoogleAdsDatabase();
    const campaigns = await db.query.googleAdsCampaigns.findMany({ where: eq(schema.googleAdsCampaigns.ownerId, getCurrentUserId(req)), orderBy: [desc(schema.googleAdsCampaigns.updatedAt)] });
    const totals = campaigns.reduce((acc, campaign) => ({
      spendCents: acc.spendCents + Number(campaign.spendCents || 0),
      leads: acc.leads + Number(campaign.leads || 0),
      clicks: acc.clicks + Number(campaign.clicks || 0),
      reach: acc.reach + Number(campaign.reach || 0),
      impressions: acc.impressions + Number(campaign.impressions || 0),
      conversions: acc.conversions + Number(campaign.conversions || 0),
    }), { spendCents: 0, leads: 0, clicks: 0, reach: 0, impressions: 0, conversions: 0 });
    return res.json({ campaigns: campaigns.map(publicCampaign), totals });
  } catch (error: any) {
    const normalized = databaseError(error);
    return res.status(normalized.status || 503).json({ error: normalized.message, code: error?.code || 'GOOGLE_ADS_DATABASE_UNAVAILABLE' });
  }
});

googleAdsRouter.post('/campaigns/sync', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureGoogleAdsDatabase();
    const ownerId = getCurrentUserId(req);
    const connection = await getConnection(ownerId);
    if (!connection?.refreshToken || !connection.customerId) return res.status(409).json({ error: 'Conecte o Google Ads e selecione uma conta antes de sincronizar.' });
    const accessToken = (await refreshGoogleAccessToken(decryptGoogleRefreshToken(connection.refreshToken))).accessToken;
    const remoteCampaigns = await listGoogleCampaigns(accessToken, connection.customerId);
    const syncedAt = new Date();
    for (const raw of remoteCampaigns.slice(0, 100)) {
      const normalized = normalizeGoogleCampaign(raw);
      if (!normalized.googleCampaignId) continue;
      const existing = await db.query.googleAdsCampaigns.findFirst({ where: and(eq(schema.googleAdsCampaigns.ownerId, ownerId), eq(schema.googleAdsCampaigns.googleCampaignId, normalized.googleCampaignId)) });
      const values = {
        ownerId,
        connectionId: connection.id,
        customerId: connection.customerId,
        googleCampaignId: normalized.googleCampaignId,
        googleAdGroupId: normalized.googleAdGroupId,
        googleAdId: normalized.googleAdId,
        name: normalized.name,
        objective: normalized.objective,
        status: normalized.status,
        dailyBudgetCents: normalized.dailyBudgetCents,
        startDate: normalized.startDate,
        endDate: normalized.endDate,
        impressions: normalized.impressions,
        reach: normalized.reach,
        clicks: normalized.clicks,
        leads: normalized.leads,
        spendCents: normalized.spendCents,
        conversions: String(normalized.conversions),
        lastInsightAt: syncedAt,
        errorMessage: null,
        updatedAt: syncedAt,
      };
      if (existing) await db.update(schema.googleAdsCampaigns).set(values).where(eq(schema.googleAdsCampaigns.id, existing.id));
      else await db.insert(schema.googleAdsCampaigns).values({ id: `google_campaign_${crypto.randomUUID()}`, keywords: [], ...values });
    }
    await db.update(schema.googleAdsConnections).set({ lastSyncedAt: syncedAt, lastError: null, status: 'connected', updatedAt: syncedAt }).where(eq(schema.googleAdsConnections.id, connection.id));
    const campaigns = await db.query.googleAdsCampaigns.findMany({ where: eq(schema.googleAdsCampaigns.ownerId, ownerId), orderBy: [desc(schema.googleAdsCampaigns.updatedAt)] });
    return res.json({ campaigns: campaigns.map(publicCampaign), syncedAt });
  } catch (error: any) {
    const normalized = databaseError(error);
    return res.status(normalized.status || error?.status || 502).json({ error: error?.message || normalized.message });
  }
});

googleAdsRouter.post('/campaigns', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureGoogleAdsDatabase();
    const parsed = campaignInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Revise nome, orçamento, período, público, títulos, descrições, palavras-chave e destino da campanha.' });
    const input = parsed.data;
    if (input.startDate && input.endDate && input.endDate < input.startDate) return res.status(400).json({ error: 'A data final não pode ser anterior à data inicial.' });
    const ownerId = getCurrentUserId(req);
    const connection = await getConnection(ownerId);
    if (!connection?.refreshToken || !connection.customerId) return res.status(409).json({ error: 'Conecte o Google Ads e selecione uma conta antes de criar campanhas.' });
    const accessToken = (await refreshGoogleAccessToken(decryptGoogleRefreshToken(connection.refreshToken))).accessToken;
    const remote = await createGoogleSearchCampaign(accessToken, connection.customerId, input);
    const syncedAt = new Date();
    const campaignId = googleCampaignIdFromResource(remote.campaignResourceName);
    const [campaign] = await db.insert(schema.googleAdsCampaigns).values({
      id: `google_campaign_${crypto.randomUUID()}`,
      ownerId,
      connectionId: connection.id,
      customerId: connection.customerId,
      googleCampaignId: campaignId,
      googleAdGroupId: googleCampaignIdFromResource(remote.adGroupResourceName),
      googleAdId: googleCampaignIdFromResource(remote.adResourceName),
      name: input.name,
      objective: 'SEARCH',
      status: 'PAUSED',
      dailyBudgetCents: input.dailyBudgetCents,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      locationLabel: input.locationLabel || null,
      locationResourceName: input.locationResourceName || null,
      destinationUrl: input.destinationUrl,
      adText: input.descriptions.join(' | '),
      headline: input.headlines[0] || null,
      keywords: input.keywords,
      lastInsightAt: null,
      errorMessage: null,
      createdAt: syncedAt,
      updatedAt: syncedAt,
    }).returning();
    return res.status(201).json({ campaign: publicCampaign(campaign), message: 'Campanha Google criada pausada. Revise no Google Ads antes de ativar.' });
  } catch (error: any) {
    return res.status(error?.status || 502).json({ error: error?.message || 'Não foi possível criar a campanha Google.' });
  }
});

googleAdsRouter.patch('/campaigns/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureGoogleAdsDatabase();
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Status de campanha inválido.' });
    const ownerId = getCurrentUserId(req);
    const campaign = await db.query.googleAdsCampaigns.findFirst({ where: and(eq(schema.googleAdsCampaigns.id, req.params.id), eq(schema.googleAdsCampaigns.ownerId, ownerId)) });
    if (!campaign) return res.status(404).json({ error: 'Campanha Google não encontrada.' });
    const connection = await getConnection(ownerId);
    if (!connection?.refreshToken || !connection.customerId) return res.status(409).json({ error: 'Conecte o Google Ads antes de alterar o status.' });
    const accessToken = (await refreshGoogleAccessToken(decryptGoogleRefreshToken(connection.refreshToken))).accessToken;
    await updateGoogleCampaignStatus(accessToken, connection.customerId, campaign.googleCampaignId, parsed.data.status);
    const [updated] = await db.update(schema.googleAdsCampaigns).set({ status: parsed.data.status === 'ENABLED' ? 'ACTIVE' : 'PAUSED', errorMessage: null, updatedAt: new Date() }).where(eq(schema.googleAdsCampaigns.id, campaign.id)).returning();
    return res.json({ campaign: publicCampaign(updated) });
  } catch (error: any) {
    return res.status(error?.status || 502).json({ error: error?.message || 'Não foi possível alterar o status da campanha Google.' });
  }
});

googleAdsRouter.get('/leads', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureGoogleAdsDatabase();
    const leads = await db.query.googleAdsLeads.findMany({ where: eq(schema.googleAdsLeads.ownerId, getCurrentUserId(req)), orderBy: [desc(schema.googleAdsLeads.receivedAt)], limit: 200 });
    return res.json({ leads });
  } catch (error: any) {
    const normalized = databaseError(error);
    return res.status(normalized.status || 503).json({ error: normalized.message });
  }
});
