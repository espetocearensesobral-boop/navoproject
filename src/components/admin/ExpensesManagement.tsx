import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, Edit3, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { handleEnterAsTab } from '../../utils/formUtils';
import {
  deleteCashTransactionInSupabase,
  fetchCashTransactionsFromSupabase,
  saveCashTransactionInSupabase,
  type CashTransactionItem,
} from '../../services/supabaseDataService';
import { getTodayStringBRT } from '../../utils/dateUtils';

const categories = ['Fornecedores', 'Aluguel', 'Utilidades', 'Produtos e estoque', 'Marketing', 'Comissões', 'Manutenção', 'Impostos', 'Outros'];
const paymentMethods = [
  { id: 'pix', label: 'PIX' },
  { id: 'credit_card', label: 'Cartão de crédito' },
  { id: 'debit_card', label: 'Cartão de débito' },
  { id: 'cash', label: 'Dinheiro' },
  { id: 'other', label: 'Outro' },
];

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const createEmptyExpense = (): CashTransactionItem => ({
  id: '',
  type: 'expense',
  description: '',
  amount: 0,
  category: 'Fornecedores',
  paymentMethod: 'pix',
  date: getTodayStringBRT(),
  status: 'completed',
  notes: '',
});

export const ExpensesManagement: React.FC = () => {
  const [expenses, setExpenses] = useState<CashTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<CashTransactionItem | null>(null);
  const [form, setForm] = useState<CashTransactionItem>(createEmptyExpense);

  const loadExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const transactions = await fetchCashTransactionsFromSupabase({ strict: true });
      setExpenses(transactions.filter((transaction) => transaction.type === 'expense' && transaction.status !== 'cancelled'));
    } catch (requestError) {
      setExpenses([]);
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar as saídas reais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
    const refresh = () => loadExpenses();
    window.addEventListener('adminRefresh', refresh);
    return () => window.removeEventListener('adminRefresh', refresh);
  }, []);

  const visibleExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return expenses.filter((item) => !query || [item.description, item.category, item.paymentMethod, item.notes]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)));
  }, [expenses, search]);

  const totalExpenses = expenses.reduce((total, item) => total + Number(item.amount || 0), 0);
  const currentMonth = getTodayStringBRT().slice(0, 7);
  const monthlyExpenses = expenses.filter((item) => item.date.startsWith(currentMonth)).reduce((total, item) => total + Number(item.amount || 0), 0);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    setForm(createEmptyExpense());
    setError(null);
  };

  const openCreate = () => {
    setEditingExpense(null);
    setForm(createEmptyExpense());
    setIsModalOpen(true);
  };

  const openEdit = (expense: CashTransactionItem) => {
    setEditingExpense(expense);
    setForm({ ...expense, notes: expense.notes || '' });
    setIsModalOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.description.trim() || !form.category.trim() || Number(form.amount) <= 0) {
      setError('Informe descrição, categoria e um valor maior que zero.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await saveCashTransactionInSupabase({
        ...form,
        id: editingExpense?.id || `tx_expense_${Date.now()}`,
        type: 'expense',
        amount: Number(form.amount),
        description: form.description.trim(),
        category: form.category.trim(),
        paymentMethod: form.paymentMethod || 'other',
        date: form.date || getTodayStringBRT(),
        status: 'completed',
        notes: form.notes?.trim() || undefined,
      }, Boolean(editingExpense));
      setExpenses(updated.filter((transaction) => transaction.type === 'expense' && transaction.status !== 'cancelled'));
      window.dispatchEvent(new Event('adminRefresh'));
      closeModal();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar a saída financeira.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expense: CashTransactionItem) => {
    if (!window.confirm(`Excluir a saída “${expense.description}”? Ela será removida do Extrato real.`)) return;
    try {
      const updated = await deleteCashTransactionInSupabase(expense.id);
      setExpenses(updated.filter((transaction) => transaction.type === 'expense' && transaction.status !== 'cancelled'));
      window.dispatchEvent(new Event('adminRefresh'));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível remover a saída financeira.');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      <AdminPageHeader
        icon={ArrowDownRight}
        title="Saídas"
        stats={[
          { label: 'mês atual', value: money(monthlyExpenses), tone: monthlyExpenses > 0 ? 'finance-negative' : 'muted' },
          { label: 'lançamentos', value: expenses.length, tone: 'neutral' },
        ]}
        action={{ label: 'Nova saída', onClick: openCreate, icon: Plus }}
      />

      <div className="md:hidden"><button type="button" onClick={openCreate} className="w-full h-11 rounded-xl bg-status-error text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]"><Plus className="w-4 h-4" /> Nova saída</button></div>

      {error && <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-3.5 py-3 text-sm font-semibold text-status-error flex items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Fechar aviso"><X className="w-4 h-4" /></button></div>}

      <div className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><h2 className="text-base font-serif font-bold text-content-base">Saídas</h2><p className="mt-0.5 text-sm text-content-muted">Toda saída entra no Extrato e nos Relatórios.</p></div>
          <div className="relative w-full sm:w-72"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Descrição ou categoria" className="w-full h-11 rounded-xl bg-surface-base border border-border-subtle pl-9 pr-3 text-sm text-content-base placeholder:text-content-muted focus:outline-none focus:border-gold-base" /></div>
        </div>

        {loading ? <div className="py-16 text-center text-sm text-content-muted"><RefreshCw className="w-4 h-4 inline animate-spin mr-2" />Carregando saídas…</div> : visibleExpenses.length === 0 ? <div className="py-16 px-5 text-center"><ArrowDownRight className="w-10 h-10 mx-auto text-content-muted/50" /><h3 className="mt-3 text-base font-bold text-content-base">Nenhuma saída registrada</h3><p className="mt-1 text-sm text-content-muted">Use “Nova saída” para registrar uma despesa.</p></div> : <div className="divide-y divide-border-subtle">{visibleExpenses.map((expense) => <article key={expense.id} className="p-4 sm:px-5 flex items-start gap-3"><span className="w-10 h-10 shrink-0 rounded-xl bg-status-error/10 text-status-error flex items-center justify-center"><ArrowDownRight className="w-5 h-5" /></span><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h3 className="text-sm font-bold text-content-base admin-clamp-2">{expense.description}</h3><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-surface-base border border-border-subtle text-content-muted admin-safe-wrap">{expense.category}</span></div><p className="mt-1 text-xs text-content-muted">{expense.date.split('-').reverse().join('/')} · {paymentMethods.find((method) => method.id === expense.paymentMethod)?.label || expense.paymentMethod}</p>{expense.notes && <p className="mt-1 text-xs text-content-muted admin-clamp-2">{expense.notes}</p>}</div><div className="text-right shrink-0"><p className="text-sm font-mono font-bold finance-negative">- {money(Number(expense.amount))}</p><div className="mt-2 flex justify-end gap-1"><button type="button" onClick={() => openEdit(expense)} className="w-8 h-8 rounded-lg border border-border-subtle text-content-muted hover:text-content-base flex items-center justify-center" aria-label={`Editar ${expense.description}`}><Edit3 className="w-3.5 h-3.5" /></button><button type="button" onClick={() => handleDelete(expense)} className="w-8 h-8 rounded-lg border border-status-error/25 text-status-error flex items-center justify-center" aria-label={`Excluir ${expense.description}`}><Trash2 className="w-3.5 h-3.5" /></button></div></div></article>)}</div>}
      </div>

      {isModalOpen && <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5"><div className="admin-modal w-full max-w-xl rounded-t-2xl sm:rounded-2xl bg-surface-card border border-border-subtle max-h-[94dvh] overflow-y-auto"><div className="sticky top-0 z-10 p-5 sm:p-6 bg-surface-card border-b border-border-subtle flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-gold-base">Livro-caixa</p><h2 className="mt-1 text-lg font-serif font-bold text-content-base">{editingExpense ? 'Editar saída' : 'Nova saída'}</h2></div><button type="button" onClick={closeModal} className="w-10 h-10 rounded-xl text-content-muted hover:text-content-base hover:bg-surface-base flex items-center justify-center" aria-label="Fechar formulário"><X className="w-5 h-5" /></button></div><form onSubmit={handleSave} onKeyDown={handleEnterAsTab} className="p-5 sm:p-6 space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="sm:col-span-2"><span className="text-sm font-bold text-content-base block mb-1.5">Descrição *</span><input autoFocus value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Ex.: Produtos para revenda" className="w-full h-11 rounded-xl bg-surface-base border border-border-subtle px-3 text-sm text-content-base placeholder:text-content-muted focus:outline-none focus:border-gold-base" /></label><label><span className="text-sm font-bold text-content-base block mb-1.5">Categoria *</span><select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="w-full h-11 rounded-xl bg-surface-base border border-border-subtle px-3 text-sm text-content-base focus:outline-none focus:border-gold-base">{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><label><span className="text-sm font-bold text-content-base block mb-1.5">Data *</span><input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className="w-full h-11 rounded-xl bg-surface-base border border-border-subtle px-3 text-sm text-content-base focus:outline-none focus:border-gold-base" /></label><label><span className="text-sm font-bold text-content-base block mb-1.5">Valor *</span><input type="number" min="0.01" step="0.01" value={form.amount || ''} onChange={(event) => setForm((current) => ({ ...current, amount: Number(event.target.value) }))} placeholder="0,00" className="w-full h-11 rounded-xl bg-surface-base border border-border-subtle px-3 text-sm font-mono font-bold finance-negative focus:outline-none focus:border-gold-base" /></label><label><span className="text-sm font-bold text-content-base block mb-1.5">Forma de pagamento</span><select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))} className="w-full h-11 rounded-xl bg-surface-base border border-border-subtle px-3 text-sm text-content-base focus:outline-none focus:border-gold-base">{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}</select></label><label className="sm:col-span-2"><span className="text-sm font-bold text-content-base block mb-1.5">Observações</span><textarea rows={3} value={form.notes || ''} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Observação opcional" className="w-full rounded-xl bg-surface-base border border-border-subtle px-3 py-3 text-sm text-content-base placeholder:text-content-muted resize-none focus:outline-none focus:border-gold-base" /></label></div><div className="pt-4 border-t border-border-subtle flex flex-col-reverse sm:flex-row sm:justify-end gap-2"><button type="button" onClick={closeModal} className="h-11 px-5 rounded-xl border border-border-subtle text-content-muted hover:text-content-base text-sm font-bold">Cancelar</button><button type="submit" disabled={saving} className="h-11 px-5 rounded-xl bg-gold-base text-surface-base text-sm font-bold disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button></div></form></div></div>}
    </div>
  );
};
