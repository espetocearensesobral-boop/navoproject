import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { AdminTabs } from './shared/AdminTabs';
import { AdminListSkeleton } from './shared/AdminSkeleton';
import { ReceiptCheckoutModal } from './ReceiptCheckoutModal';
import {
  fetchReceiptsFromSupabase,
  type ReceiptItem,
  type ReceiptPaymentMethod,
} from '../../services/supabaseDataService';

type ReceiptFilter = 'all' | 'pending' | 'received';

const money = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(Number.isFinite(value) ? value : 0);

const paymentLabel: Record<ReceiptPaymentMethod, string> = {
  pix: 'PIX',
  credit_card: 'Crédito',
  debit_card: 'Débito',
  cash: 'Dinheiro',
  other: 'Outro',
};

const getReceiptDate = (receipt: ReceiptItem) => receipt.receivedAt || receipt.createdAt || new Date().toISOString();

export const ReceiptsManagement: React.FC = () => {
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [filter, setFilter] = useState<ReceiptFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptItem | null>(null);
  const [checkoutReceipt, setCheckoutReceipt] = useState<ReceiptItem | null>(null);

  const loadReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReceipts(await fetchReceiptsFromSupabase({ strict: true }));
    } catch (requestError) {
      console.error('Não foi possível carregar recebimentos:', requestError);
      setReceipts([]);
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os recebimentos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReceipts();
    const listener = () => loadReceipts();
    window.addEventListener('adminRefresh', listener);
    return () => window.removeEventListener('adminRefresh', listener);
  }, [loadReceipts]);

  const summary = useMemo(() => {
    const pending = receipts.filter((item) => item.status === 'pending');
    const received = receipts.filter((item) => item.status === 'received');
    const cancelled = receipts.filter((item) => item.status === 'cancelled');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
    const receivedToday = received.filter((item) => getReceiptDate(item).slice(0, 10) === today);
    return {
      pending,
      received,
      cancelled,
      pendingAmount: pending.reduce((total, item) => total + item.totalAmount, 0),
      pendingCashAmount: pending.filter((item) => item.paymentMethod === 'cash').reduce((total, item) => total + item.totalAmount, 0),
      receivedTodayAmount: receivedToday.reduce((total, item) => total + item.totalAmount, 0),
    };
  }, [receipts]);

  const visibleReceipts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return receipts.filter((item) => {
      const statusMatch = filter === 'all' || item.status === filter;
      const queryMatch = !query || [item.clientName, item.serviceTitle, item.professionalName, item.clientPhone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      return statusMatch && queryMatch;
    });
  }, [filter, receipts, search]);

  const pendingVisible = visibleReceipts.filter((item) => item.status === 'pending');
  const historyVisible = visibleReceipts.filter((item) => item.status !== 'pending');

  const updateReceiptInList = (updated: ReceiptItem) => {
    setReceipts((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const openCheckout = (receipt: ReceiptItem) => {
    setSelectedReceipt(null);
    setCheckoutReceipt(receipt);
  };

  const renderReceiptRow = (item: ReceiptItem) => {
    const pending = item.status === 'pending';
    const receiptDate = new Date(getReceiptDate(item)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    return (
      <article key={item.id} className="p-3.5 sm:p-4 bg-surface-card transition-colors hover:bg-surface-base/60">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setSelectedReceipt(item)}
            className="min-w-0 flex-1 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-base/70"
            aria-label={`Abrir recebimento de ${item.clientName}`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center ${pending ? 'bg-amber-500/10 text-amber-500' : 'bg-status-success/10 text-status-success'}`}>
                {pending ? <Clock3 className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-bold text-content-base admin-clamp-2">{item.clientName}</span>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-0.5 text-xs text-content-muted admin-clamp-2">{item.serviceTitle}</p>
                <p className="mt-1 text-[11px] text-content-muted admin-safe-wrap">{item.professionalName || 'Profissional não informado'} · {receiptDate}</p>
              </div>
            </div>
          </button>

          <div className="shrink-0 min-w-[5.25rem] flex flex-col items-end gap-2">
            <p className={`text-sm font-mono font-bold ${pending ? 'text-content-base' : 'finance-positive'}`}>{money(item.totalAmount)}</p>
            {pending ? (
              <button
                type="button"
                onClick={() => openCheckout(item)}
                className="min-h-9 px-2.5 rounded-lg bg-gold-base text-surface-base text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-gold-hover active:scale-[0.98] transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Registrar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedReceipt(item)}
                className="min-h-8 px-2 text-xs text-gold-base font-bold rounded-lg hover:bg-gold-base/10"
              >
                Abrir
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in min-w-0">
      <AdminPageHeader
        icon={CircleDollarSign}
        title="Recebimentos"
        stats={[
          { label: 'Pendente', value: money(summary.pendingAmount), tone: summary.pendingAmount > 0 ? 'warning' : 'neutral' },
          { label: 'Recebido hoje', value: money(summary.receivedTodayAmount), tone: 'finance-positive' },
        ]}
        action={{ label: 'Atualizar', onClick: loadReceipts, icon: RefreshCw, disabled: loading }}
      />

      <div className="md:hidden flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-content-base">Financeiro</p>
          <p className="text-xs text-content-muted admin-safe-wrap">
            {summary.pending.length ? `${summary.pending.length} pendência${summary.pending.length === 1 ? '' : 's'} para revisar` : 'Nenhuma pendência aberta'}
          </p>
        </div>
        <button
          type="button"
          onClick={loadReceipts}
          disabled={loading}
          className="min-h-10 shrink-0 px-3 rounded-xl border border-border-subtle bg-surface-card text-xs font-bold text-content-muted inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 p-3 flex items-center justify-between gap-3 text-sm font-semibold text-status-error">
          <span className="admin-safe-wrap">{error}</span>
          <button type="button" onClick={loadReceipts} className="shrink-0 min-h-9 px-2.5 rounded-lg border border-status-error/30 text-xs font-bold hover:bg-status-error/10">Tentar novamente</button>
        </div>
      )}

      <div className="admin-card-grid admin-card-grid--3">
        <SummaryCard label="Ação agora" value={String(summary.pending.length)} detail={`${money(summary.pendingAmount)} pendente`} icon={Clock3} tone="warning" />
        <SummaryCard label="Recebido hoje" value={money(summary.receivedTodayAmount)} detail={`${summary.received.length} concluído${summary.received.length === 1 ? '' : 's'} no total`} icon={CheckCircle2} tone="success" />
        <SummaryCard label="Em dinheiro" value={money(summary.pendingCashAmount)} detail="Pendências em espécie" icon={Banknote} tone="neutral" />
      </div>

      <div className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-border-subtle space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-serif font-bold text-content-base">Fila financeira</h2>
              <p className="mt-0.5 text-xs text-content-muted admin-safe-wrap">Registre primeiro o que está pendente. O confirmado entra no Extrato.</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, serviço ou barbeiro" aria-label="Buscar recebimentos" className="w-full h-10 rounded-xl bg-surface-base border border-border-subtle pl-9 pr-3 text-sm text-content-base placeholder:text-content-muted focus:outline-none focus:border-gold-base" />
            </div>
          </div>
          <AdminTabs
            tabs={[
              { id: 'all', label: `Todos (${receipts.length})` },
              { id: 'pending', label: `Pendentes (${summary.pending.length})` },
              { id: 'received', label: `Recebidos (${summary.received.length})` },
            ]}
            activeId={filter}
            onChange={(id) => setFilter(id as ReceiptFilter)}
          />
        </div>

        {loading ? (
          <AdminListSkeleton rows={5} className="p-4 sm:p-5" />
        ) : visibleReceipts.length === 0 ? (
          <div className="py-12 px-5 text-center">
            <CircleDollarSign className="w-9 h-9 mx-auto text-content-muted/50" />
            <h3 className="mt-3 text-sm font-bold text-content-base">Nenhum registro encontrado</h3>
            <p className="mt-1 text-xs text-content-muted admin-safe-wrap">Ajuste a busca ou troque o filtro para continuar.</p>
          </div>
        ) : (
          <div className="p-3 sm:p-4 space-y-3">
            {pendingVisible.length > 0 && (
              <ReceiptGroup title="Ação necessária" description="Atendimentos concluídos aguardando pagamento." count={pendingVisible.length} tone="warning">
                {pendingVisible.map(renderReceiptRow)}
              </ReceiptGroup>
            )}
            {historyVisible.length > 0 && (
              <ReceiptGroup title="Histórico" description="Recebimentos confirmados e registros encerrados." count={historyVisible.length} tone="success">
                {historyVisible.map(renderReceiptRow)}
              </ReceiptGroup>
            )}
          </div>
        )}
      </div>

      {selectedReceipt && (
        <ReceiptDetailsModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          onRegister={() => openCheckout(selectedReceipt)}
        />
      )}

      {checkoutReceipt && (
        <ReceiptCheckoutModal
          source={{
            appointmentId: checkoutReceipt.appointmentId || undefined,
            clientId: checkoutReceipt.clientId || undefined,
            clientName: checkoutReceipt.clientName,
            clientPhone: checkoutReceipt.clientPhone || undefined,
            professionalId: checkoutReceipt.professionalId || undefined,
            professionalName: checkoutReceipt.professionalName || undefined,
            serviceTitle: checkoutReceipt.serviceTitle,
            servicePrice: checkoutReceipt.originalAmount,
          }}
          initialReceipt={checkoutReceipt}
          onClose={() => { setCheckoutReceipt(null); loadReceipts(); }}
          onPending={updateReceiptInList}
          onReceived={updateReceiptInList}
        />
      )}
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string; detail: string; icon: React.ElementType; tone: 'warning' | 'success' | 'neutral' }> = ({ label, value, detail, icon: Icon, tone }) => {
  const toneClass = tone === 'warning' ? 'text-amber-500 bg-amber-500/10' : tone === 'success' ? 'text-status-success bg-status-success/10' : 'text-gold-base bg-gold-base/10';
  return <div className="min-w-0 bg-surface-card border border-border-subtle rounded-xl p-3"><div className="flex items-start justify-between gap-2"><span className="text-[11px] font-bold uppercase tracking-wider text-content-muted admin-safe-wrap">{label}</span><span className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${toneClass}`}><Icon className="w-3.5 h-3.5" /></span></div><p className="mt-2 text-base sm:text-lg font-mono font-bold text-content-base truncate">{value}</p><p className="mt-0.5 text-[11px] text-content-muted admin-safe-wrap">{detail}</p></div>;
};

const ReceiptGroup: React.FC<{ title: string; description: string; count: number; tone: 'warning' | 'success'; children: React.ReactNode }> = ({ title, description, count, tone, children }) => (
  <section className="overflow-hidden rounded-xl border border-border-subtle">
    <header className="flex items-center justify-between gap-3 px-3.5 py-3 bg-surface-base/65">
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-content-base flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${tone === 'warning' ? 'bg-amber-500' : 'bg-status-success'}`} aria-hidden="true" />{title}</h3>
        <p className="mt-0.5 text-[11px] text-content-muted admin-safe-wrap">{description}</p>
      </div>
      <span className="shrink-0 rounded-full border border-border-subtle px-2 py-0.5 text-[11px] font-bold text-content-muted">{count}</span>
    </header>
    <div className="divide-y divide-border-subtle">{children}</div>
  </section>
);

const StatusBadge: React.FC<{ status: ReceiptItem['status'] }> = ({ status }) => {
  const received = status === 'received';
  const cancelled = status === 'cancelled';
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${received ? 'bg-status-success/10 text-status-success' : cancelled ? 'bg-status-error/10 text-status-error' : 'bg-amber-500/10 text-amber-500'}`}>{received ? 'Recebido' : cancelled ? 'Cancelado' : 'Pendente'}</span>;
};

const ReceiptDetailsModal: React.FC<{ receipt: ReceiptItem; onClose: () => void; onRegister: () => void }> = ({ receipt, onClose, onRegister }) => {
  const received = receipt.status === 'received';
  const pending = receipt.status === 'pending';
  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5" role="dialog" aria-modal="true" aria-label="Detalhes do recebimento">
      <div className="admin-modal w-full max-w-xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface-card border border-border-subtle shadow-2xl">
        <div className="sticky top-0 p-4 sm:p-5 bg-surface-card border-b border-border-subtle flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-gold-base">Detalhes</p><h2 className="mt-1 text-lg font-serif font-bold text-content-base admin-clamp-2">{receipt.clientName}</h2></div><button type="button" onClick={onClose} aria-label="Fechar detalhes" className="w-10 h-10 rounded-xl flex items-center justify-center text-content-muted hover:text-content-base hover:bg-surface-base"><X className="w-5 h-5" /></button></div>
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm text-content-muted admin-clamp-2">{receipt.serviceTitle}</p><p className="mt-1 text-xs text-content-muted admin-safe-wrap">{receipt.professionalName || 'Profissional não informado'}</p></div><StatusBadge status={receipt.status} /></div>
          <div className="p-3.5 rounded-xl bg-surface-base border border-border-subtle space-y-2.5 text-sm"><AmountRow label="Valor original" value={money(receipt.originalAmount)} /><AmountRow label="Valor revisado" value={money(receipt.enteredAmount)} />{receipt.discountAmount > 0 && <AmountRow label={`Desconto${receipt.discountPercent ? ` (${receipt.discountPercent.toFixed(2)}%)` : ''}`} value={`- ${money(receipt.discountAmount)}`} tone="negative" />}{receipt.surchargeAmount > 0 && <AmountRow label={`Acréscimo${receipt.surchargePercent ? ` (${receipt.surchargePercent.toFixed(2)}%)` : ''}`} value={`+ ${money(receipt.surchargeAmount)}`} tone="positive" />}<div className="pt-2.5 border-t border-border-subtle"><AmountRow label="Valor total" value={money(receipt.totalAmount)} strong tone={received ? 'positive' : undefined} /></div></div>
          {received && <div className="p-3.5 rounded-xl bg-status-success/5 border border-status-success/20 space-y-2 text-sm"><AmountRow label="Pagamento" value={paymentLabel[receipt.paymentMethod || 'other']} /><AmountRow label="Recebido" value={money(receipt.amountReceived)} />{receipt.paymentMethod === 'cash' && <AmountRow label="Troco" value={money(receipt.changeAmount)} tone="positive" />}<AmountRow label="Confirmado em" value={receipt.receivedAt ? new Date(receipt.receivedAt).toLocaleString('pt-BR') : '—'} /></div>}
          {receipt.observations && <div className="p-3.5 rounded-xl bg-surface-base border border-border-subtle"><p className="text-[11px] font-bold uppercase tracking-wider text-content-muted">Observações</p><p className="mt-1 text-sm text-content-base whitespace-pre-wrap admin-safe-wrap">{receipt.observations}</p></div>}
          <div className="pt-3 border-t border-border-subtle flex flex-col-reverse sm:flex-row sm:justify-end gap-2"><button type="button" onClick={onClose} className="h-11 px-5 rounded-xl border border-border-subtle text-content-muted hover:text-content-base text-sm font-bold">Fechar</button>{pending && <button type="button" onClick={onRegister} className="h-11 px-5 rounded-xl bg-gold-base text-surface-base text-sm font-bold flex items-center justify-center gap-2"><CreditCard className="w-4 h-4" />Registrar pagamento</button>}</div>
        </div>
      </div>
    </div>
  );
};

const AmountRow: React.FC<{ label: string; value: string; tone?: 'positive' | 'negative'; strong?: boolean }> = ({ label, value, tone, strong }) => <div className="flex justify-between gap-3"><span className="text-content-muted admin-safe-wrap">{label}</span><strong className={`text-right ${strong ? 'text-base' : ''} ${tone === 'positive' ? 'finance-positive' : tone === 'negative' ? 'finance-negative' : 'text-content-base'}`}>{value}</strong></div>;
