import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, ExternalLink, Eye, Link2, MapPin, Megaphone, Pause, Play, Plus, RefreshCw, Target, Users, X } from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { AdminEmptyState } from './shared/AdminEmptyState';
import { AdminListSkeleton } from './shared/AdminSkeleton';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  createGoogleCampaign,
  formatCents,
  formatCompactNumber,
  getGoogleAdsStatus,
  getGoogleCampaigns,
  syncGoogleCampaigns,
  updateGoogleCampaignStatus,
  type GoogleAdsConnection,
  type GoogleCampaign,
  type GoogleCampaignForm,
} from '../../services/googleAdsService';
import {
  CAMPAIGNS_DEMO_MODE,
  createDemoGoogleCampaign,
  demoGoogleCampaigns,
  demoGoogleConnection,
  demoGoogleTotals,
} from '../../services/campaignDemoData';

interface GoogleAdsManagementProps {
  onOpenSettings?: () => void;
}

const initialForm: GoogleCampaignForm = {
  name: '',
  dailyBudgetCents: 1000,
  startDate: '',
  endDate: '',
  locationLabel: 'Brasil',
  locationResourceName: 'geoTargetConstants/2076',
  destinationUrl: 'https://navoproject.vercel.app/?catalog=1',
  headlines: ['Agende seu horário', 'Navo Barber & Club', 'Barbearia em Sobral'],
  descriptions: ['Agende seu atendimento na Navo Barber & Club.', 'Escolha seu horário online com facilidade.'],
  keywords: ['barbearia em Sobral', 'corte de cabelo Sobral', 'barbeiro em Sobral'],
};

const statusLabel: Record<string, string> = { ACTIVE: 'Ativa', ENABLED: 'Ativa', PAUSED: 'Pausada', REMOVED: 'Removida', UNKNOWN: 'Sem status' };
const statusClass: Record<string, string> = { ACTIVE: 'bg-status-success/10 text-status-success', ENABLED: 'bg-status-success/10 text-status-success', PAUSED: 'bg-amber-500/10 text-amber-300', REMOVED: 'bg-red-500/10 text-red-300' };
const dateToday = () => new Date().toISOString().slice(0, 10);

