import React from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  ShieldAlert, 
  ArrowUpRight, 
  DollarSign, 
  PieChart, 
  Activity, 
  Zap 
} from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';

export const FinancialHealthManagement: React.FC = () => {
  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={Activity}
        title="Saúde Financeira & Diagnóstico"
        stats={[{ label: 'score', value: '88/100', tone: 'success' }]}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Margem</span>
            <div className="w-6 h-6 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-status-success tabular-nums">34.2%</p>
          <p className="text-[9px] text-status-success mt-1 font-medium truncate flex items-center gap-0.5">
            <ArrowUpRight className="w-2.5 h-2.5 shrink-0" /> +2.8% vs mês anterior
          </p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Break-Even</span>
            <div className="w-6 h-6 rounded-lg bg-gold-base/10 text-gold-base flex items-center justify-center shrink-0">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black finance-positive tabular-nums truncate">R$ 8.450</p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">Atingido dia 12</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Projeção 30 Dias</span>
            <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <PieChart className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black finance-positive tabular-nums truncate">R$ 18.290</p>
          <p className="text-[9px] text-status-success mt-1 font-medium truncate">Reserva segura</p>
        </div>
      </div>

      {/* AI Smart Financial Insights / Alerts */}
      <div className="bg-surface-card border border-gold-base/50 rounded-2xl p-5 shadow-sm bg-gold-base/5 space-y-4">
        <h3 className="text-sm font-bold text-content-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold-base" />
          <span>Alertas & Recomendações Estratégicas</span>
        </h3>

        <div className="space-y-3 text-xs">
          <div className="bg-surface-card border border-border-subtle p-3.5 rounded-xl flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-status-success/15 text-status-success flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-content-base">Crescimento do Clube de Assinaturas</h4>
              <p className="text-content-muted mt-0.5 leading-relaxed">
                Sua receita recorrente (MRR) cobre 42% dos seus custos fixos mensais. Aumentar o clube em mais 15 membros garantirá a cobertura de 50% dos custos fixos.
              </p>
            </div>
          </div>

          <div className="bg-surface-card border border-border-subtle p-3.5 rounded-xl flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold-base/15 text-gold-base flex items-center justify-center shrink-0 mt-0.5">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-content-base">Otimização do Ticket Médio via Combos</h4>
              <p className="text-content-muted mt-0.5 leading-relaxed">
                O serviço "Corte + Barba + Pigmentação" possui a maior margem de contribuição (62%). Oferecer este combo no checkout de agendamento pode aumentar seu faturamento em até 12%.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
