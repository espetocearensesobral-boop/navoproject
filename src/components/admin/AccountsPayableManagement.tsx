import React, { useState } from 'react';
import { handleEnterAsTab } from "../../utils/formUtils";
import { 
  CreditCard, 
  Plus, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Filter, 
  Search, 
  Trash2, 
  Building, 
  Tag, 
  X 
} from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { AdminTabs } from './shared/AdminTabs';

export interface PayableAccount {
  id: string;
  description: string;
  supplier: string;
  category: 'aluguel' | 'fornecedores' | 'utilidades' | 'equipamentos' | 'marketing' | 'impostos';
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  isRecurring?: boolean;
  installment?: string;
}

export const AccountsPayableManagement: React.FC = () => {
  const [accounts, setAccounts] = useState<PayableAccount[]>(() => {
    const saved = localStorage.getItem('navo_accounts_payable_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        id: 'ap_01',
        description: 'Aluguel do Imóvel da Barbearia',
        supplier: 'Imobiliária Central',
        category: 'aluguel',
        amount: 3500.00,
        dueDate: '2026-08-10',
        status: 'pending',
        isRecurring: true
      },
      {
        id: 'ap_02',
        description: 'Lote de Produtos Pomadas e Shampoos',
        supplier: 'Distribuidora Barber Beauty',
        category: 'fornecedores',
        amount: 1250.00,
        dueDate: '2026-08-05',
        status: 'overdue',
        installment: '1/2'
      },
      {
        id: 'ap_03',
        description: 'Conta de Energia Elétrica (Enel)',
        supplier: 'Enel Distribuição',
        category: 'utilidades',
        amount: 680.40,
        dueDate: '2026-08-18',
        status: 'pending',
        isRecurring: true
      },
      {
        id: 'ap_04',
        description: 'Anúncios Instagram & Google Ads',
        supplier: 'Meta Ads / Google',
        category: 'marketing',
        amount: 400.00,
        dueDate: '2026-08-02',
        status: 'paid'
      }
    ];
  });

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [desc, setDesc] = useState('');
  const [supplier, setSupplier] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<PayableAccount['category']>('fornecedores');

  const totalPending = accounts.filter(a => a.status === 'pending').reduce((acc, a) => acc + a.amount, 0);
  const totalOverdue = accounts.filter(a => a.status === 'overdue').reduce((acc, a) => acc + a.amount, 0);
  const totalPaid = accounts.filter(a => a.status === 'paid').reduce((acc, a) => acc + a.amount, 0);

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !amount) return;

    const newAcc: PayableAccount = {
      id: `ap_${Date.now()}`,
      description: desc.trim(),
      supplier: supplier.trim() || 'Fornecedor Geral',
      category,
      amount: Number(amount),
      dueDate,
      status: 'pending'
    };

    const updated = [newAcc, ...accounts];
    setAccounts(updated);
    localStorage.setItem('navo_accounts_payable_v1', JSON.stringify(updated));

    setDesc('');
    setSupplier('');
    setAmount('');
    setIsModalOpen(false);
  };

  const handleTogglePaid = (id: string) => {
    const updated = accounts.map(a => {
      if (a.id === id) {
        return {
          ...a,
          status: a.status === 'paid' ? 'pending' : 'paid' as PayableAccount['status']
        };
      }
      return a;
    });
    setAccounts(updated);
    localStorage.setItem('navo_accounts_payable_v1', JSON.stringify(updated));
  };

  const handleDelete = (id: string) => {
    const updated = accounts.filter(a => a.id !== id);
    setAccounts(updated);
    localStorage.setItem('navo_accounts_payable_v1', JSON.stringify(updated));
  };

  const filteredAccounts = accounts.filter(a => {
    if (filterStatus === 'all') return true;
    return a.status === filterStatus;
  });

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={CreditCard}
        title="Contas a Pagar & Despesas"
        action={{ label: 'Nova Conta', onClick: () => setIsModalOpen(true) }}
      />

      {/* Ação (mobile) */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="md:hidden w-full bg-gold-base hover:bg-gold-hover text-surface-base px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all shrink-0"
      >
        <Plus className="w-4 h-4 stroke-[2.5]" />
        <span>Lançar Nova Conta</span>
      </button>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 bg-surface-card border border-status-error/30 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-status-error mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Vencidas</span>
            <div className="w-6 h-6 rounded-lg bg-status-error/10 flex items-center justify-center shrink-0">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-status-error tabular-nums truncate">R$ {totalOverdue.toFixed(2)}</p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">{accounts.filter(a => a.status === 'overdue').length} conta(s)</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">A Pagar</span>
            <div className="w-6 h-6 rounded-lg bg-gold-base/10 text-gold-base flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-gold-base tabular-nums truncate">R$ {totalPending.toFixed(2)}</p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">{accounts.filter(a => a.status === 'pending').length} a vencer</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Total Pago</span>
            <div className="w-6 h-6 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-status-success tabular-nums truncate">R$ {totalPaid.toFixed(2)}</p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">Liquidadas no período</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <AdminTabs
        tabs={[
          { id: 'all', label: 'Todas' },
          { id: 'pending', label: 'A Vencer' },
          { id: 'overdue', label: 'Vencidas' },
          { id: 'paid', label: 'Pagas' }
        ]}
        activeId={filterStatus}
        onChange={setFilterStatus}
      />

      {/* Accounts List */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead className="bg-surface-base border-b border-border-subtle text-content-muted uppercase font-bold text-[10px]">
              <tr className="whitespace-nowrap">
                <th className="p-3">Descrição / Fornecedor</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Vencimento</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Valor R$</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/60 text-content-base">
              {filteredAccounts.map((a) => (
                <tr key={a.id} className="hover:bg-surface-base/50 transition-colors">
                  <td className="p-3 font-semibold">
                    {a.description}
                    <span className="text-[10px] text-content-muted block font-sans">{a.supplier}</span>
                  </td>
                  <td className="p-3">
                    <span className="bg-surface-base border border-border-subtle text-content-muted font-bold text-[10px] px-2 py-0.5 rounded-xl capitalize">
                      {a.category}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-content-muted">
                    {new Date(a.dueDate).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="p-3">
                    {a.status === 'paid' && (
                      <span className="bg-status-success/15 text-status-success font-bold text-[10px] px-2 py-0.5 rounded-xl uppercase">
                        Pago
                      </span>
                    )}
                    {a.status === 'pending' && (
                      <span className="bg-gold-base/15 text-gold-base font-bold text-[10px] px-2 py-0.5 rounded-xl uppercase">
                        A Vencer
                      </span>
                    )}
                    {a.status === 'overdue' && (
                      <span className="bg-status-error/15 text-status-error font-bold text-[10px] px-2 py-0.5 rounded-xl uppercase">
                        Vencido
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right font-bold text-content-base tabular-nums">
                    R$ {a.amount.toFixed(2)}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleTogglePaid(a.id)}
                        className={`p-1.5 rounded-lg border transition-all ${
                          a.status === 'paid'
                            ? 'bg-status-success text-surface-base border-status-success'
                            : 'border-border-subtle hover:border-gold-base text-content-muted hover:text-gold-base'
                        }`}
                        title={a.status === 'paid' ? 'Marcar como Pendente' : 'Marcar como Pago'}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="p-1.5 rounded-lg border border-border-subtle hover:border-status-error text-content-muted hover:text-status-error transition-all"
                        title="Excluir Conta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE ACCOUNT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateAccount} className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-sm p-5 text-content-base space-y-4 relative shadow-2xl animate-fade-in" onKeyDown={handleEnterAsTab}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-content-muted hover:text-content-base p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-border-subtle pb-3">
              <div className="w-10 h-10 rounded-xl bg-gold-base/15 text-gold-base flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-content-base">Lançar Conta a Pagar</h3>
                <p className="text-xs text-content-muted">Cadastre despesas e compromissos do estabelecimento.</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-content-muted uppercase block mb-1">Descrição</label>
              <input
                type="text"
                required
                placeholder="Ex: Compra de Lote de Shampoos"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-content-muted uppercase block mb-1">Fornecedor / Beneficiário</label>
              <input
                type="text"
                placeholder="Ex: Barber Beauty Distribuidora"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-content-muted uppercase block mb-1">Valor (R$)</label>
                <input
              type="number"
                  required
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none font-bold text-gold-base"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-content-muted uppercase block mb-1">Vencimento</label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-content-muted uppercase block mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none"
              >
                <option value="fornecedores">Fornecedores</option>
                <option value="aluguel">Aluguel & Imóvel</option>
                <option value="utilidades">Energia / Água / Internet</option>
                <option value="equipamentos">Equipamentos & Ferramentas</option>
                <option value="marketing">Marketing & Anúncios</option>
                <option value="impostos">Impostos & Taxas</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-content-muted hover:text-content-base"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-gold-base hover:bg-gold-hover text-surface-base px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
              >
                Lançar Conta
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
