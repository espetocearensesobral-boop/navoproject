import React, { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, KeyRound, Link2, LogOut, RefreshCw, ShieldCheck, Target, AlertCircle } from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { AdminListSkeleton } from './shared/AdminSkeleton';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  disconnectMetaAds,
  getMetaAdsAssets,
  getMetaAdsStatus,
  saveMetaAdsAssets,
  startMetaAdsOAuth,
  type MetaAdAccount,
  type MetaAdsConnection,
  type MetaPage,
} from '../../services/metaAdsService';

interface MetaAdsSettingsProps {
  onOpenCampaigns?: (provider?: 'meta' | 'google') => void;
}

export const MetaAdsSettings: React.FC<MetaAdsSettingsProps> = ({ onOpenCampaigns }) => {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ configured: boolean; graphApiVersion: string; connection: MetaAdsConnection | null } | null>(null);
  const [accounts, setAccounts] = useState<MetaAdAccount[]>([]);
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [accountId, setAccountId] = useState('');
  const [pageId, setPageId] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    setMessage(null);
    try {
      const nextStatus = await getMetaAdsStatus();
      setStatus(nextStatus);
      setAccountId(nextStatus.connection?.adAccountId || '');
      setPageId(nextStatus.connection?.pageId || '');
      if (nextStatus.connection?.status === 'connected') {
        const assets = await getMetaAdsAssets();
        setAccounts(assets.accounts);
        setPages(assets.pages);
      } else {
        setAccounts([]);
        setPages([]);
      }
    } catch (error: any) {
      const text = error?.message || 'Não foi possível carregar a integração Meta Ads.';
      setLoadError(text);
      setMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    const result = params.get('metaAds');
    const reason = params.get('reason');
    if (result === 'connected') setMessage({ type: 'success', text: 'Conta Meta autorizada. Confirme a conta de anúncios e a Página abaixo.' });
    if (result === 'error') setMessage({ type: 'error', text: reason || 'A autorização Meta não foi concluída.' });
    if (result) window.history.replaceState({}, '', '/admin');
  }, []);

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await startMetaAdsOAuth();
      window.location.assign(response.url);
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível iniciar a conexão Meta.' });
      setBusy(false);
    }
  };

  const refreshAssets = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await getMetaAdsAssets();
      setAccounts(response.accounts);
      setPages(response.pages);
      setStatus((previous) => previous ? { ...previous, connection: response.connection } : previous);
      setMessage({ type: 'success', text: 'Ativos da Meta atualizados.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível atualizar os ativos.' });
    } finally {
      setBusy(false);
    }
  };

  const saveAssets = async () => {
    if (!accountId || !pageId) {
      setMessage({ type: 'error', text: 'Selecione uma conta de anúncios e uma Página.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await saveMetaAdsAssets(accountId, pageId);
      setStatus((previous) => previous ? { ...previous, connection: response.connection } : previous);
      setLoadError(null);
      setMessage({ type: 'success', text: 'Ativos Meta salvos. O módulo Campanhas já pode usar essa conta.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível salvar os ativos.' });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await disconnectMetaAds();
      setStatus((previous) => previous ? { ...previous, connection: null } : previous);
      setAccounts([]);
      setPages([]);
      setAccountId('');
      setPageId('');
      setMessage({ type: 'success', text: 'Conexão removida do Navo. O histórico local de campanhas foi preservado.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível remover a conexão.' });
    } finally {
      setBusy(false);
      setDisconnectOpen(false);
    }
  };

  if (loading) return <div className="space-y-4"><AdminPageHeader icon={Target} title="Meta Ads" /><AdminListSkeleton rows={5} /></div>;

  const connection = status?.connection;
  const connected = connection?.status === 'connected';

  return (
    <div className="space-y-4 min-w-0">
      <AdminPageHeader
        icon={Target}
        title="Meta Ads"
        stats={[{ label: 'conexão', value: connected ? 'Ativa' : 'Não conectada', tone: connected ? 'success' : 'muted' }]}
        action={connected ? { label: 'Abrir campanhas', icon: Target, onClick: () => onOpenCampaigns?.('meta') } : undefined}
      />

      {message && (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${message.type === 'success' ? 'border-status-success/30 bg-status-success/10 text-status-success' : 'border-red-500/30 bg-red-500/10 text-red-300'}`} role="status">
          {message.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {loadError && <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h2 className="text-sm font-bold text-content-base">Configuração ainda não carregada</h2><p className="mt-1 break-words text-sm leading-relaxed text-content-muted">{loadError}</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-amber-400/30 px-3 text-xs font-bold text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Tentar novamente</button></div></section>}

      {!status?.configured && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-content-base">Integração ainda não configurada no servidor</h2>
              <p className="mt-1 text-sm leading-relaxed text-content-muted">Defina `META_ADS_APP_ID`, `META_ADS_APP_SECRET` e `META_ADS_REDIRECT_URI` no ambiente do backend. O App Secret nunca deve ser colocado no frontend ou no repositório.</p>
              <p className="mt-2 text-xs text-content-muted">Callback esperado: <code className="break-all text-amber-200">/api/meta-ads/oauth/callback</code> · Graph API: {status?.graphApiVersion || 'v26.0'}</p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-xl border border-border-subtle bg-surface-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-base/10 text-gold-base"><Link2 className="h-4 w-4" /></div>
              <div className="min-w-0"><h2 className="text-sm font-bold text-content-base">Conta conectada</h2><p className="mt-1 text-xs text-content-muted">Autorização usada somente pelo backend do Navo.</p></div>
            </div>
            {connected && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-success/10 px-2 py-1 text-[11px] font-bold text-status-success"><CheckCircle2 className="h-3 w-3" /> Ativa</span>}
          </div>
          {connected ? (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3 border-b border-border-subtle pb-2"><span className="text-content-muted">Usuário Meta</span><strong className="truncate text-content-base">{connection?.metaUserName || 'Autorizado'}</strong></div>
              <div className="flex justify-between gap-3 border-b border-border-subtle pb-2"><span className="text-content-muted">Conta de anúncios</span><strong className="truncate text-content-base">{connection?.adAccountName || 'Selecione abaixo'}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-content-muted">Última sincronização</span><strong className="text-content-base">{connection?.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleString('pt-BR') : 'Ainda não sincronizada'}</strong></div>
              {connection?.lastError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{connection.lastError}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={refreshAssets} disabled={busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border-subtle px-3 text-xs font-bold text-content-base transition-colors hover:bg-surface-base disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Atualizar ativos</button>
                <button type="button" onClick={() => setDisconnectOpen(true)} disabled={busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-red-500/30 px-3 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"><LogOut className="h-3.5 w-3.5" /> Desconectar</button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-border-subtle bg-surface-base p-4 text-sm text-content-muted">
              <p>Conecte a conta Meta para escolher a conta de anúncios e a Página que serão usadas nas campanhas.</p>
              <button type="button" onClick={connect} disabled={!status?.configured || busy} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-gold-base px-4 text-sm font-bold text-content-on-accent transition-colors hover:bg-gold-hover disabled:pointer-events-none disabled:opacity-50"><Link2 className="h-4 w-4" /> Conectar Meta Ads</button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface-card p-4 sm:p-5">
          <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300"><ShieldCheck className="h-4 w-4" /></div><div><h2 className="text-sm font-bold text-content-base">Política de operação</h2><p className="mt-1 text-xs leading-relaxed text-content-muted">Controles para manter campanhas simples e evitar ativação acidental.</p></div></div>
          <div className="mt-4 space-y-2.5 text-xs text-content-muted">
            <p className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" /> Novas campanhas são criadas pausadas.</p>
            <p className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" /> Ativação exige confirmação no módulo Campanhas.</p>
            <p className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" /> Tokens ficam somente no backend.</p>
            <p className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" /> O Navo mostra erros retornados pela Meta sem ocultá-los.</p>
          </div>
          <a href="https://www.facebook.com/business/tools/ads-manager" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-gold-base hover:text-gold-hover">Abrir documentação da Meta <ExternalLink className="h-3 w-3" /></a>
        </div>
      </section>

      {connected && (
        <section className="rounded-xl border border-border-subtle bg-surface-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-content-base">Ativos usados pelo Navo</h2><p className="mt-1 text-xs text-content-muted">Escolha explicitamente a conta de anúncios e a Página. O Navo não seleciona ativos por conta própria.</p></div><button type="button" onClick={saveAssets} disabled={busy || !accountId || !pageId} className="min-h-9 rounded-md bg-gold-base px-3 text-xs font-bold text-content-on-accent hover:bg-gold-hover disabled:pointer-events-none disabled:opacity-50">Salvar seleção</button></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block text-xs font-semibold text-content-muted">Conta de anúncios<select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-gold-base"><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency || 'BRL'}</option>)}</select></label>
            <label className="block text-xs font-semibold text-content-muted">Página do anúncio<select value={pageId} onChange={(event) => setPageId(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-gold-base"><option value="">Selecione</option>{pages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}</select></label>
          </div>
          {accounts.length === 0 || pages.length === 0 ? <p className="mt-3 text-xs text-amber-300">A Meta não retornou todos os ativos. Verifique permissões, acesso à conta de anúncios e vínculo da Página.</p> : null}
        </section>
      )}

      <ConfirmDialog isOpen={disconnectOpen} onClose={() => setDisconnectOpen(false)} onConfirm={disconnect} isLoading={busy} title="Desconectar Meta Ads?" description="O Navo removerá o token armazenado e preservará o histórico local. Campanhas já existentes continuarão sendo administradas na Meta até que você as pause por lá." confirmText="Desconectar" variant="danger" />
    </div>
  );
};