const MetricCard: React.FC<{ icon: React.ElementType; label: string; value: string; helper?: string; tone?: string }> = ({ icon: Icon, label, value, helper, tone = 'text-blue-300' }) => (
  <div className="rounded-xl border border-border-subtle bg-surface-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-content-muted">{label}</p><p className={`mt-2 text-xl font-bold tracking-tight ${tone}`}>{value}</p></div><div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-surface-base ${tone}`}><Icon className="h-4 w-4" /></div></div>{helper && <p className="mt-2 text-[11px] text-content-muted">{helper}</p>}</div>
);

export const GoogleAdsManagement: React.FC<GoogleAdsManagementProps> = ({ onOpenSettings }) => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [campaigns, setCampaigns] = useState<GoogleCampaign[]>([]);
  const [totals, setTotals] = useState({ spendCents: 0, leads: 0, clicks: 0, reach: 0, impressions: 0, conversions: 0 });
  const [connection, setConnection] = useState<GoogleAdsConnection | null>(null);
  const [configured, setConfigured] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<GoogleCampaignForm>(initialForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ campaign: GoogleCampaign; status: 'ENABLED' | 'PAUSED' } | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    if (CAMPAIGNS_DEMO_MODE) {
      setConfigured(true);
      setConnection({ ...demoGoogleConnection });
      setCampaigns([...demoGoogleCampaigns]);
      setTotals({ ...demoGoogleTotals });
      setLoading(false);
      return;
    }
    try {
      const [statusResponse, campaignResponse] = await Promise.all([getGoogleAdsStatus(), getGoogleCampaigns()]);
      setConfigured(statusResponse.configured);
      setConnection(statusResponse.connection);
      setCampaigns(campaignResponse.campaigns);
      setTotals(campaignResponse.totals);
    } catch (error: any) {
      const text = error?.message || 'Não foi possível carregar o módulo Google Ads.';
      setLoadError(text);
      setMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

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
      const response = await syncGoogleCampaigns();
      setCampaigns(response.campaigns);
      setTotals(response.campaigns.reduce((acc, campaign) => ({
        spendCents: acc.spendCents + campaign.spendCents,
        leads: acc.leads + campaign.leads,
        clicks: acc.clicks + campaign.clicks,
        reach: acc.reach + campaign.reach,
        impressions: acc.impressions + campaign.impressions,
        conversions: acc.conversions + campaign.conversions,
      }), { spendCents: 0, leads: 0, clicks: 0, reach: 0, impressions: 0, conversions: 0 }));
      setConnection((previous) => previous ? { ...previous, lastSyncedAt: response.syncedAt, status: 'connected', lastError: null } : previous);
      setMessage({ type: 'success', text: 'Campanhas e métricas atualizadas a partir do Google Ads.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível sincronizar com o Google Ads.' });
    } finally {
      setSyncing(false);
    }
  };

  const updateForm = <K extends keyof GoogleCampaignForm>(key: K, value: GoogleCampaignForm[K]) => setForm((previous) => ({ ...previous, [key]: value }));
  const updateArrayItem = (key: 'headlines' | 'descriptions', index: number, value: string) => setForm((previous) => ({ ...previous, [key]: previous[key].map((item, itemIndex) => itemIndex === index ? value : item) }));

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = { ...form, name: form.name.trim(), headlines: form.headlines.map((item) => item.trim()).filter(Boolean), descriptions: form.descriptions.map((item) => item.trim()).filter(Boolean), keywords: form.keywords.map((item) => item.trim()).filter(Boolean) };
    if (!normalized.name || normalized.headlines.length < 3 || normalized.descriptions.length < 2 || normalized.keywords.length < 1) {
      setMessage({ type: 'error', text: 'Informe o nome, 3 títulos, 2 descrições e pelo menos 1 palavra-chave.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (CAMPAIGNS_DEMO_MODE) {
        const campaign = createDemoGoogleCampaign(normalized, campaigns.length);
        setCampaigns((previous) => [campaign, ...previous]);
        setForm(initialForm);
        setFormOpen(false);
        setMessage({ type: 'success', text: 'Campanha criada apenas para demonstração. Nenhuma conta externa foi alterada.' });
        return;
      }
      const response = await createGoogleCampaign(normalized);
      setCampaigns((previous) => [response.campaign, ...previous]);
      setForm(initialForm);
      setFormOpen(false);
      setMessage({ type: 'success', text: response.message });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível criar a campanha Google.' });
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
        setMessage({ type: 'success', text: statusTarget.status === 'ENABLED' ? 'Campanha ativada apenas na demonstração.' : 'Campanha pausada apenas na demonstração.' });
        return;
      }
      const response = await updateGoogleCampaignStatus(statusTarget.campaign.id, statusTarget.status);
      setCampaigns((previous) => previous.map((campaign) => campaign.id === response.campaign.id ? response.campaign : campaign));
      setMessage({ type: 'success', text: statusTarget.status === 'ENABLED' ? 'Campanha ativada no Google Ads.' : 'Campanha pausada no Google Ads.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível alterar o status da campanha.' });
    } finally {
      setBusy(false);
      setStatusTarget(null);
    }
  };

  const sortedCampaigns = useMemo(() => [...campaigns].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))), [campaigns]);
  const canCreate = configured && connection?.status === 'connected' && Boolean(connection.customerId);

  if (loading) return <div className="space-y-4"><AdminPageHeader icon={Megaphone} title="Google Ads" /><AdminListSkeleton rows={6} /></div>;

  return (
    <div className="space-y-4 min-w-0">
      <AdminPageHeader icon={Megaphone} title="Google Ads" stats={[{ label: 'campanhas', value: campaigns.length }, { label: 'gasto', value: formatCents(totals.spendCents, connection?.currency || 'BRL'), tone: 'finance-negative' }]} action={{ label: 'Nova campanha', icon: Plus, onClick: () => setFormOpen(true), disabled: !canCreate }}>
        <button type="button" onClick={sync} disabled={syncing || !canCreate} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border-subtle px-3 text-xs font-bold text-content-base hover:bg-surface-base disabled:pointer-events-none disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} /> Atualizar</button>
      </AdminPageHeader>


      {message && <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${message.type === 'success' ? 'border-status-success/30 bg-status-success/10 text-status-success' : 'border-red-500/30 bg-red-500/10 text-red-300'}`} role="status"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{message.text}</span></div>}
      {loadError && <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h2 className="text-sm font-bold text-content-base">Não foi possível carregar as campanhas</h2><p className="mt-1 break-words text-sm leading-relaxed text-content-muted">{loadError}</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-amber-400/30 px-3 text-xs font-bold text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Tentar novamente</button></div></section>}
      {!configured && <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-content-base">Conecte o Google Ads para começar</h2><p className="mt-1 text-sm text-content-muted">A conexão e os ajustes ficam em Configurações. O módulo só cria campanhas depois que uma conta cliente for escolhida.</p></div><button type="button" onClick={onOpenSettings} className="min-h-9 rounded-md bg-gold-base px-3 text-xs font-bold text-content-on-accent hover:bg-gold-hover">Abrir configurações</button></div></section>}
      {configured && !canCreate && <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-content-base">Finalize a seleção da conta</h2><p className="mt-1 text-sm text-content-muted">Selecione uma conta cliente Google Ads em Configurações antes de criar ou sincronizar campanhas.</p></div><button type="button" onClick={onOpenSettings} className="min-h-9 rounded-md border border-amber-400/30 px-3 text-xs font-bold text-amber-200 hover:bg-amber-500/10">Revisar configuração</button></div></section>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6"><MetricCard icon={BarChart3} label="Investido" value={formatCents(totals.spendCents, connection?.currency || 'BRL')} helper={CAMPAIGNS_DEMO_MODE ? 'Indicador demonstrativo' : 'Total sincronizado'} tone="finance-negative" /><MetricCard icon={Users} label="Leads" value={formatCompactNumber(totals.leads)} helper={CAMPAIGNS_DEMO_MODE ? 'Conversões demonstrativas' : 'Conversões agregadas'} tone="text-status-success" /><MetricCard icon={Link2} label="Cliques" value={formatCompactNumber(totals.clicks)} helper="Cliques no destino" tone="text-blue-300" /><MetricCard icon={Eye} label="Alcance" value={formatCompactNumber(totals.reach)} helper="Quando disponível" tone="text-violet-300" /><MetricCard icon={Target} label="Impressões" value={formatCompactNumber(totals.impressions)} helper="Exibições registradas" tone="text-gold-base" /><MetricCard icon={BarChart3} label="Conversões" value={formatCompactNumber(Math.round(totals.conversions))} helper="Conversões configuradas" tone="text-cyan-300" /></div>

      <section className="rounded-xl border border-border-subtle bg-surface-card p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-content-base">Suas campanhas Google</h2><p className="mt-1 text-xs text-content-muted">{CAMPAIGNS_DEMO_MODE ? 'Os dados exibidos são ilustrativos e não representam uma conta Google Ads real.' : 'As métricas são sincronizadas com a conta Google Ads selecionada.'}</p></div>{connection?.lastSyncedAt && <p className="text-[11px] text-content-muted">Atualizado em {new Date(connection.lastSyncedAt).toLocaleString('pt-BR')}</p>}</div>{sortedCampaigns.length === 0 ? <AdminEmptyState icon={Megaphone} title={CAMPAIGNS_DEMO_MODE ? 'Nenhuma campanha demonstrativa' : 'Nenhuma campanha sincronizada'} description={canCreate ? (CAMPAIGNS_DEMO_MODE ? 'Crie uma campanha local pausada para visualizar o fluxo.' : 'Crie uma campanha pausada para revisar os dados antes de ativar.') : 'Conecte o Google Ads e selecione a conta em Configurações.'} actionLabel={canCreate ? 'Criar campanha' : undefined} onAction={canCreate ? () => setFormOpen(true) : undefined} /> : <div className="mt-4 space-y-2">{sortedCampaigns.map((campaign) => { const normalizedStatus = String(campaign.status || 'PAUSED').toUpperCase(); const isActive = normalizedStatus === 'ACTIVE' || normalizedStatus === 'ENABLED'; return <article key={campaign.id} className="rounded-lg border border-border-subtle bg-surface-base p-3.5 transition-colors hover:border-blue-400/40"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-bold text-content-base">{campaign.name}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusClass[normalizedStatus] || 'bg-surface-card text-content-muted'}`}>{statusLabel[normalizedStatus] || normalizedStatus}</span></div><p className="mt-1 text-xs text-content-muted">{campaign.locationLabel || 'Localização não informada'} · {formatCents(campaign.dailyBudgetCents, connection?.currency || 'BRL')}/dia</p></div><div className="flex items-center gap-2"><a href={CAMPAIGNS_DEMO_MODE ? 'https://ads.google.com/home/' : `https://ads.google.com/aw/campaigns?ocid=${encodeURIComponent(connection?.customerId || '')}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-md border border-border-subtle px-2.5 text-[11px] font-bold text-content-muted hover:text-content-base">{CAMPAIGNS_DEMO_MODE ? 'Referência Google' : 'Google'} <ExternalLink className="h-3 w-3" /></a>{isActive ? <button type="button" onClick={() => setStatusTarget({ campaign, status: 'PAUSED' })} className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-500/30 px-2.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/10"><Pause className="h-3 w-3" /> {CAMPAIGNS_DEMO_MODE ? 'Simular pausa' : 'Pausar'}</button> : normalizedStatus !== 'REMOVED' ? <button type="button" onClick={() => setStatusTarget({ campaign, status: 'ENABLED' })} disabled={!canCreate} className="inline-flex h-8 items-center gap-1 rounded-md bg-gold-base px-2.5 text-[11px] font-bold text-content-on-accent hover:bg-gold-hover disabled:pointer-events-none disabled:opacity-50"><Play className="h-3 w-3" /> {CAMPAIGNS_DEMO_MODE ? 'Simular ativação' : 'Ativar'}</button> : null}</div></div><div className="mt-3 grid grid-cols-2 gap-2 border-t border-border-subtle pt-3 sm:grid-cols-6"><div><p className="text-[10px] text-content-muted">Gasto</p><p className="mt-1 text-xs font-bold finance-negative">{formatCents(campaign.spendCents, connection?.currency || 'BRL')}</p></div><div><p className="text-[10px] text-content-muted">Leads</p><p className="mt-1 text-xs font-bold text-status-success">{formatCompactNumber(campaign.leads)}</p></div><div><p className="text-[10px] text-content-muted">Cliques</p><p className="mt-1 text-xs font-bold text-blue-300">{formatCompactNumber(campaign.clicks)}</p></div><div><p className="text-[10px] text-content-muted">Impressões</p><p className="mt-1 text-xs font-bold text-content-base">{formatCompactNumber(campaign.impressions)}</p></div><div><p className="text-[10px] text-content-muted">Conversões</p><p className="mt-1 text-xs font-bold text-cyan-300">{formatCompactNumber(Math.round(campaign.conversions))}</p></div><div><p className="text-[10px] text-content-muted">Período</p><p className="mt-1 text-xs font-bold text-content-base">{campaign.startDate || 'Agora'}{campaign.endDate ? ` → ${campaign.endDate}` : ''}</p></div></div>{campaign.errorMessage && <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">{campaign.errorMessage}</p>}</article>; })}</div>}</section>

      {formOpen && <div className="fixed inset-0 z-[180] flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="google-campaign-form-title"><div className="my-auto w-full max-w-3xl rounded-2xl border border-border-subtle bg-surface-card shadow-2xl"><div className="flex items-start justify-between gap-3 border-b border-border-subtle p-4 sm:p-5"><div><h2 id="google-campaign-form-title" className="text-base font-bold text-content-base">Nova campanha Google</h2><p className="mt-1 text-xs text-content-muted">{CAMPAIGNS_DEMO_MODE ? 'A campanha será criada pausada apenas nesta demonstração.' : 'Será criada pausada para revisão no Google Ads.'}</p></div><button type="button" onClick={() => setFormOpen(false)} className="rounded-md p-2 text-content-muted hover:bg-surface-base hover:text-content-base" aria-label="Fechar formulário"><X className="h-4 w-4" /></button></div><form onSubmit={create} className="space-y-4 p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-content-muted sm:col-span-2">Nome da campanha<input value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="Ex.: Agenda de corte em Sobral" className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-blue-400" maxLength={120} required /></label><label className="text-xs font-semibold text-content-muted">Orçamento diário<input type="number" min="1" step="0.01" value={(form.dailyBudgetCents / 100).toFixed(2)} onChange={(event) => updateForm('dailyBudgetCents', Math.round(Number(event.target.value || 0) * 100))} className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-blue-400" required /></label><label className="text-xs font-semibold text-content-muted"><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Localização exibida</span><input value={form.locationLabel} onChange={(event) => updateForm('locationLabel', event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-blue-400" maxLength={120} required /></label><label className="text-xs font-semibold text-content-muted">Início<input type="date" min={dateToday()} value={form.startDate} onChange={(event) => updateForm('startDate', event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-blue-400" /></label><label className="text-xs font-semibold text-content-muted">Fim (opcional)<input type="date" min={form.startDate || dateToday()} value={form.endDate} onChange={(event) => updateForm('endDate', event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-blue-400" /></label><label className="text-xs font-semibold text-content-muted sm:col-span-2">Destino do clique<input type="url" value={form.destinationUrl} onChange={(event) => updateForm('destinationUrl', event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-blue-400" required /></label><div className="sm:col-span-2"><p className="text-xs font-semibold text-content-muted">Títulos (3 a 15)</p><div className="mt-1.5 grid gap-2 sm:grid-cols-3">{form.headlines.map((headline, index) => <input key={`headline-${index}`} value={headline} onChange={(event) => updateArrayItem('headlines', index, event.target.value)} maxLength={30} placeholder={`Título ${index + 1}`} className="h-10 rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-blue-400" required />)}</div></div><div className="sm:col-span-2"><p className="text-xs font-semibold text-content-muted">Descrições (2 a 4)</p><div className="mt-1.5 grid gap-2 sm:grid-cols-2">{form.descriptions.map((description, index) => <textarea key={`description-${index}`} value={description} onChange={(event) => updateArrayItem('descriptions', index, event.target.value)} maxLength={90} rows={2} placeholder={`Descrição ${index + 1}`} className="resize-y rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm text-content-base outline-none focus:border-blue-400" required />)}</div></div><label className="text-xs font-semibold text-content-muted sm:col-span-2">Palavras-chave separadas por vírgula<input value={form.keywords.join(', ')} onChange={(event) => updateForm('keywords', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} placeholder="barbearia em Sobral, corte masculino Sobral" className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-blue-400" required /></label></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4"><p className="max-w-xl text-[11px] leading-relaxed text-content-muted">{CAMPAIGNS_DEMO_MODE ? 'Nada será enviado para o Google. Esta ação cria apenas um registro local demonstrativo.' : 'A campanha, o grupo, as palavras-chave e o anúncio serão criados pausados. A ativação pode gerar cobrança na conta Google Ads e exige uma confirmação separada.'}</p><div className="flex gap-2"><button type="button" onClick={() => setFormOpen(false)} className="min-h-10 rounded-md border border-border-subtle px-4 text-xs font-bold text-content-muted hover:bg-surface-base">Cancelar</button><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-gold-base px-4 text-xs font-bold text-content-on-accent hover:bg-gold-hover disabled:pointer-events-none disabled:opacity-50">{busy && <RefreshCw className="h-3.5 w-3.5 animate-spin" />} Criar pausada</button></div></div></form></div></div>}

      <ConfirmDialog isOpen={Boolean(statusTarget)} onClose={() => setStatusTarget(null)} onConfirm={changeStatus} isLoading={busy} title={statusTarget?.status === 'ENABLED' ? (CAMPAIGNS_DEMO_MODE ? 'Simular ativação?' : 'Ativar campanha Google?') : (CAMPAIGNS_DEMO_MODE ? 'Simular pausa?' : 'Pausar campanha Google?')} description={statusTarget?.status === 'ENABLED' ? (CAMPAIGNS_DEMO_MODE ? `A campanha “${statusTarget?.campaign.name}” será marcada como ativa somente nesta demonstração. Nenhum orçamento será cobrado.` : `A campanha “${statusTarget?.campaign.name}” será ativada no Google Ads. O orçamento diário informado poderá gerar cobrança.`) : (CAMPAIGNS_DEMO_MODE ? `A campanha “${statusTarget?.campaign.name}” será marcada como pausada somente nesta demonstração.` : `A campanha “${statusTarget?.campaign.name}” será pausada no Google Ads e deixará de veicular.`)} confirmText={statusTarget?.status === 'ENABLED' ? (CAMPAIGNS_DEMO_MODE ? 'Simular ativação' : 'Ativar campanha') : (CAMPAIGNS_DEMO_MODE ? 'Simular pausa' : 'Pausar campanha')} variant={statusTarget?.status === 'ENABLED' ? 'primary' : 'danger'} icon={statusTarget?.status === 'ENABLED' ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />} />
    </div>
  );
};
