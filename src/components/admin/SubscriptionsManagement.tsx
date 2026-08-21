import React, { useState } from 'react';
import { handleEnterAsTab } from '../../utils/formUtils';
import { 
  Award, 
  Plus, 
  Users, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Sparkles, 
  Scissors, 
  RefreshCw, 
  TrendingUp, 
  ChevronRight, 
  UserCheck, 
  X,
  CreditCard
} from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { AdminTabs } from './shared/AdminTabs';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  includedServices: string[];
  productDiscountPct: number;
  barberPerCutFee: number; // Repasse fixo ao barbeiro por atendimento
  activeSubscribersCount: number;
  popular?: boolean;
}

export interface SubscriberMember {
  id: string;
  clientName: string;
  clientPhone: string;
  planName: string;
  planId: string;
  status: 'active' | 'past_due' | 'canceled';
  joinedDate: string;
  nextBillingDate: string;
  cutsUsedThisMonth: number;
  monthlyLimit: number | 'unlimited';
}

export const SubscriptionsManagement: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(() => {
    const saved = localStorage.getItem('navo_sub_plans_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [
      {
        id: 'plan_barba',
        name: 'Clube Barba VIP',
        price: 89.90,
        billingCycle: 'monthly',
        includedServices: ['Barba Imperial', 'Toalha Quente', 'Acabamento'],
        productDiscountPct: 10,
        barberPerCutFee: 20.00,
        activeSubscribersCount: 28,
        popular: false
      },
      {
        id: 'plan_gold',
        name: 'Clube Cabelo & Barba Gold',
        price: 159.90,
        billingCycle: 'monthly',
        includedServices: ['Cortes Ilimitados', 'Barba Ilimitada', 'Bebida Cortesia'],
        productDiscountPct: 15,
        barberPerCutFee: 25.00,
        activeSubscribersCount: 64,
        popular: true
      },
      {
        id: 'plan_executive',
        name: 'Clube Executive Club',
        price: 249.90,
        billingCycle: 'monthly',
        includedServices: ['Corte + Barba Ilimitados', 'Selagem / Pigmentação', '15% Desc. em Produtos', 'Atendimento Preferencial'],
        productDiscountPct: 20,
        barberPerCutFee: 35.00,
        activeSubscribersCount: 19,
        popular: false
      }
    ];
  });

  const [members, setMembers] = useState<SubscriberMember[]>(() => {
    const saved = localStorage.getItem('navo_sub_members_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [
      {
        id: 'mem_1',
        clientName: 'Fernando Henrique',
        clientPhone: '(11) 98877-6655',
        planName: 'Clube Cabelo & Barba Gold',
        planId: 'plan_gold',
        status: 'active',
        joinedDate: '2026-01-15',
        nextBillingDate: '2026-08-15',
        cutsUsedThisMonth: 3,
        monthlyLimit: 'unlimited'
      },
      {
        id: 'mem_2',
        clientName: 'Lucas Mendes',
        clientPhone: '(11) 97766-5544',
        planName: 'Clube Barba VIP',
        planId: 'plan_barba',
        status: 'active',
        joinedDate: '2026-03-01',
        nextBillingDate: '2026-09-01',
        cutsUsedThisMonth: 2,
        monthlyLimit: 'unlimited'
      },
      {
        id: 'mem_3',
        clientName: 'Roberto Alves',
        clientPhone: '(11) 96655-4433',
        planName: 'Clube Executive Club',
        planId: 'plan_executive',
        status: 'active',
        joinedDate: '2025-11-10',
        nextBillingDate: '2026-08-10',
        cutsUsedThisMonth: 4,
        monthlyLimit: 'unlimited'
      }
    ];
  });

  // Active Tab
  const [activeTab, setActiveTab] = useState<'members' | 'plans' | 'commissions'>('members');
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  // New Plan Form State
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState<number>(129.90);
  const [newPlanServices, setNewPlanServices] = useState('Corte, Barba');
  const [newPlanBarberFee, setNewPlanBarberFee] = useState<number>(20);

  const totalMRR = plans.reduce((acc, p) => acc + (p.price * p.activeSubscribersCount), 0);
  const totalActiveSubscribers = members.filter(m => m.status === 'active').length;

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim()) return;

    const newP: SubscriptionPlan = {
      id: `plan_${Date.now()}`,
      name: newPlanName.trim(),
      price: Number(newPlanPrice),
      billingCycle: 'monthly',
      includedServices: newPlanServices.split(',').map(s => s.trim()).filter(Boolean),
      productDiscountPct: 10,
      barberPerCutFee: Number(newPlanBarberFee),
      activeSubscribersCount: 0
    };

    setPlans([...plans, newP]);
    setNewPlanName('');
    setIsPlanModalOpen(false);
  };

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={Award}
        title="Assinaturas"
        stats={[{ label: 'assinantes', value: totalActiveSubscribers, tone: 'gold' }]}
        action={{ label: 'Novo plano', onClick: () => setIsPlanModalOpen(true), icon: Plus }}
      />

      {/* Ação (mobile) */}
      <button
        onClick={() => setIsPlanModalOpen(true)}
        className="md:hidden w-full bg-gold-base hover:bg-gold-hover text-content-on-accent px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all shrink-0"
      >
        <Plus className="w-4 h-4 stroke-[2.5]" />
        <span>Novo plano</span>
      </button>

      {/* MRR Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-xs font-bold uppercase tracking-wider truncate">MRR</span>
            <div className="w-6 h-6 rounded-lg bg-gold-base/10 text-gold-base flex items-center justify-center shrink-0">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black finance-positive tabular-nums truncate">R$ {totalMRR.toFixed(2)}</p>
          <p className="text-xs text-status-success mt-1 font-medium truncate">Garantido todo mês</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-xs font-bold uppercase tracking-wider truncate">Membros Ativos</span>
            <div className="w-6 h-6 rounded-lg bg-surface-base border border-border-subtle flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 text-gold-base" />
            </div>
          </div>
          <p className="text-lg font-black text-content-base tabular-nums">{totalActiveSubscribers}</p>
          <p className="text-xs text-content-muted mt-1 font-medium truncate">Ticket: <span className="finance-positive">R$ {totalActiveSubscribers > 0 ? (totalMRR / totalActiveSubscribers).toFixed(0) : '0'}</span></p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-xs font-bold uppercase tracking-wider truncate">Atend. do Clube</span>
            <div className="w-6 h-6 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center shrink-0">
              <Scissors className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-status-success tabular-nums">{members.reduce((acc, m) => acc + m.cutsUsedThisMonth, 0)}</p>
          <p className="text-xs text-content-muted mt-1 font-medium truncate">Repasses aos barbeiros</p>
        </div>
      </div>

      {/* Tabs */}
      <AdminTabs
        tabs={[
          { id: 'members', label: 'Ativos', icon: UserCheck },
          { id: 'plans', label: 'Planos', icon: Award },
          { id: 'commissions', label: 'Comissões', icon: DollarSign },
        ]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as typeof activeTab)}
      />

      {/* TAB 1: MEMBERS */}
      {activeTab === 'members' && (
        <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-xs">
          <div className="hidden md:block overflow-x-auto admin-table-wrap">
            <table className="w-full text-left text-xs min-w-[680px]">
              <thead className="bg-surface-base border-b border-border-subtle text-content-muted uppercase font-bold text-xs">
                <tr className="whitespace-nowrap">
                  <th className="p-3">Assinante</th>
                  <th className="p-3">Plano Contratado</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Próxima Cobrança</th>
                  <th className="p-3 text-center">Usos no Mês</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/60 text-content-base">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-base/50 transition-colors">
                    <td className="p-3 font-semibold">
                      {m.clientName}
                      <span className="text-xs text-content-muted font-mono block">{m.clientPhone}</span>
                    </td>
                    <td className="p-3 font-bold text-gold-base">{m.planName}</td>
                    <td className="p-3">
                      <span className="bg-status-success/15 text-status-success font-bold text-xs px-2 py-0.5 rounded-xl uppercase">
                        {m.status === 'active' ? 'Ativo' : 'Pendente'}
                      </span>
                    </td>
                    <td className="p-3 text-content-muted font-mono">
                      {new Date(m.nextBillingDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-3 text-center font-bold">
                      <span className="bg-gold-base/15 text-gold-base px-2 py-0.5 rounded-xl">
                        {m.cutsUsedThisMonth} cortes
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-border-subtle">
            {members.map((m) => (
              <article key={m.id} className="p-4 space-y-3 bg-surface-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-content-base truncate">{m.clientName}</p>
                    <p className="mt-0.5 text-xs text-content-muted font-mono truncate">{m.clientPhone}</p>
                  </div>
                  <span className="shrink-0 bg-status-success/15 text-status-success font-bold text-[11px] px-2 py-1 rounded-full uppercase">
                    {m.status === 'active' ? 'Ativo' : 'Pendente'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="block text-[10px] uppercase tracking-wider text-content-muted">Plano</span><strong className="block mt-0.5 text-content-base truncate">{m.planName}</strong></div>
                  <div><span className="block text-[10px] uppercase tracking-wider text-content-muted">Próxima cobrança</span><strong className="block mt-0.5 text-content-base font-mono">{new Date(m.nextBillingDate).toLocaleDateString('pt-BR')}</strong></div>
                </div>
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-border-subtle">
                  <span className="text-xs text-content-muted">Usos no mês</span>
                  <strong className="text-sm text-content-base">{m.cutsUsedThisMonth} cortes</strong>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: PLANS */}
      {activeTab === 'plans' && (
        <div className="admin-card-grid admin-card-grid--3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-surface-card border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 relative ${
                plan.popular ? 'border-gold-base shadow-md' : 'border-border-subtle'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 right-4 bg-gold-base text-content-on-accent text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full shadow-xs">
                  Mais Vendido
                </span>
              )}

              <div>
                <h3 className="text-base font-bold text-content-base">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-bold finance-positive tabular-nums">R$ {plan.price.toFixed(2)}</span>
                  <span className="text-xs text-content-muted">/mês</span>
                </div>

                <div className="mt-4 pt-3 border-t border-border-subtle/80 space-y-2 text-xs">
                  <span className="text-xs font-bold uppercase text-content-muted block">Incluso no Plano:</span>
                  {plan.includedServices.map((svc, i) => (
                    <div key={i} className="flex items-center gap-2 text-content-base">
                      <CheckCircle2 className="w-3.5 h-3.5 text-gold-base shrink-0" />
                      <span>{svc}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-content-base font-semibold pt-1">
                    <Sparkles className="w-3.5 h-3.5 text-gold-base shrink-0" />
                    <span>{plan.productDiscountPct}% de desc. em produtos</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border-subtle/80 flex justify-between items-center text-xs">
                <span className="text-content-muted font-bold">Repasse ao Barbeiro:</span>
                <span className="font-bold finance-negative tabular-nums">R$ {plan.barberPerCutFee.toFixed(2)} / corte</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: COMMISSIONS */}
      {activeTab === 'commissions' && (
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 space-y-3 shadow-xs">
          <h3 className="text-sm font-bold text-content-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gold-base" />
            <span>Regras de comissão</span>
          </h3>
          <p className="text-xs text-content-muted leading-relaxed">
            Assinantes não geram cobrança individual. O barbeiro recebe um valor fixo por corte.
          </p>

          <div className="space-y-2 pt-2">
            {plans.map((p) => (
              <div key={p.id} className="flex justify-between items-center bg-surface-base p-3 rounded-xl border border-border-subtle text-xs">
                <div>
                  <span className="font-bold text-content-base block">{p.name}</span>
                  <span className="text-xs text-content-muted">Mensalidade: <span className="finance-positive">R$ {p.price.toFixed(2)}</span></span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-content-muted uppercase font-bold block">Repasse por corte</span>
                  <span className="font-bold finance-negative text-sm tabular-nums">R$ {p.barberPerCutFee.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE PLAN MODAL */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onKeyDown={handleEnterAsTab} onSubmit={handleCreatePlan} className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-md p-5 text-content-base space-y-4 relative shadow-2xl animate-fade-in">
            <button
              type="button"
              onClick={() => setIsPlanModalOpen(false)}
              className="absolute top-4 right-4 text-content-muted hover:text-content-base p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-border-subtle pb-3">
              <div className="w-10 h-10 rounded-xl bg-gold-base/15 text-gold-base flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-content-base">Novo plano</h3>
                <p className="text-xs text-content-muted">Nome, mensalidade e comissão.</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-content-muted uppercase block mb-1">Nome do Plano</label>
              <input
                type="text"
                required
                placeholder="Ex: Clube Cabelo Ilimitado"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-content-muted uppercase block mb-1">Mensalidade (R$)</label>
                <input
                  type="number"
                  required
                  min="10"
                  step="5"
                  value={newPlanPrice}
                  onChange={(e) => setNewPlanPrice(Number(e.target.value))}
                  className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-content-muted uppercase block mb-1">Repasse Barbeiro (R$)</label>
                <input
                  type="number"
                  required
                  min="5"
                  step="1"
                  value={newPlanBarberFee}
                  onChange={(e) => setNewPlanBarberFee(Number(e.target.value))}
                  className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-content-muted uppercase block mb-1">Serviços inclusos</label>
              <input
                type="text"
                value={newPlanServices}
                onChange={(e) => setNewPlanServices(e.target.value)}
                className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPlanModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-content-muted hover:text-content-base"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-gold-base hover:bg-gold-hover text-content-on-accent px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
              >
                Criar Plano
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
