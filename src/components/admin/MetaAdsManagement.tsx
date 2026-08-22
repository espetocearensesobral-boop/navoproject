import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, CheckCircle2, ExternalLink, Eye, ImagePlus, Link2, MapPin, Megaphone, Pause, Play, Plus, RefreshCw, Target, Users, X } from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { AdminEmptyState } from './shared/AdminEmptyState';
import { AdminListSkeleton } from './shared/AdminSkeleton';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  createMetaCampaign,
  formatCents,
  formatCompactNumber,
  getMetaAdsStatus,
  getMetaCampaigns,
  syncMetaCampaigns,
  updateMetaCampaignStatus,
  type MetaAdsConnection,
  type MetaCampaign,
  type MetaCampaignForm,
} from '../../services/metaAdsService';
import {
  CAMPAIGNS_DEMO_MODE,
  createDemoMetaCampaign,
  demoMetaCampaigns,
  demoMetaConnection,
  demoMetaTotals,
} from '../../services/campaignDemoData';

interface MetaAdsManagementProps {
  onOpenSettings?: () => void;
}

const initialForm: MetaCampaignForm = {
  name: '',
  objective: 'OUTCOME_TRAFFIC',
  dailyBudgetCents: 1000,
  startDate: '',
  endDate: '',
  locationLabel: 'Sobral e região',
  locationKey: '',
  destinationUrl: 'https://navoproject.vercel.app/?catalog=1',
  adText: 'Agende seu atendimento na Navo Barber & Club.',
  headline: 'Agende seu horário',
  imageUrl: '',
};

const statusLabel: Record<string, string> = {
  ACTIVE: 'Ativa',
  PAUSED: 'Pausada',
  ARCHIVED: 'Arquivada',
  DELETED: 'Excluída',
  WITH_ISSUES: 'Com pendência',
};

const statusClass: Record<string, string> = {
  ACTIVE: 'bg-status-success/10 text-status-success',
  PAUSED: 'bg-amber-500/10 text-amber-300',
  ARCHIVED: 'bg-surface-base text-content-muted',
  DELETED: 'bg-red-500/10 text-red-300',
  WITH_ISSUES: 'bg-red-500/10 text-red-300',
};

const dateToday = () => new Date().toISOString().slice(0, 10);

