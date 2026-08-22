import express from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { JWT_SECRET } from '../config/env.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import {
  buildMetaOAuthUrl,
  createMetaAd,
  createMetaAdSet,
  createMetaCampaign,
  createMetaCreative,
  createOAuthState,
  decryptMetaAccessToken,
  encryptMetaAccessToken,
  exchangeMetaCode,
  extendMetaAccessToken,
  getCampaignInsight,
  getMetaAdsConfig,
  getMetaProfile,
  listMetaAdAccounts,
  listMetaCampaigns,
  listMetaPages,
  metaGraphRequest,
  updateMetaStatus,
  verifyOAuthState,
  type MetaAsset,
  type MetaPageAsset,
} from '../services/meta-ads.service.js';

export const metaAdsRouter = express.Router();

const campaignInputSchema = z.object({
  name: z.string().trim().min(3).max(120),
  objective: z.literal('OUTCOME_TRAFFIC').default('OUTCOME_TRAFFIC'),
  dailyBudgetCents: z.number().int().min(100).max(5_000_000),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  locationLabel: z.string().trim().min(2).max(120),
  locationKey: z.string().trim().min(2).max(80).optional().nullable(),
  destinationUrl: z.string().url().max(2_000),
  adText: z.string().trim().min(3).max(500),
  headline: z.string().trim().min(3).max(80),
  imageUrl: z.string().url().max(2_000),
});

const statusSchema = z.object({ status: z.enum(['ACTIVE', 'PAUSED']) });
const assetSelectionSchema = z.object({
  adAccountId: z.string().trim().min(3).max(100),
  pageId: z.string().trim().min(3).max(100),
});

const redirectToAdmin = (res: express.Response, result: 'connected' | 'error', reason?: string) => {
  const query = new URLSearchParams({ metaAds: result });
  if (reason) query.set('reason', reason.slice(0, 180));
  return res.redirect(`/admin?${query.toString()}`);
};

const getCurrentUserId = (req: express.Request): string => String((req as any).user?.id || '');

const getConnection = async (ownerId: string) => db.query.metaAdsConnections.findFirst({ where: eq(schema.metaAdsConnections.ownerId, ownerId) });

const publicConnection = (connection: any) => connection ? {
  id: connection.id,
  status: connection.status,
  metaUserId: connection.metaUserId,
  metaUserName: connection.metaUserName,
  adAccountId: connection.adAccountId,
  adAccountName: connection.adAccountName,
  currency: connection.currency || 'BRL',
  pageId: connection.pageId,
  pageName: connection.pageName,
  lastSyncedAt: connection.lastSyncedAt,
  lastError: connection.lastError,
  tokenExpiresAt: connection.tokenExpiresAt,
} : null;

const publicCampaign = (campaign: any) => ({
  id: campaign.id,
  metaCampaignId: campaign.metaCampaignId,
  name: campaign.name,
  objective: campaign.objective,
  status: campaign.status,
  dailyBudgetCents: campaign.dailyBudgetCents,
  startDate: campaign.startDate,
  endDate: campaign.endDate,
  locationLabel: campaign.locationLabel,
  destinationUrl: campaign.destinationUrl,
  adText: campaign.adText,
  headline: campaign.headline,
  imageUrl: campaign.imageUrl,
  impressions: campaign.impressions,
  reach: campaign.reach,
  clicks: campaign.clicks,
  leads: campaign.leads,
  spendCents: campaign.spendCents,
  lastInsightAt: campaign.lastInsightAt,
  errorMessage: campaign.errorMessage,
  createdAt: campaign.createdAt,
  updatedAt: campaign.updatedAt,
});

const getOwnedCampaign = async (ownerId: string, id: string) => db.query.metaAdsCampaigns.findFirst({
  where: and(eq(schema.metaAdsCampaigns.id, id), eq(schema.metaAdsCampaigns.ownerId, ownerId)),
});

const accountPath = (adAccountId: string) => `/act_${encodeURIComponent(adAccountId.replace(/^act_/, ''))}`;

