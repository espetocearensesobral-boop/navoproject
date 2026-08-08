import React, { useState, useEffect } from 'react';
import { 
  fetchAppointmentsFromSupabase, 
  fetchProfessionalsFromSupabase,
  fetchCashTransactionsFromSupabase,
  saveCashTransactionInSupabase,
  deleteCashTransactionInSupabase,
  CashTransactionItem
} from '../../services/supabaseDataService';
import { Appointment, Professional } from '../../types';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Wallet, 
  Calendar, 
  Plus, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  XCircle, 
  Filter, 
  X, 
  PieChart, 
  Receipt, 
  CreditCard, 
  Building2, 
  Trash2, 
  Check, 
  Clock, 
  Sparkles, 
  HelpCircle,
  FileText
} from 'lucide-react';

export interface CashTransaction {
  id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  category: string;
  paymentMethod: 'pix' | 'credit_card' | 'debit_card' | 'cash';
  date: string;
  status: 'completed' | 'pending';
  professionalName?: string;
  notes?: string;
}

export const FinancialManagement: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab & Filters
  const [activeTab, setActiveTab] = useState<'overview' | 'cashbook' | 'commissions' | 'categories'>('overview');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'pending'>('all');
  const [periodFilter, setPeriodFilter] = useState<'month' | 'today' | 'all'>('month');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTx, setNewTx] = useState<{
    type: 'income' | 'expense';
    description: string;
    amount: string;
    category: string;
    paymentMethod: 'pix' | 'credit_card' | 'debit_card' | 'cash';
    date: string;
    status: 'completed' | 'pending';
    notes: string;
  }>({
    type: 'income',
    description: '',
    amount: '',
    category: 'Serviços',
    paymentMethod: 'pix',
    date: new Date().toISOString().split('T')[0],
    status: 'completed',
    notes: ''
  });

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [apts, profs, dbTxs] = await Promise.all([
        fetchAppointmentsFromSupabase(),
        fetchProfessionalsFromSupabase(),
        fetchCashTransactionsFromSupabase()
      ]);
      setAppointments(apts);
      setProfessionals(profs);

      // Convert DB cash transactions
      const mappedDbTxs: CashTransaction[] = dbTxs.map(t => ({
        id: t.id,
        type: t.type,
        description: t.description,
        amount: t.amount,
        category: t.category,
        paymentMethod: t.paymentMethod,
        date: t.date,
        status: t.status,
        professionalName: t.professionalName,
        notes: t.notes
      }));

      // Dynamically map finished appointments into income transactions if not present
      let aptTransactions: CashTransaction[] = [];
      if (apts && apts.length > 0) {
        aptTransactions = apts
          .filter(a => a.status === 'completed' || a.status === 'confirmed')
          .map(a => ({
            id: `apt_tx_${a.id}`,
            type: 'income' as const,
            description: `Atendimento: ${a.client_name} (${a.services?.[0]?.title || 'Serviço'})`,
            amount: a.final_amount || a.original_amount || 0,
            category: 'Serviços',
            paymentMethod: (a.payment_method === 'credit_card' ? 'credit_card' : a.payment_method === 'pix' ? 'pix' : 'cash') as any,
            date: a.date || new Date().toISOString().split('T')[0],
            status: 'completed' as const,
            professionalName: a.professional_name
          }));
      }

      const existingIds = new Set(mappedDbTxs.map(t => t.id));
      const aptsToAdd = aptTransactions.filter(t => !existingIds.has(t.id));
      setTransactions([...mappedDbTxs, ...aptsToAdd]);

    } catch (err) {
      console.error('Error loading financial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Financial Calculations
  const completedTx = transactions.filter(t => t.status === 'completed');
  const totalIncomes = completedTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = completedTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalIncomes - totalExpenses;

  const pendingIncomes = transactions.filter(t => t.status === 'pending' && t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const pendingExpenses = transactions.filter(t => t.status === 'pending' && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  // Commissions Calculations
  const activeAppointments = appointments.filter(a => a.status !== 'cancelled');
  const barberCommissions = professionals.map(prof => {
    const profApts = activeAppointments.filter(a => a.professional_id === prof.id);
    const profRevenue = profApts.reduce((sum, a) => sum + (a.final_amount || 0), 0);
    const rate = prof.commission_rate || 0.5;
    const commission = profRevenue * rate;

    // Check paid commissions in transactions
    const paidAmount = transactions
      .filter(t => t.type === 'expense' && t.category === 'Comissões' && t.description.includes(prof.name) && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      id: prof.id,
      name: prof.name || prof.nickname,
      cutsCount: profApts.length,
      revenue: profRevenue,
      commission,
      ratePercentage: Math.round(rate * 100),
      paidAmount,
      balanceDue: Math.max(0, commission - paidAmount)
    };
  });

  const totalCommissionsDue = barberCommissions.reduce((sum, b) => sum + b.commission, 0);

  // Filtered Cash Book Transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = 
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase()) ||
      (t.professionalName && t.professionalName.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === 'income') return t.type === 'income';
    if (filterType === 'expense') return t.type === 'expense';
    if (filterType === 'pending') return t.status === 'pending';

    return true;
  });

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTx.description || !newTx.amount) return;

    const created: CashTransactionItem = {
      id: `tx_custom_${Date.now()}`,
      type: newTx.type,
      description: newTx.description,
      amount: parseFloat(newTx.amount) || 0,
      category: newTx.category,
      paymentMethod: newTx.paymentMethod,
      date: newTx.date || new Date().toISOString().split('T')[0],
      status: newTx.status,
      notes: newTx.notes
    };

    try {
      await saveCashTransactionInSupabase(created, false);
      await loadData();
      setIsModalOpen(false);
      setNewTx({
        type: 'income',
        description: '',
        amount: '',
        category: 'Serviços',
        paymentMethod: 'pix',
        date: new Date().toISOString().split('T')[0],
        status: 'completed',
        notes: ''
      });
      showToast(created.type === 'income' ? 'Entrada lançada com sucesso no Livro de Caixa!' : 'Saída registrada com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar no banco:', err);
      showToast('Erro ao salvar lançamento no banco.');
    }
  };

  const handleToggleStatus = async (id: string) => {
    const target = transactions.find(t => t.id === id);
    if (!target) return;
    const nextStatus = target.status === 'completed' ? 'pending' : 'completed';
    const updated: CashTransactionItem = {
      ...target,
      status: nextStatus
    };

    try {
      if (id.startsWith('apt_tx_')) {
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus } : t));
      } else {
        await saveCashTransactionInSupabase(updated, true);
        await loadData();
      }
      showToast('Status do lançamento atualizado!');
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este lançamento do livro de caixa?')) {
      try {
        if (!id.startsWith('apt_tx_')) {
          await deleteCashTransactionInSupabase(id);
          await loadData();
        } else {
          setTransactions(prev => prev.filter(t => t.id !== id));
        }
        showToast('Lançamento removido do histórico.');
      } catch (err) {
        console.error('Erro ao remover lançamento:', err);
      }
    }
  };

  const handlePayCommission = async (profName: string, amount: number) => {
    if (amount <= 0) return;
    const created: CashTransactionItem = {
      id: `comm_pay_${Date.now()}`,
      type: 'expense',
      description: `Repasse de Comissão: ${profName}`,
      amount: amount,
      category: 'Comissões',
      paymentMethod: 'pix',
      date: new Date().toISOString().split('T')[0],
      status: 'completed',
      professionalName: profName
    };

    try {
      await saveCashTransactionInSupabase(created, false);
      await loadData();
      showToast(`Pagamento de comissão de R$ ${amount.toFixed(2)} registrado no caixa!`);
    } catch (err) {
      console.error('Erro ao registrar comissão:', err);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* HEADER & TOP BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-serif text-content-base font-semibold tracking-tight flex items-center gap-2">
            <span>Financeiro & Livro de Caixa</span>
            <span className="text-[10px] bg-gold-base/15 text-gold-hover border border-[#FFFFFF]/30 px-2 py-0.5 rounded-full uppercase font-bold">
              Navo Cash
            </span>
          </h1>
          <p className="text-content-muted text-xs mt-0.5">
            Controle de fluxo de caixa, receitas, saídas e repasses de comissão em tempo real
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-xs text-gold-hover bg-surface-card px-3 py-1.5 rounded-xl border border-border-subtle font-semibold flex items-center gap-1.5 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-gold-hover" />
            <span>Hoje, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-gold-base text-surface-base px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 hover:bg-gold-base/80 transition-all shadow-md active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Lançamento</span>
          </button>
        </div>
      </div>

      {/* TOAST MESSAGE */}
      {toastMsg && (
        <div className="bg-status-success/10 border border-status-success/30 text-status-success p-3 rounded-xl flex items-center gap-2 text-xs font-bold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* COMPACT KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* Total Incomes */}
        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Entradas</span>
            <div className="w-6 h-6 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-status-success">
            R$ {totalIncomes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">
            {transactions.filter(t => t.type === 'income' && t.status === 'completed').length} recebimentos
          </p>
        </div>

        {/* Total Expenses */}
        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Saídas</span>
            <div className="w-6 h-6 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
              <ArrowDownRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-red-400">
            R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">
            {transactions.filter(t => t.type === 'expense' && t.status === 'completed').length} pagamentos
          </p>
        </div>

        {/* Net Cash Balance */}
        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Saldo em Caixa</span>
            <div className="w-6 h-6 rounded-lg bg-gold-base/10 text-gold-hover flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className={`text-lg font-black ${netBalance >= 0 ? 'text-gold-hover' : 'text-red-400'}`}>
            R$ {netBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">
            {netBalance >= 0 ? 'Lucro em Caixa' : 'Déficit no Período'}
          </p>
        </div>

        {/* Commissions Total */}
        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Repasse Equipe</span>
            <div className="w-6 h-6 rounded-lg bg-gold-base/10 text-gold-hover flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-serif text-content-base font-semibold">
            R$ {totalCommissionsDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">
            {barberCommissions.length} barbeiros ativos
          </p>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-border-subtle pb-2">
        <button
          onClick={() => setActiveTab('cashbook')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'cashbook'
              ? 'bg-gold-base text-surface-base'
              : 'bg-surface-card text-content-muted hover:text-content-base border border-border-subtle'
          }`}
        >
          <Receipt className="w-3.5 h-3.5 shrink-0" />
          <span>Livro de Caixa ({filteredTransactions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-gold-base text-surface-base'
              : 'bg-surface-card text-content-muted hover:text-content-base border border-border-subtle'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          <span>Visão Geral & DRE</span>
        </button>

        <button
          onClick={() => setActiveTab('commissions')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'commissions'
              ? 'bg-gold-base text-surface-base'
              : 'bg-surface-card text-content-muted hover:text-content-base border border-border-subtle'
          }`}
        >
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span>Fechamento Comissões</span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'categories'
              ? 'bg-gold-base text-surface-base'
              : 'bg-surface-card text-content-muted hover:text-content-base border border-border-subtle'
          }`}
        >
          <PieChart className="w-3.5 h-3.5 shrink-0" />
          <span>Categorias & Métodos</span>
        </button>
      </div>

      {/* TAB 1: LIVRO DE CAIXA (CASHBOOK LIST) */}
      {activeTab === 'cashbook' && (
        <div className="space-y-3">
          {/* SEARCH AND FILTERS BAR */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-surface-card p-2.5 rounded-xl border border-border-subtle">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
              <input
                type="text"
                placeholder="Buscar por descrição, categoria ou barbeiro..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-card border border-border-subtle rounded-xl pl-8 pr-3 py-1.5 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'income', label: 'Entradas' },
                { id: 'expense', label: 'Saídas' },
                { id: 'pending', label: 'Pendentes' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                    filterType === f.id
                      ? 'bg-gold-base text-surface-base'
                      : 'bg-surface-card text-content-muted hover:text-content-base border border-border-subtle'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* MOBILE FEED (MD:HIDDEN) */}
          <div className="md:hidden space-y-2">
            {filteredTransactions.map(tx => (
              <div
                key={tx.id}
                className="bg-surface-card border border-border-subtle rounded-xl p-3 space-y-2 hover:border-border-subtle transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      tx.type === 'income' ? 'bg-status-success/15 text-status-success' : 'bg-red-500/15 text-red-400'
                    }`}>
                      {tx.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-content-base truncate">{tx.description}</p>
                      <div className="flex items-center gap-1.5 text-[10px] text-content-muted mt-0.5">
                        <span className="px-1.5 py-0.2 rounded bg-surface-card border border-border-subtle text-content-base font-semibold">
                          {tx.category}
                        </span>
                        <span>• {tx.date}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className={`text-xs font-extrabold ${tx.type === 'income' ? 'text-status-success' : 'text-red-400'}`}>
                      {tx.type === 'income' ? '+' : '-'} R$ {tx.amount.toFixed(2)}
                    </p>
                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded inline-block mt-0.5 ${
                      tx.status === 'completed' ? 'bg-status-success/10 text-status-success' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {tx.status === 'completed' ? 'Pago' : 'Pendente'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border-subtle pt-2 text-[10px] text-content-muted">
                  <span className="uppercase font-semibold text-[#A0A0A0]">
                    💳 {tx.paymentMethod.replace('_', ' ')}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStatus(tx.id)}
                      className="text-gold-hover hover:underline font-bold"
                    >
                      {tx.status === 'completed' ? 'Marcar Pendente' : 'Concluir'}
                    </button>
                    <button
                      onClick={() => handleDeleteTransaction(tx.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {filteredTransactions.length === 0 && (
              <div className="p-8 text-center text-xs text-content-muted bg-surface-card border border-border-subtle rounded-xl">
                Nenhum lançamento encontrado no livro de caixa.
              </div>
            )}
          </div>

          {/* DESKTOP TABLE (HIDDEN MD:BLOCK) */}
          <div className="hidden md:block bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-surface-base text-content-muted border-b border-border-subtle">
                  <tr>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Tipo & Descrição</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Categoria</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Pagamento</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Data</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Status</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px] text-right">Valor</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px] text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-surface-card transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            tx.type === 'income' ? 'bg-status-success/15 text-status-success' : 'bg-red-500/15 text-red-400'
                          }`}>
                            {tx.type === 'income' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <p className="font-bold text-content-base text-xs">{tx.description}</p>
                            {tx.professionalName && (
                              <p className="text-[10px] text-content-muted">Barbeiro: {tx.professionalName}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-surface-card border border-border-subtle text-gold-hover font-semibold text-[10px]">
                          {tx.category}
                        </span>
                      </td>

                      <td className="p-3.5 text-content-muted capitalize">
                        {tx.paymentMethod === 'credit_card' ? 'Cartão Crédito' : tx.paymentMethod === 'debit_card' ? 'Cartão Débito' : tx.paymentMethod.toUpperCase()}
                      </td>

                      <td className="p-3.5 text-content-muted">{tx.date}</td>

                      <td className="p-3.5">
                        <button
                          onClick={() => handleToggleStatus(tx.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 transition-opacity hover:opacity-80 ${
                            tx.status === 'completed'
                              ? 'bg-status-success/15 text-status-success'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}
                        >
                          {tx.status === 'completed' ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          <span>{tx.status === 'completed' ? 'Concluído' : 'Pendente'}</span>
                        </button>
                      </td>

                      <td className={`p-3.5 text-right font-extrabold text-xs ${
                        tx.type === 'income' ? 'text-status-success' : 'text-red-400'
                      }`}>
                        {tx.type === 'income' ? '+' : '-'} R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Remover do Livro de Caixa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredTransactions.length === 0 && (
                <div className="p-8 text-center text-xs text-content-muted">
                  Nenhum lançamento cadastrado no livro de caixa.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OVERVIEW & FINANCIAL HEALTH */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          <div className="bg-surface-card p-4 rounded-2xl border border-border-subtle space-y-3">
            <h3 className="text-sm font-bold text-content-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gold-hover" />
              <span>DRE Simplificado & Destaques de Faturamento</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-surface-card border border-border-subtle rounded-xl space-y-1">
                <span className="text-[10px] text-content-muted font-bold uppercase">Receita Bruta Total</span>
                <p className="text-xl font-black text-status-success">R$ {totalIncomes.toFixed(2)}</p>
                <p className="text-[10px] text-content-muted">100% das vendas registradas</p>
              </div>

              <div className="p-3 bg-surface-card border border-border-subtle rounded-xl space-y-1">
                <span className="text-[10px] text-content-muted font-bold uppercase">Custos & Despesas</span>
                <p className="text-xl font-black text-red-400">R$ {totalExpenses.toFixed(2)}</p>
                <p className="text-[10px] text-content-muted">
                  {totalIncomes > 0 ? ((totalExpenses / totalIncomes) * 100).toFixed(1) : 0}% da receita
                </p>
              </div>

              <div className="p-3 bg-surface-card border border-border-subtle rounded-xl space-y-1">
                <span className="text-[10px] text-content-muted font-bold uppercase">Lucro Líquido Operacional</span>
                <p className="text-xl font-black text-gold-hover">R$ {netBalance.toFixed(2)}</p>
                <p className="text-[10px] text-status-success">
                  Margem de Lucro: {totalIncomes > 0 ? ((netBalance / totalIncomes) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface-card rounded-2xl border border-border-subtle space-y-3">
            <h4 className="text-xs font-bold text-content-base uppercase tracking-wider">Projeções & Recebíveis Pendentes</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-surface-card border border-border-subtle rounded-xl flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-content-muted font-bold">Entradas Pendentes (A Receber)</p>
                  <p className="text-sm font-extrabold text-amber-400 mt-0.5">R$ {pendingIncomes.toFixed(2)}</p>
                </div>
                <Clock className="w-5 h-5 text-amber-400" />
              </div>

              <div className="p-3 bg-surface-card border border-border-subtle rounded-xl flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-content-muted font-bold">Saídas Pendentes (A Pagar)</p>
                  <p className="text-sm font-extrabold text-red-400 mt-0.5">R$ {pendingExpenses.toFixed(2)}</p>
                </div>
                <Clock className="w-5 h-5 text-red-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COMMISSIONS & BARBER PAYOUTS */}
      {activeTab === 'commissions' && (
        <div className="space-y-3">
          <div className="bg-surface-card p-4 rounded-2xl border border-border-subtle space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-content-base">Fechamento de Comissões da Equipe</h3>
                <p className="text-[11px] text-content-muted">
                  Consolidado de atendimentos e repasses individuais calculados automaticamente
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {barberCommissions.map(b => (
                <div key={b.id} className="p-3.5 bg-surface-card border border-border-subtle rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-content-base">{b.name}</p>
                      <p className="text-[10px] text-content-muted">
                        Taxa: <span className="text-gold-hover font-bold">{b.ratePercentage}%</span> • {b.cutsCount} serviços
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-gold-base/10 text-gold-hover text-[10px] font-extrabold">
                      Barbeiro
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-border-subtle pt-2">
                    <div>
                      <span className="text-[9px] text-content-muted block">Faturamento</span>
                      <span className="font-bold text-content-base">R$ {b.revenue.toFixed(2)}</span>
                    </div>

                    <div>
                      <span className="text-[9px] text-content-muted block">Comissão Calculada</span>
                      <span className="font-extrabold text-gold-hover">R$ {b.commission.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border-subtle pt-2">
                    <div>
                      <span className="text-[9px] text-content-muted block">Saldo a Pagar</span>
                      <span className={`text-xs font-black ${b.balanceDue > 0 ? 'text-amber-400' : 'text-status-success'}`}>
                        R$ {b.balanceDue.toFixed(2)}
                      </span>
                    </div>

                    <button
                      onClick={() => handlePayCommission(b.name, b.balanceDue > 0 ? b.balanceDue : b.commission)}
                      className="px-3 py-1.5 rounded-xl bg-gold-base text-surface-base font-extrabold text-[11px] hover:bg-gold-base/80 active:scale-95 transition-all"
                    >
                      Registrar Pagamento
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CATEGORIES & PAYMENT METHODS BREAKDOWN */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-surface-card p-4 rounded-2xl border border-border-subtle space-y-3">
            <h3 className="text-xs font-bold text-content-base uppercase tracking-wider">Origem das Receitas (Por Categoria)</h3>
            <div className="space-y-2">
              {['Serviços', 'Produtos', 'Assinaturas'].map(cat => {
                const catTotal = transactions
                  .filter(t => t.type === 'income' && t.category === cat && t.status === 'completed')
                  .reduce((sum, t) => sum + t.amount, 0);
                const pct = totalIncomes > 0 ? Math.round((catTotal / totalIncomes) * 100) : 0;

                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-content-base font-medium">{cat}</span>
                      <span className="text-gold-hover font-bold">R$ {catTotal.toFixed(2)} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-surface-card rounded-full overflow-hidden border border-border-subtle">
                      <div className="h-full bg-gold-base rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-surface-card p-4 rounded-2xl border border-border-subtle space-y-3">
            <h3 className="text-xs font-bold text-content-base uppercase tracking-wider">Métodos de Pagamento</h3>
            <div className="space-y-2">
              {[
                { key: 'pix', label: 'PIX' },
                { key: 'credit_card', label: 'Cartão de Crédito' },
                { key: 'debit_card', label: 'Cartão de Débito' },
                { key: 'cash', label: 'Dinheiro' }
              ].map(m => {
                const methodTotal = transactions
                  .filter(t => t.paymentMethod === m.key && t.status === 'completed')
                  .reduce((sum, t) => sum + t.amount, 0);

                return (
                  <div key={m.key} className="p-2.5 bg-surface-card rounded-xl border border-border-subtle flex justify-between items-center text-xs">
                    <span className="text-content-base font-bold">{m.label}</span>
                    <span className="text-gold-hover font-extrabold">R$ {methodTotal.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* COMPACT CREATE TRANSACTION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-base/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="bg-surface-card border border-border-subtle sm:border-[#FFFFFF]/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-fade-in">
            {/* Modal Header */}
            <div className="p-3.5 bg-surface-base border-b border-border-subtle flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gold-base/10 border border-[#FFFFFF]/30 flex items-center justify-center text-gold-hover">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-content-base">Novo Lançamento no Caixa</h2>
                  <p className="text-[10px] text-content-muted">Registre entrada de receita ou saída de despesa</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-xl bg-surface-card text-content-muted hover:text-content-base flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleCreateTransaction} className="p-4 overflow-y-auto space-y-3 custom-scrollbar flex-1">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-surface-base border border-border-subtle rounded-xl">
                <button
                  type="button"
                  onClick={() => setNewTx({ ...newTx, type: 'income', category: 'Serviços' })}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    newTx.type === 'income'
                      ? 'bg-status-success text-surface-base'
                      : 'text-content-muted hover:text-content-base'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>+ Entrada (Receita)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewTx({ ...newTx, type: 'expense', category: 'Contas Fixas' })}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    newTx.type === 'expense'
                      ? 'bg-red-500 text-content-base'
                      : 'text-content-muted hover:text-content-base'
                  }`}
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>- Saída (Despesa)</span>
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gold-hover block mb-1">
                  Descrição do Lançamento *
                </label>
                <input
                  type="text"
                  required
                  value={newTx.description}
                  onChange={e => setNewTx({ ...newTx, description: e.target.value })}
                  placeholder={newTx.type === 'income' ? 'Ex: Venda de Pomada / Serviço Avulso' : 'Ex: Conta de Luz / Aluguel / Fornecedor'}
                  className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-gold-hover block mb-1">
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newTx.amount}
                    onChange={e => setNewTx({ ...newTx, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-content-base focus:outline-none focus:border-[#FFFFFF]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gold-hover block mb-1">
                    Categoria
                  </label>
                  <select
                    value={newTx.category}
                    onChange={e => setNewTx({ ...newTx, category: e.target.value })}
                    className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                  >
                    {newTx.type === 'income' ? (
                      <>
                        <option value="Serviços">Serviços</option>
                        <option value="Produtos">Produtos</option>
                        <option value="Assinaturas">Assinaturas VIP</option>
                        <option value="Outras Receitas">Outras Receitas</option>
                      </>
                    ) : (
                      <>
                        <option value="Contas Fixas">Contas Fixas (Luz, Água, Aluguel)</option>
                        <option value="Comissões">Comissão de Barbeiro</option>
                        <option value="Insumos & Suprimentos">Insumos & Produtos</option>
                        <option value="Manutenção & Equipamentos">Manutenção & Equipamentos</option>
                        <option value="Outras Despesas">Outras Despesas</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-gold-hover block mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={newTx.paymentMethod}
                    onChange={e => setNewTx({ ...newTx, paymentMethod: e.target.value as any })}
                    className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                  >
                    <option value="pix">PIX</option>
                    <option value="credit_card">Cartão de Crédito</option>
                    <option value="debit_card">Cartão de Débito</option>
                    <option value="cash">Dinheiro em Espécie</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gold-hover block mb-1">
                    Data do Lançamento
                  </label>
                  <input
                    type="date"
                    value={newTx.date}
                    onChange={e => setNewTx({ ...newTx, date: e.target.value })}
                    className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                  />
                </div>
              </div>

              <div className="p-3 bg-surface-base border border-border-subtle rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-content-base block">Status do Pagamento</span>
                  <span className="text-[10px] text-content-muted">
                    {newTx.status === 'completed' ? 'Marcar como Pago / Concluído' : 'Marcar como Pendente (A Pagar/Receber)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setNewTx({ ...newTx, status: newTx.status === 'completed' ? 'pending' : 'completed' })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                    newTx.status === 'completed'
                      ? 'bg-status-success text-surface-base'
                      : 'bg-amber-500 text-surface-base'
                  }`}
                >
                  {newTx.status === 'completed' ? 'Concluído' : 'Pendente'}
                </button>
              </div>

              {/* Modal Footer */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-content-muted hover:text-content-base bg-surface-card"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-extrabold text-surface-base bg-gold-base hover:bg-gold-base/80 transition-all"
                >
                  Salvar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