const MetricCard: React.FC<{ icon: React.ElementType; label: string; value: string; helper?: string; tone?: string }> = ({ icon: Icon, label, value, helper, tone = 'text-gold-base' }) => (
  <div className="rounded-xl border border-border-subtle bg-surface-card p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-content-muted">{label}</p><p className={`mt-2 text-xl font-bold tracking-tight ${tone}`}>{value}</p></div><div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-surface-base ${tone}`}><Icon className="h-4 w-4" /></div></div>
    {helper && <p className="mt-2 text-[11px] text-content-muted">{helper}</p>}
  </div>
);

export const MetaAdsManagement: React.FC<MetaAdsManagementProps> = ({ onOpenSettings }) => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [totals, setTotals] = useState({ spendCents: 0, leads: 0, clicks: 0, reach: 0, impressions: 0 });
  const [connection, setConnection] = useState<MetaAdsConnection | null>(null);
  const [configured, setConfigured] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<MetaCampaignForm>(initialForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ campaign: MetaCampaign; status: 'ACTIVE' | 'PAUSED' } | null>(null);

  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setLoadError(null);
    if (CAMPAIGNS_DEMO_MODE) {
      setConfigured(true);
      setConnection({ ...demoMetaConnection });
      setCampaigns([...demoMetaCampaigns]);
      setTotals({ ...demoMetaTotals });
      setLoading(false);
      return;
    }
    try {
      const [statusResponse, campaignResponse] = await Promise.all([getMetaAdsStatus(), getMetaCampaigns()]);
      setConfigured(statusResponse.configured);
      setConnection(statusResponse.connection);
      setCampaigns(campaignResponse.campaigns);
      setTotals(campaignResponse.totals);
    } catch (error: any) {
      const text = error?.message || 'Não foi possível carregar o módulo Campanhas.';
      setLoadError(text);
      setMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!formOpen) return;
    const body = document.body;
    const html = document.documentElement;
    const adminMain = document.querySelector<HTMLElement>('.admin-shell main');
    const previous = {
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      mainOverflow: adminMain?.style.overflow || '',
      mainOverscroll: adminMain?.style.overscrollBehavior || '',
      mainTouchAction: adminMain?.style.touchAction || '',
    };

    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    if (adminMain) {
      adminMain.style.overflow = 'hidden';
      adminMain.style.overscrollBehavior = 'none';
      adminMain.style.touchAction = 'none';
    }

    return () => {
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      if (adminMain) {
        adminMain.style.overflow = previous.mainOverflow;
        adminMain.style.overscrollBehavior = previous.mainOverscroll;
        adminMain.style.touchAction = previous.mainTouchAction;
      }
    };
  }, [formOpen]);

  const sync = async () => {
    setSyncing(true);
    setMessage(null);
    if (CAMPAIGNS_DEMO_MODE) {
      setConnection((previous) => previous ? { ...previous, lastSyncedAt: new Date().toISOString() } : previous);
      setMessage({ type: 'success', text: 'Dados demonstrativos atualizados. Nenhuma conta externa foi consultada.' });
      setSyncing(false);
      return;
    }
    try {
      const response = await syncMetaCampaigns();
      setCampaigns(response.campaigns);
      const nextTotals = response.campaigns.reduce((acc, campaign) => ({
        spendCents: acc.spendCents + campaign.spendCents,
        leads: acc.leads + campaign.leads,
        clicks: acc.clicks + campaign.clicks,
        reach: acc.reach + campaign.reach,
        impressions: acc.impressions + campaign.impressions,
      }), { spendCents: 0, leads: 0, clicks: 0, reach: 0, impressions: 0 });
      setTotals(nextTotals);
      setConnection((previous) => previous ? { ...previous, lastSyncedAt: response.syncedAt, status: 'connected', lastError: null } : previous);
      setLoadError(null);
      setMessage({ type: 'success', text: 'Campanhas e métricas atualizadas a partir da Meta.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível sincronizar com a Meta.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleFormChange = <K extends keyof MetaCampaignForm>(key: K, value: MetaCampaignForm[K]) => setForm((previous) => ({ ...previous, [key]: value }));

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.imageUrl.trim()) {
      setMessage({ type: 'error', text: 'Informe o nome e uma URL pública de imagem para o anúncio.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (CAMPAIGNS_DEMO_MODE) {
        const campaign = createDemoMetaCampaign({ ...form, name: form.name.trim(), dailyBudgetCents: Math.round(Number(form.dailyBudgetCents)) }, campaigns.length);
        setCampaigns((previous) => [campaign, ...previous]);
        setForm(initialForm);
        setFormOpen(false);
        setMessage({ type: 'success', text: 'Campanha criada apenas para demonstração. Nenhuma conta externa foi alterada.' });
        return;
      }
      const response = await createMetaCampaign({ ...form, name: form.name.trim(), dailyBudgetCents: Math.round(Number(form.dailyBudgetCents)) });
      setCampaigns((previous) => [response.campaign, ...previous]);
      setTotals((previous) => previous);
      setForm(initialForm);
      setFormOpen(false);
      setMessage({ type: 'success', text: response.message });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível criar a campanha.' });
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async () => {
    if (!statusTarget) return;
    setBusy(true);
    try {
      if (CAMPAIGNS_DEMO_MODE) {
        setCampaigns((previous) => previous.map((campaign) => campaign.id === statusTarget.campaign.id ? { ...campaign, status: statusTarget.status, updatedAt: new Date().toISOString() } : campaign));
        setMessage({ type: 'success', text: statusTarget.status === 'ACTIVE' ? 'Campanha ativada apenas na demonstração.' : 'Campanha pausada apenas na demonstração.' });
        return;
      }
      const response = await updateMetaCampaignStatus(statusTarget.campaign.id, statusTarget.status);
      setCampaigns((previous) => previous.map((campaign) => campaign.id === response.campaign.id ? response.campaign : campaign));
      setMessage({ type: 'success', text: statusTarget.status === 'ACTIVE' ? 'Campanha ativada na Meta.' : 'Campanha pausada na Meta.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível alterar o status da campanha.' });
    } finally {
      setBusy(false);
      setStatusTarget(null);
    }
  };

  const sortedCampaigns = useMemo(() => [...campaigns].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))), [campaigns]);
  const canCreate = configured && connection?.status === 'connected' && Boolean(connection.adAccountId && connection.pageId);

  if (loading) return <div className="space-y-4"><AdminPageHeader icon={Megaphone} title="Campanhas" /><AdminListSkeleton rows={6} /></div>;

  return (
    <div className="space-y-4 min-w-0">
      <AdminPageHeader icon={Megaphone} title="Campanhas" stats={[{ label: 'campanhas', value: campaigns.length }, { label: 'gasto', value: formatCents(totals.spendCents), tone: 'finance-negative' }]} action={{ label: 'Nova campanha', icon: Plus, onClick: () => setFormOpen(true), disabled: !canCreate }}>
        <button type="button" onClick={sync} disabled={syncing || !canCreate} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border-subtle px-3 text-xs font-bold text-content-base hover:bg-surface-base disabled:pointer-events-none disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} /> Atualizar</button>
      </AdminPageHeader>

      <div className="md:hidden">
        <button type="button" onClick={() => setFormOpen(true)} disabled={!canCreate} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-gold-base px-4 text-sm font-bold text-content-on-accent transition-colors hover:bg-gold-hover disabled:pointer-events-none disabled:opacity-50"><Plus className="h-4 w-4" /> Nova campanha</button>
      </div>

      {message && <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${message.type === 'success' ? 'border-status-success/30 bg-status-success/10 text-status-success' : 'border-red-500/30 bg-red-500/10 text-red-300'}`} role="status"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{message.text}</span></div>}

      {loadError && <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h2 className="text-sm font-bold text-content-base">Não foi possível carregar as campanhas</h2><p className="mt-1 break-words text-sm leading-relaxed text-content-muted">{loadError}</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-amber-400/30 px-3 text-xs font-bold text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Tentar novamente</button></div></section>}

      {!configured && <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-content-base">Conecte o Meta Ads para começar</h2><p className="mt-1 text-sm text-content-muted">A conexão e os ajustes ficam em Configurações. O módulo só cria campanhas depois que a conta e a Página forem escolhidas.</p></div><button type="button" onClick={onOpenSettings} className="min-h-9 rounded-md bg-gold-base px-3 text-xs font-bold text-content-on-accent hover:bg-gold-hover">Abrir configurações</button></div></section>}
      {configured && !canCreate && <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-content-base">Finalize a seleção de ativos</h2><p className="mt-1 text-sm text-content-muted">Selecione uma conta de anúncios e uma Página em Configurações antes de criar ou sincronizar campanhas.</p></div><button type="button" onClick={onOpenSettings} className="min-h-9 rounded-md border border-amber-400/30 px-3 text-xs font-bold text-amber-200 hover:bg-amber-500/10">Revisar configuração</button></div></section>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard icon={BarChart3} label="Investido" value={formatCents(totals.spendCents, connection?.currency || 'BRL')} helper={CAMPAIGNS_DEMO_MODE ? 'Indicador demonstrativo' : 'Total sincronizado'} tone="finance-negative" />
        <MetricCard icon={Users} label="Leads" value={formatCompactNumber(totals.leads)} helper={CAMPAIGNS_DEMO_MODE ? 'Conversões demonstrativas' : 'Ações de lead retornadas'} tone="text-status-success" />
        <MetricCard icon={Link2} label="Cliques" value={formatCompactNumber(totals.clicks)} helper="Cliques no destino" tone="text-blue-300" />
        <MetricCard icon={Eye} label="Alcance" value={formatCompactNumber(totals.reach)} helper="Pessoas alcançadas" tone="text-violet-300" />
        <MetricCard icon={Target} label="Impressões" value={formatCompactNumber(totals.impressions)} helper="Exibições registradas" tone="text-gold-base" />
      </div>

      <section className="rounded-xl border border-border-subtle bg-surface-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-content-base">Suas campanhas</h2><p className="mt-1 text-xs text-content-muted">{CAMPAIGNS_DEMO_MODE ? 'Os dados exibidos são ilustrativos e não representam uma conta Meta real.' : 'As métricas exibidas são sincronizadas com a conta Meta selecionada.'}</p></div>{connection?.lastSyncedAt && <p className="text-[11px] text-content-muted">Atualizado em {new Date(connection.lastSyncedAt).toLocaleString('pt-BR')}</p>}</div>
        {sortedCampaigns.length === 0 ? <AdminEmptyState icon={Megaphone} title={CAMPAIGNS_DEMO_MODE ? 'Nenhuma campanha demonstrativa' : 'Nenhuma campanha sincronizada'} description={canCreate ? (CAMPAIGNS_DEMO_MODE ? 'Crie uma campanha local pausada para visualizar o fluxo.' : 'Crie uma campanha pausada para revisar o anúncio antes de ativar.') : 'Conecte a Meta e selecione os ativos em Configurações.'} actionLabel={canCreate ? 'Criar campanha' : undefined} onAction={canCreate ? () => setFormOpen(true) : undefined} /> : <div className="mt-4 space-y-2">
          {sortedCampaigns.map((campaign) => {
            const normalizedStatus = String(campaign.status || 'PAUSED').toUpperCase();
            const isActive = normalizedStatus === 'ACTIVE';
            return <article key={campaign.id} className="rounded-lg border border-border-subtle bg-surface-base p-3.5 transition-colors hover:border-gold-base/40"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-bold text-content-base">{campaign.name}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusClass[normalizedStatus] || 'bg-surface-card text-content-muted'}`}>{statusLabel[normalizedStatus] || normalizedStatus}</span></div><p className="mt-1 text-xs text-content-muted">{campaign.locationLabel || 'Localização não informada'} · {formatCents(campaign.dailyBudgetCents, connection?.currency || 'BRL')}/dia</p></div><div className="flex items-center gap-2"><a href={CAMPAIGNS_DEMO_MODE ? 'https://www.facebook.com/business/tools/ads-manager' : `https://www.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(connection?.adAccountId?.replace(/^act_/, '') || '')}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-md border border-border-subtle px-2.5 text-[11px] font-bold text-content-muted hover:text-content-base">{CAMPAIGNS_DEMO_MODE ? 'Referência Meta' : 'Meta'} <ExternalLink className="h-3 w-3" /></a>{isActive ? <button type="button" onClick={() => setStatusTarget({ campaign, status: 'PAUSED' })} className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-500/30 px-2.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/10"><Pause className="h-3 w-3" /> {CAMPAIGNS_DEMO_MODE ? 'Simular pausa' : 'Pausar'}</button> : normalizedStatus !== 'ARCHIVED' && normalizedStatus !== 'DELETED' ? <button type="button" onClick={() => setStatusTarget({ campaign, status: 'ACTIVE' })} disabled={!canCreate} className="inline-flex h-8 items-center gap-1 rounded-md bg-gold-base px-2.5 text-[11px] font-bold text-content-on-accent hover:bg-gold-hover disabled:pointer-events-none disabled:opacity-50"><Play className="h-3 w-3" /> {CAMPAIGNS_DEMO_MODE ? 'Simular ativação' : 'Ativar'}</button> : null}</div></div><div className="mt-3 grid grid-cols-2 gap-2 border-t border-border-subtle pt-3 sm:grid-cols-5"><div><p className="text-[10px] text-content-muted">Gasto</p><p className="mt-1 text-xs font-bold finance-negative">{formatCents(campaign.spendCents, connection?.currency || 'BRL')}</p></div><div><p className="text-[10px] text-content-muted">Leads</p><p className="mt-1 text-xs font-bold text-status-success">{formatCompactNumber(campaign.leads)}</p></div><div><p className="text-[10px] text-content-muted">Cliques</p><p className="mt-1 text-xs font-bold text-blue-300">{formatCompactNumber(campaign.clicks)}</p></div><div><p className="text-[10px] text-content-muted">Alcance</p><p className="mt-1 text-xs font-bold text-content-base">{formatCompactNumber(campaign.reach)}</p></div><div><p className="text-[10px] text-content-muted">Período</p><p className="mt-1 text-xs font-bold text-content-base">{campaign.startDate || 'Agora'}{campaign.endDate ? ` → ${campaign.endDate}` : ''}</p></div></div>{campaign.errorMessage && <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">{campaign.errorMessage}</p>}</article>;
          })}
        </div>}
      </section>

      {formOpen && createPortal(<div className="fixed inset-0 z-[180] flex h-[100dvh] w-full items-center justify-center overflow-hidden overscroll-none bg-black/70 p-0 touch-none sm:p-4" role="dialog" aria-modal="true" aria-labelledby="campaign-form-title"><div className="flex h-full max-h-full w-full max-w-2xl min-w-0 flex-col overflow-hidden rounded-none border border-border-subtle bg-surface-card shadow-2xl sm:h-[min(720px,calc(100dvh-2rem))] sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"><div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-subtle p-4 sm:p-5"><div><h2 id="campaign-form-title" className="text-base font-bold text-content-base">Nova campanha</h2><p className="mt-1 text-xs text-content-muted">{CAMPAIGNS_DEMO_MODE ? 'A campanha será criada pausada apenas nesta demonstração.' : 'A campanha será criada pausada para revisão.'}</p></div><button type="button" onClick={() => setFormOpen(false)} className="rounded-md p-2 text-content-muted hover:bg-surface-base hover:text-content-base" aria-label="Fechar formulário"><X className="h-4 w-4" /></button></div><form onSubmit={create} className="min-h-0 min-w-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain space-y-4 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-content-muted sm:col-span-2">Nome da campanha<input value={form.name} onChange={(event) => handleFormChange('name', event.target.value)} placeholder="Ex.: Agenda de corte em Sobral" className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-gold-base" maxLength={120} required /></label><label className="text-xs font-semibold text-content-muted">Objetivo<select value={form.objective} onChange={(event) => handleFormChange('objective', event.target.value as 'OUTCOME_TRAFFIC')} className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-gold-base"><option value="OUTCOME_TRAFFIC">Levar pessoas ao site</option></select></label><label className="text-xs font-semibold text-content-muted">Orçamento diário<input type="number" min="10" step="1" value={(form.dailyBudgetCents / 100).toFixed(2)} onChange={(event) => handleFormChange('dailyBudgetCents', Math.round(Number(event.target.value || 0) * 100))} className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-gold-base" required /></label><label className="text-xs font-semibold text-content-muted">Início<input type="date" min={dateToday()} value={form.startDate} onChange={(event) => handleFormChange('startDate', event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-gold-base" /></label><label className="text-xs font-semibold text-content-muted">Fim (opcional)<input type="date" min={form.startDate || dateToday()} value={form.endDate} onChange={(event) => handleFormChange('endDate', event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-gold-base" /></label><label className="text-xs font-semibold text-content-muted sm:col-span-2"><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Localização exibida</span><input value={form.locationLabel} onChange={(event) => handleFormChange('locationLabel', event.target.value)} placeholder="Sobral e região" className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-gold-base" required /></label><label className="text-xs font-semibold text-content-muted sm:col-span-2">Chave de cidade Meta (opcional)<input value={form.locationKey} onChange={(event) => handleFormChange('locationKey', event.target.value)} placeholder="Informe a chave se quiser segmentar uma cidade específica" className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-gold-base" /></label><label className="text-xs font-semibold text-content-muted sm:col-span-2">Destino do clique<input type="url" value={form.destinationUrl} onChange={(event) => handleFormChange('destinationUrl', event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-gold-base" required /></label><label className="text-xs font-semibold text-content-muted sm:col-span-2">Texto do anúncio<textarea value={form.adText} onChange={(event) => handleFormChange('adText', event.target.value)} rows={3} maxLength={500} className="mt-1.5 w-full resize-y rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm text-content-base outline-none focus:border-gold-base" required /></label><label className="text-xs font-semibold text-content-muted">Título<input value={form.headline} onChange={(event) => handleFormChange('headline', event.target.value)} maxLength={80} className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-gold-base" required /></label><label className="text-xs font-semibold text-content-muted"><span className="flex items-center gap-1"><ImagePlus className="h-3.5 w-3.5" /> URL pública da imagem</span><input type="url" value={form.imageUrl} onChange={(event) => handleFormChange('imageUrl', event.target.value)} placeholder="https://..." className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-gold-base" required /></label></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4"><p className="max-w-md text-[11px] leading-relaxed text-content-muted">{CAMPAIGNS_DEMO_MODE ? 'Nada será enviado para a Meta. Esta ação cria apenas um registro local demonstrativo.' : 'A Meta poderá revisar o anúncio. O Navo não ativa a campanha sem uma ação explícita no botão Ativar.'}</p><div className="flex gap-2"><button type="button" onClick={() => setFormOpen(false)} className="min-h-10 rounded-md border border-border-subtle px-4 text-xs font-bold text-content-muted hover:bg-surface-base">Cancelar</button><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-gold-base px-4 text-xs font-bold text-content-on-accent hover:bg-gold-hover disabled:pointer-events-none disabled:opacity-50">{busy && <RefreshCw className="h-3.5 w-3.5 animate-spin" />} Criar pausada</button></div></div></form></div></div>, document.body)}

      <ConfirmDialog isOpen={Boolean(statusTarget)} onClose={() => setStatusTarget(null)} onConfirm={changeStatus} isLoading={busy} title={statusTarget?.status === 'ACTIVE' ? (CAMPAIGNS_DEMO_MODE ? 'Simular ativação?' : 'Ativar campanha?') : (CAMPAIGNS_DEMO_MODE ? 'Simular pausa?' : 'Pausar campanha?')} description={statusTarget?.status === 'ACTIVE' ? (CAMPAIGNS_DEMO_MODE ? `A campanha “${statusTarget?.campaign.name}” será marcada como ativa somente nesta demonstração. Nenhum orçamento será cobrado.` : `A campanha “${statusTarget?.campaign.name}” será ativada na Meta. O orçamento diário informado poderá ser cobrado pela conta de anúncios.`) : (CAMPAIGNS_DEMO_MODE ? `A campanha “${statusTarget?.campaign.name}” será marcada como pausada somente nesta demonstração.` : `A campanha “${statusTarget?.campaign.name}” será pausada na Meta e deixará de veicular.`)} confirmText={statusTarget?.status === 'ACTIVE' ? (CAMPAIGNS_DEMO_MODE ? 'Simular ativação' : 'Ativar campanha') : (CAMPAIGNS_DEMO_MODE ? 'Simular pausa' : 'Pausar campanha')} variant={statusTarget?.status === 'ACTIVE' ? 'primary' : 'danger'} icon={statusTarget?.status === 'ACTIVE' ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />} />
    </div>
  );
};
