import React, { useEffect, useState } from 'react';
import { 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight, 
  Download, 
  Search, 
  Filter, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  Clock, 
  PieChart 
} from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { fetchCashTransactionsFromSupabase } from '../../services/supabaseDataService';
import { getTodayStringBRT } from '../../utils/dateUtils';

export interface FinancialTransaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  date: string;
  operatorName: string;
  status?: 'completed' | 'pending' | 'cancelled';
}

export const FinancialStatementManagement: React.FC = () => {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCashTransactionsFromSupabase({ strict: true });
      setTransactions(data.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        category: transaction.category,
        description: transaction.description,
        amount: Number(transaction.amount || 0),
        paymentMethod: transaction.paymentMethod,
        date: transaction.date,
        operatorName: transaction.professionalName || 'Sistema',
        status: transaction.status
      })));
    } catch (err: any) {
      setTransactions([]);
      setError(err?.message || 'Não foi possível carregar o extrato real.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
    const handleRefresh = () => loadTransactions();
    window.addEventListener('adminRefresh', handleRefresh);
    return () => window.removeEventListener('adminRefresh', handleRefresh);
  }, []);

  const formatTransactionDate = (value: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('/');
    return new Date(value).toLocaleString('pt-BR');
  };

  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [search, setSearch] = useState('');

  const visibleTransactions = transactions.filter(t => t.status !== 'cancelled');
  const totalIncomes = visibleTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = visibleTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const netBalance = totalIncomes - totalExpenses;

  const filtered = visibleTransactions.filter(t => {
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase()) ||
                          t.category.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleExportCsv = () => {
    const csv = 'Data,Tipo,Categoria,Descrição,Valor,Forma Pagamento\n' +
      filtered.map(t => `"${formatTransactionDate(t.date)}","${t.type}","${t.category}","${t.description}",${t.amount},"${t.paymentMethod}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extrato_financeiro_${getTodayStringBRT()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={DollarSign}
        title="Extrato Financeiro & Balancete"
        action={{ label: 'Baixar CSV', onClick: handleExportCsv, icon: Download }}
      />

      {/* Ação (mobile) */}
      <button
        onClick={handleExportCsv}
        className="md:hidden w-full bg-surface-base border border-border-subtle hover:border-gold-base/50 text-content-base px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shrink-0"
      >
        <Download className="w-4 h-4 text-gold-base" />
        <span>Baixar Extrato CSV</span>
      </button>

      {loading && <div className="p-3 rounded-xl border border-border-subtle bg-surface-card text-xs text-content-muted">Carregando lançamentos reais...</div>}
      {error && (
        <div className="p-3 rounded-xl border border-status-error/30 bg-status-error/10 text-status-error text-xs font-semibold flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={loadTransactions} className="shrink-0 underline">Tentar novamente</button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-status-success mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Entradas</span>
            <div className="w-6 h-6 rounded-lg bg-status-success/10 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black finance-positive tabular-nums truncate">+ R$ {totalIncomes.toFixed(2)}</p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">Lançamentos persistidos</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-status-error mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Saídas</span>
            <div className="w-6 h-6 rounded-lg bg-status-error/10 flex items-center justify-center shrink-0">
              <ArrowDownRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black finance-negative tabular-nums truncate">- R$ {totalExpenses.toFixed(2)}</p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">Saídas persistidas</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-gold-base mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Resultado</span>
            <div className="w-6 h-6 rounded-lg bg-gold-base/10 flex items-center justify-center shrink-0">
              <PieChart className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className={`text-lg font-black tabular-nums truncate ${netBalance >= 0 ? 'finance-positive' : 'finance-negative'}`}>
             R$ {netBalance.toFixed(2)}
          </p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">Saldo do extrato</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-content-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar lançamentos no extrato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-card border border-border-subtle rounded-xl pl-10 pr-4 py-2.5 text-xs text-content-base focus:outline-none focus:ring-1 focus:ring-gold-base/50"
          />
        </div>

        <div className="flex bg-surface-card p-1 rounded-xl border border-border-subtle shrink-0">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'income', label: 'Entradas' },
            { id: 'expense', label: 'Saídas' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterType === f.id ? 'bg-gold-base text-surface-base shadow-xs' : 'text-content-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead className="bg-surface-base border-b border-border-subtle text-content-muted uppercase font-bold text-[10px]">
              <tr className="whitespace-nowrap">
                <th className="p-3">Data / Hora</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Categoria</th>
                <th className="p-3 min-w-[200px]">Descrição</th>
                <th className="p-3">Forma Pagto</th>
                <th className="p-3 text-right">Valor R$</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/60 text-content-base">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-surface-base/50 transition-colors">
                  <td className="p-3 font-mono text-[11px] text-content-muted whitespace-nowrap">
                    {formatTransactionDate(t.date)}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {t.type === 'income' ? (
                      <span className="bg-status-success/15 text-status-success font-bold text-[10px] px-2 py-0.5 rounded-xl uppercase inline-flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" />
                        Entrada
                      </span>
                    ) : (
                      <span className="bg-status-error/15 text-status-error font-bold text-[10px] px-2 py-0.5 rounded-xl uppercase inline-flex items-center gap-1">
                        <ArrowDownRight className="w-3 h-3" />
                        Saída
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-semibold text-content-muted">
                    {t.category}
                  </td>
                  <td className="p-3 font-bold text-content-base">
                    {t.description}
                  </td>
                  <td className="p-3 font-mono text-content-muted">
                    {t.paymentMethod}
                  </td>
                  <td className={`p-3 text-right font-bold tabular-nums whitespace-nowrap ${
                    t.type === 'income' ? 'finance-positive' : 'finance-negative'
                  }`}>
                    {t.type === 'income' ? '+' : '-'} R$ {t.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
