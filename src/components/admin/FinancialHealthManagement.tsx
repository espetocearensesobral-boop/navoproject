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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface-card border border-border-subtle rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-content-muted block">Margem de Lucro Operacional</span>
          <span className="text-2xl font-bold text-status-success mt-1 block tabular-nums">
            34.2%
          </span>
          <span className="text-[10px] text-status-success font-semibold mt-1 block flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            +2.8% em relação ao mês anterior
          </span>
        </div>

        <div className="bg-surface-card border border-border-subtle rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-content-muted block">Ponto de Equilíbrio (Break-Even)</span>
          <span className="text-2xl font-bold text-gold-base mt-1 block tabular-nums">
            R$ 8.450,00
          </span>
          <span className="text-[10px] text-content-muted font-semibold mt-1 block">
            Atingido no dia 12 de cada mês
          </span>
        </div>

        <div className="bg-surface-card border border-border-subtle rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-content-muted block">Projeção de Caixa a 30 Dias</span>
          <span className="text-2xl font-bold text-content-base mt-1 block tabular-nums">
            R$ 18.290,00
          </span>
          <span className="text-[10px] text-status-success font-semibold mt-1 block">
            Fundo de reserva seguro
          </span>
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
