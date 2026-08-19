import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  RefreshCw,
  Search,
  UserRound,
  WalletCards,
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
    } catch (error) {
      console.error('Não foi possível carregar recebimentos:', error);
      setReceipts([]);
      setError(error instanceof Error ? error.message : 'Não foi possível carregar os recebimentos.');
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
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
    const receivedToday = received.filter((item) => getReceiptDate(item).slice(0, 10) === today);
    return {
      pending,
      received,
      pendingAmount: pending.reduce((total, item) => total + item.totalAmount, 0),
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

  const updateReceiptInList = (updated: ReceiptItem) => {
    setReceipts((current) => current.map((item) => item.id === updated.id ? updated : item));
    setSelectedReceipt(updated);
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

      {error && <div className="rounded-xl border border-status-error/30 bg-status-error/10 p-3.5 text-sm font-semibold text-status-error">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Pendentes" value={String(summary.pending.length)} detail={money(summary.pendingAmount)} icon={Clock3} tone="warning" />
        <SummaryCard label="Recebidos" value={String(summary.received.length)} detail="Histórico consolidado" icon={CheckCircle2} tone="success" />
        <SummaryCard label="Dinheiro pendente" value={money(summary.pending.filter((item) => item.paymentMethod === 'cash').reduce((total, item) => total + item.totalAmount, 0))} detail="A definir no recebimento" icon={Banknote} tone="neutral" />
        <SummaryCard label="Ação da recepção" value={summary.pending.length ? 'Cobrar' : 'Em dia'} detail={summary.pending.length ? 'Abra a pendência para receber' : 'Nenhuma pendência aberta'} icon={WalletCards} tone={summary.pending.length ? 'warning' : 'success'} />
      </div>

      <div className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border-subtle space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-base font-serif font-bold text-content-base">Recebimentos</h2>
              <p className="mt-0.5 text-sm text-content-muted">Pendências surgem ao finalizar. Confirmados entram no extrato.</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, serviço ou barbeiro" className="w-full h-11 rounded-xl bg-surface-base border border-border-subtle pl-9 pr-3 text-sm text-content-base placeholder:text-content-muted focus:outline-none focus:border-gold-base" />
            </div>
          </div>
          <AdminTabs
            tabs={[
              { id: 'all', label: 'Todos' },
              { id: 'pending', label: 'Pendentes' },
              { id: 'received', label: 'Recebidos' },
            ]}
            activeId={filter}
            onChange={(id) => setFilter(id as ReceiptFilter)}
          />
        </div>

        {loading ? (
          <AdminListSkeleton rows={5} className="p-4 sm:p-5" />
        ) : visibleReceipts.length === 0 ? (
          <div className="py-16 px-5 text-center"><CircleDollarSign className="w-10 h-10 mx-auto text-content-muted/50" /><h3 className="mt-3 text-base font-bold text-content-base">Nenhum recebimento encontrado</h3><p className="mt-1 text-sm text-content-muted">Atendimentos finalizados ficam pendentes até a confirmação do pagamento.</p></div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {visibleReceipts.map((item) => {
              const pending = item.status === 'pending';
              return (
                <button key={item.id} type="button" onClick={() => setSelectedReceipt(item)} className="w-full p-4 sm:px-5 text-left hover:bg-surface-base/70 active:bg-surface-base active:scale-[0.998] transition-[transform,background-color] duration-150">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${pending ? 'bg-amber-500/10 text-amber-500' : 'bg-status-success/10 text-status-success'}`}>{pending ? <Clock3 className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-sm font-bold text-content-base admin-clamp-2">{item.clientName}</span><StatusBadge status={item.status} /></div>
                      <p className="mt-1 text-sm text-content-muted admin-clamp-2">{item.serviceTitle}</p>
                      <p className="mt-1 text-xs text-content-muted admin-safe-wrap">{item.professionalName || 'Profissional não informado'} · {new Date(getReceiptDate(item)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                    <div className="text-right shrink-0"><p className={`text-sm sm:text-base font-mono font-bold ${pending ? 'text-content-base' : 'finance-positive'}`}>{money(item.totalAmount)}</p><p className="mt-1 text-xs text-gold-base font-bold">Abrir</p></div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedReceipt && (
        <ReceiptDetailsModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          onRegister={() => setCheckoutReceipt(selectedReceipt)}
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
          onReceived={(updated) => { updateReceiptInList(updated); loadReceipts(); }}
        />
      )}
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string; detail: string; icon: React.ElementType; tone: 'warning' | 'success' | 'neutral' }> = ({ label, value, detail, icon: Icon, tone }) => {
  const toneClass = tone === 'warning' ? 'text-amber-500 bg-amber-500/10' : tone === 'success' ? 'text-status-success bg-status-success/10' : 'text-gold-base bg-gold-base/10';
  return <div className="min-w-0 bg-surface-card border border-border-subtle rounded-xl p-3.5 sm:p-4"><div className="flex items-start justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wider text-content-muted admin-safe-wrap">{label}</span><span className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${toneClass}`}><Icon className="w-4 h-4" /></span></div><p className="mt-3 text-lg sm:text-xl font-mono font-bold text-content-base truncate">{value}</p><p className="mt-1 text-xs text-content-muted admin-safe-wrap">{detail}</p></div>;
};

const StatusBadge: React.FC<{ status: ReceiptItem['status'] }> = ({ status }) => {
  const received = status === 'received';
  const cancelled = status === 'cancelled';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${received ? 'bg-status-success/10 text-status-success' : cancelled ? 'bg-status-error/10 text-status-error' : 'bg-amber-500/10 text-amber-500'}`}>{received ? 'Recebido' : cancelled ? 'Cancelado' : 'Pendente'}</span>;
};

const ReceiptDetailsModal: React.FC<{ receipt: ReceiptItem; onClose: () => void; onRegister: () => void }> = ({ receipt, onClose, onRegister }) => {
  const received = receipt.status === 'received';
  const pending = receipt.status === 'pending';
  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5" role="dialog" aria-modal="true" aria-label="Extrato">
      <div className="admin-modal w-full max-w-xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface-card border border-border-subtle shadow-2xl">
        <div className="sticky top-0 p-5 sm:p-6 bg-surface-card border-b border-border-subtle flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-gold-base">Extrato</p><h2 className="mt-1 text-lg font-serif font-bold text-content-base admin-clamp-2">{receipt.clientName}</h2></div><button type="button" onClick={onClose} className="w-10 h-10 rounded-xl flex items-center justify-center text-content-muted hover:text-content-base hover:bg-surface-base"><X className="w-5 h-5" /></button></div>
        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm text-content-muted admin-clamp-2">{receipt.serviceTitle}</p><p className="mt-1 text-xs text-content-muted admin-safe-wrap">{receipt.professionalName || 'Profissional não informado'}</p></div><StatusBadge status={receipt.status} /></div>
          <div className="p-4 rounded-xl bg-surface-base border border-border-subtle space-y-3 text-sm"><AmountRow label="Valor original" value={money(receipt.originalAmount)} /><AmountRow label="Valor revisado" value={money(receipt.enteredAmount)} />{receipt.discountAmount > 0 && <AmountRow label={`Desconto${receipt.discountPercent ? ` (${receipt.discountPercent.toFixed(2)}%)` : ''}`} value={`- ${money(receipt.discountAmount)}`} tone="negative" />}{receipt.surchargeAmount > 0 && <AmountRow label={`Acréscimo${receipt.surchargePercent ? ` (${receipt.surchargePercent.toFixed(2)}%)` : ''}`} value={`+ ${money(receipt.surchargeAmount)}`} tone="positive" />}<div className="pt-3 border-t border-border-subtle"><AmountRow label="Valor total" value={money(receipt.totalAmount)} strong tone={received ? 'positive' : undefined} /></div></div>
          {received && <div className="p-4 rounded-xl bg-status-success/5 border border-status-success/20 space-y-2 text-sm"><AmountRow label="Forma de pagamento" value={paymentLabel[receipt.paymentMethod || 'other']} /><AmountRow label="Recebido" value={money(receipt.amountReceived)} />{receipt.paymentMethod === 'cash' && <AmountRow label="Troco" value={money(receipt.changeAmount)} tone="positive" />}<AmountRow label="Confirmado em" value={receipt.receivedAt ? new Date(receipt.receivedAt).toLocaleString('pt-BR') : '—'} /></div>}
          {receipt.observations && <div className="p-4 rounded-xl bg-surface-base border border-border-subtle"><p className="text-xs font-bold uppercase tracking-wider text-content-muted">Observações</p><p className="mt-2 text-sm text-content-base whitespace-pre-wrap">{receipt.observations}</p></div>}
          <div className="pt-4 border-t border-border-subtle flex flex-col-reverse sm:flex-row sm:justify-end gap-2"><button type="button" onClick={onClose} className="h-11 px-5 rounded-xl border border-border-subtle text-content-muted hover:text-content-base text-sm font-bold">Fechar</button>{pending && <button type="button" onClick={onRegister} className="h-11 px-5 rounded-xl bg-gold-base text-surface-base text-sm font-bold flex items-center justify-center gap-2"><CreditCard className="w-4 h-4" />Registrar</button>}</div>
        </div>
      </div>
    </div>
  );
};

const AmountRow: React.FC<{ label: string; value: string; tone?: 'positive' | 'negative'; strong?: boolean }> = ({ label, value, tone, strong }) => <div className="flex justify-between gap-3"><span className="text-content-muted admin-safe-wrap">{label}</span><strong className={`text-right ${strong ? 'text-base' : ''} ${tone === 'positive' ? 'finance-positive' : tone === 'negative' ? 'finance-negative' : 'text-content-base'}`}>{value}</strong></div>;