metaAdsRouter.get('/status', requireAuth, requireAdmin, async (req, res) => {
  const config = getMetaAdsConfig();
  const connection = await getConnection(getCurrentUserId(req));
  return res.json({ configured: config.configured, graphApiVersion: config.graphApiVersion, connection: publicConnection(connection) });
});

metaAdsRouter.get('/oauth/start', requireAuth, requireAdmin, async (req, res) => {
  try {
    const state = createOAuthState(getCurrentUserId(req));
    const url = buildMetaOAuthUrl(state);
    res.cookie('meta_ads_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });
    return res.json({ url });
  } catch (error: any) {
    return res.status(503).json({ error: error?.message || 'A integração Meta Ads não está configurada.' });
  }
});

metaAdsRouter.get('/oauth/callback', async (req, res) => {
  const token = req.cookies?.token;
  const state = String(req.query.state || '');
  const code = String(req.query.code || '');
  try {
    if (!token || !state || !code) return redirectToAdmin(res, 'error', 'A autorização Meta foi interrompida.');
    const user: any = jwt.verify(token, JWT_SECRET);
    if (user?.role !== 'admin' || !verifyOAuthState(state, String(user.id))) return redirectToAdmin(res, 'error', 'A autorização expirou ou não pertence a esta sessão.');

    let exchanged = await exchangeMetaCode(code);
    try {
      exchanged = await extendMetaAccessToken(exchanged.accessToken);
    } catch {
      // Alguns ambientes de desenvolvimento não permitem a troca imediata.
      // O token retornado pela troca do código continua sendo usado temporariamente.
    }

    const profile = await getMetaProfile(exchanged.accessToken);
    const [accounts, pages] = await Promise.all([
      listMetaAdAccounts(exchanged.accessToken),
      listMetaPages(exchanged.accessToken).catch(() => [] as MetaPageAsset[]),
    ]);
    const firstAccount = accounts[0];
    const firstPage = pages[0];
    const expiresAt = exchanged.expiresIn ? new Date(Date.now() + exchanged.expiresIn * 1000) : null;

    await db.insert(schema.metaAdsConnections).values({
      id: `meta_conn_${crypto.randomUUID()}`,
      ownerId: String(user.id),
      metaUserId: String(profile.id || ''),
      metaUserName: String(profile.name || ''),
      accessToken: encryptMetaAccessToken(exchanged.accessToken),
      tokenExpiresAt: expiresAt,
      adAccountId: firstAccount?.id || null,
      adAccountName: firstAccount?.name || null,
      currency: firstAccount?.currency || 'BRL',
      pageId: firstPage?.id || null,
      pageName: firstPage?.name || null,
      status: 'connected',
      lastError: null,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: schema.metaAdsConnections.ownerId,
      set: {
        metaUserId: String(profile.id || ''),
        metaUserName: String(profile.name || ''),
        accessToken: encryptMetaAccessToken(exchanged.accessToken),
        tokenExpiresAt: expiresAt,
        adAccountId: firstAccount?.id || null,
        adAccountName: firstAccount?.name || null,
        currency: firstAccount?.currency || 'BRL',
        pageId: firstPage?.id || null,
        pageName: firstPage?.name || null,
        status: 'connected',
        lastError: null,
        updatedAt: new Date(),
      },
    });

    res.clearCookie('meta_ads_oauth_state', { path: '/' });
    return redirectToAdmin(res, 'connected');
  } catch (error: any) {
    console.error('[Meta Ads] OAuth callback failed:', error?.message || error);
    return redirectToAdmin(res, 'error', error?.message || 'Não foi possível concluir a conexão com a Meta.');
  }
});

metaAdsRouter.get('/assets', requireAuth, requireAdmin, async (req, res) => {
  try {
    const connection = await getConnection(getCurrentUserId(req));
    if (!connection?.accessToken) return res.status(409).json({ error: 'Conecte uma conta Meta Ads antes de carregar os ativos.' });
    const accessToken = decryptMetaAccessToken(connection.accessToken);
    const [accounts, pages] = await Promise.all([listMetaAdAccounts(accessToken), listMetaPages(accessToken).catch(() => [])]);
    return res.json({ accounts, pages, connection: publicConnection(connection) });
  } catch (error: any) {
    return res.status(error?.status || 502).json({ error: error?.message || 'Não foi possível carregar os ativos da Meta.' });
  }
});

metaAdsRouter.put('/assets', requireAuth, requireAdmin, async (req, res) => {
  try {
    const parsed = assetSelectionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Selecione uma conta de anúncios e uma Página válidas.' });
    const ownerId = getCurrentUserId(req);
    const connection = await getConnection(ownerId);
    if (!connection?.accessToken) return res.status(409).json({ error: 'Conecte uma conta Meta Ads antes de selecionar os ativos.' });
    const accessToken = decryptMetaAccessToken(connection.accessToken);
    const [accounts, pages] = await Promise.all([listMetaAdAccounts(accessToken), listMetaPages(accessToken).catch(() => [])]);
    const account = accounts.find((item) => item.id === parsed.data.adAccountId);
    const page = pages.find((item) => item.id === parsed.data.pageId);
    if (!account || !page) return res.status(400).json({ error: 'A conta de anúncios ou a Página não pertence à conexão Meta autorizada.' });
    const [updated] = await db.update(schema.metaAdsConnections).set({
      adAccountId: account.id,
      adAccountName: account.name,
      currency: account.currency || 'BRL',
      pageId: page.id,
      pageName: page.name,
      status: 'connected',
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(schema.metaAdsConnections.id, connection.id)).returning();
    return res.json({ connection: publicConnection(updated) });
  } catch (error: any) {
    return res.status(error?.status || 502).json({ error: error?.message || 'Não foi possível salvar os ativos Meta.' });
  }
});

metaAdsRouter.post('/disconnect', requireAuth, requireAdmin, async (req, res) => {
  const ownerId = getCurrentUserId(req);
  const connection = await getConnection(ownerId);
  if (!connection) return res.json({ connection: null });
  await db.update(schema.metaAdsConnections).set({
    accessToken: '',
    status: 'disconnected',
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(schema.metaAdsConnections.id, connection.id));
  return res.json({ success: true });
});

metaAdsRouter.get('/locations', requireAuth, requireAdmin, async (req, res) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    if (query.length < 2) return res.json({ locations: [] });
    const connection = await getConnection(getCurrentUserId(req));
    if (!connection?.accessToken) return res.status(409).json({ error: 'Conecte a Meta antes de pesquisar localizações.' });
    const response = await metaGraphRequest<{ data?: any[] }>('/search', decryptMetaAccessToken(connection.accessToken), {
      type: 'adgeolocation',
      location_types: ['city'],
      q: query,
      limit: 20,
    });
    return res.json({ locations: (response.data || []).map((item) => ({ key: String(item.key || ''), name: String(item.name || ''), region: String(item.region || ''), country: String(item.country_code || '') })).filter((item) => item.key && item.name) });
  } catch (error: any) {
    return res.status(error?.status || 502).json({ error: error?.message || 'Não foi possível pesquisar localidades na Meta.' });
  }
});

metaAdsRouter.get('/campaigns', requireAuth, requireAdmin, async (req, res) => {
  const ownerId = getCurrentUserId(req);
  const campaigns = await db.query.metaAdsCampaigns.findMany({ where: eq(schema.metaAdsCampaigns.ownerId, ownerId), orderBy: [desc(schema.metaAdsCampaigns.updatedAt)] });
  const totals = campaigns.reduce((acc, campaign) => {
    acc.spendCents += Number(campaign.spendCents || 0);
    acc.leads += Number(campaign.leads || 0);
    acc.clicks += Number(campaign.clicks || 0);
    acc.reach += Number(campaign.reach || 0);
    acc.impressions += Number(campaign.impressions || 0);
    return acc;
  }, { spendCents: 0, leads: 0, clicks: 0, reach: 0, impressions: 0 });
  return res.json({ campaigns: campaigns.map(publicCampaign), totals });
});

metaAdsRouter.post('/campaigns/sync', requireAuth, requireAdmin, async (req, res) => {
  try {
    const ownerId = getCurrentUserId(req);
    const connection = await getConnection(ownerId);
    if (!connection?.accessToken || !connection.adAccountId) return res.status(409).json({ error: 'Conecte a Meta e selecione uma conta de anúncios antes de sincronizar.' });
    const accessToken = decryptMetaAccessToken(connection.accessToken);
    const remoteCampaigns = await listMetaCampaigns(accessToken, connection.adAccountId);
    const syncedAt = new Date();
    for (const remote of remoteCampaigns.slice(0, 100)) {
      const insight = await getCampaignInsight(accessToken, String(remote.id)).catch(() => ({ impressions: 0, reach: 0, clicks: 0, spendCents: 0, leads: 0 }));
      const existing = await db.query.metaAdsCampaigns.findFirst({ where: and(eq(schema.metaAdsCampaigns.ownerId, ownerId), eq(schema.metaAdsCampaigns.metaCampaignId, String(remote.id))) });
      const values = {
        ownerId,
        connectionId: connection.id,
        metaCampaignId: String(remote.id),
        name: String(remote.name || `Campanha ${remote.id}`),
        objective: String(remote.objective || 'OUTCOME_TRAFFIC'),
        status: String(remote.status || 'PAUSED'),
        dailyBudgetCents: Number(remote.daily_budget || 0),
        startDate: remote.start_time ? String(remote.start_time).slice(0, 10) : null,
        endDate: remote.stop_time ? String(remote.stop_time).slice(0, 10) : null,
        impressions: insight.impressions,
        reach: insight.reach,
        clicks: insight.clicks,
        leads: insight.leads,
        spendCents: insight.spendCents,
        lastInsightAt: syncedAt,
        errorMessage: null,
        updatedAt: syncedAt,
      };
      if (existing) {
        await db.update(schema.metaAdsCampaigns).set(values).where(eq(schema.metaAdsCampaigns.id, existing.id));
      } else {
        await db.insert(schema.metaAdsCampaigns).values({ id: `meta_campaign_${crypto.randomUUID()}`, ...values });
      }
    }
    await db.update(schema.metaAdsConnections).set({ lastSyncedAt: syncedAt, lastError: null, status: 'connected', updatedAt: syncedAt }).where(eq(schema.metaAdsConnections.id, connection.id));
    const campaigns = await db.query.metaAdsCampaigns.findMany({ where: eq(schema.metaAdsCampaigns.ownerId, ownerId), orderBy: [desc(schema.metaAdsCampaigns.updatedAt)] });
    return res.json({ campaigns: campaigns.map(publicCampaign), syncedAt });
  } catch (error: any) {
    const ownerId = getCurrentUserId(req);
    const connection = await getConnection(ownerId).catch(() => null);
    if (connection) await db.update(schema.metaAdsConnections).set({ status: 'error', lastError: String(error?.message || 'Erro de sincronização').slice(0, 500), updatedAt: new Date() }).where(eq(schema.metaAdsConnections.id, connection.id)).catch(() => {});
    return res.status(error?.status || 502).json({ error: error?.message || 'Não foi possível sincronizar campanhas da Meta.' });
  }
});

metaAdsRouter.post('/campaigns', requireAuth, requireAdmin, async (req, res) => {
  try {
    const parsed = campaignInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Revise nome, orçamento, período, público, texto, imagem e destino da campanha.' });
    const input = parsed.data;
    if (input.startDate && input.endDate && input.endDate < input.startDate) return res.status(400).json({ error: 'A data final não pode ser anterior à data inicial.' });
    const ownerId = getCurrentUserId(req);
    const connection = await getConnection(ownerId);
    if (!connection?.accessToken || !connection.adAccountId || !connection.pageId) return res.status(409).json({ error: 'Conecte a Meta e selecione uma conta de anúncios e uma Página antes de criar campanhas.' });
    const accessToken = decryptMetaAccessToken(connection.accessToken);
    const targeting = input.locationKey
      ? { geo_locations: { cities: [{ key: input.locationKey, radius: 25, distance_unit: 'kilometer' }] } }
      : { geo_locations: { countries: ['BR'] } };
    const remoteCampaign = await createMetaCampaign(accessToken, connection.adAccountId, { name: input.name, objective: input.objective });
    const remoteAdSet = await createMetaAdSet(accessToken, connection.adAccountId, {
      name: `${input.name} · Público`,
      campaignId: String(remoteCampaign.id),
      dailyBudgetCents: input.dailyBudgetCents,
      targeting,
      startDate: input.startDate || undefined,
      endDate: input.endDate || undefined,
    });
    const remoteCreative = await createMetaCreative(accessToken, connection.adAccountId, {
      name: `${input.name} · Criativo`,
      pageId: connection.pageId,
      adText: input.adText,
      headline: input.headline,
      destinationUrl: input.destinationUrl,
      imageUrl: input.imageUrl,
    });
    const remoteAd = await createMetaAd(accessToken, connection.adAccountId, {
      name: `${input.name} · Anúncio`,
      adSetId: String(remoteAdSet.id),
      creativeId: String(remoteCreative.id),
    });
    const [created] = await db.insert(schema.metaAdsCampaigns).values({
      id: `meta_campaign_${crypto.randomUUID()}`,
      ownerId,
      connectionId: connection.id,
      metaCampaignId: String(remoteCampaign.id),
      metaAdSetId: String(remoteAdSet.id),
      metaCreativeId: String(remoteCreative.id),
      metaAdId: String(remoteAd.id),
      name: input.name,
      objective: input.objective,
      status: 'PAUSED',
      dailyBudgetCents: input.dailyBudgetCents,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      locationLabel: input.locationLabel,
      locationKey: input.locationKey || null,
      destinationUrl: input.destinationUrl,
      adText: input.adText,
      headline: input.headline,
      imageUrl: input.imageUrl,
      updatedAt: new Date(),
    }).returning();
    return res.status(201).json({ campaign: publicCampaign(created), message: 'Campanha criada pausada. Revise os dados antes de ativá-la.' });
  } catch (error: any) {
    return res.status(error?.status || 502).json({ error: error?.message || 'Não foi possível criar a campanha na Meta.' });
  }
});

metaAdsRouter.patch('/campaigns/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Status de campanha inválido.' });
    const campaign = await getOwnedCampaign(getCurrentUserId(req), req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' });
    const connection = await getConnection(getCurrentUserId(req));
    if (!connection?.accessToken) return res.status(409).json({ error: 'A conexão Meta não está disponível.' });
    const accessToken = decryptMetaAccessToken(connection.accessToken);
    const objectIds = [campaign.metaCampaignId, campaign.metaAdSetId, campaign.metaAdId].filter(Boolean) as string[];
    for (const objectId of objectIds) await updateMetaStatus(accessToken, objectId, parsed.data.status);
    const [updated] = await db.update(schema.metaAdsCampaigns).set({ status: parsed.data.status, errorMessage: null, updatedAt: new Date() }).where(eq(schema.metaAdsCampaigns.id, campaign.id)).returning();
    return res.json({ campaign: publicCampaign(updated) });
  } catch (error: any) {
    return res.status(error?.status || 502).json({ error: error?.message || 'Não foi possível alterar o status da campanha.' });
  }
});

metaAdsRouter.get('/leads', requireAuth, requireAdmin, async (req, res) => {
  const leads = await db.query.metaAdsLeads.findMany({ where: eq(schema.metaAdsLeads.ownerId, getCurrentUserId(req)), orderBy: [desc(schema.metaAdsLeads.receivedAt)], limit: 100 });
  return res.json({ leads: leads.map((lead) => ({ id: lead.id, campaignId: lead.campaignId, fullName: lead.fullName, phone: lead.phone, email: lead.email, receivedAt: lead.receivedAt })) });
});
