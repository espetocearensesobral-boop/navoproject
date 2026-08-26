import React, { useState } from 'react';
import { SUBSCRIPTION_PLANS, DEFAULT_USER_SUBSCRIPTION } from '../../data/constants';
import { Crown, Check, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';

export const ClientSubscriptions: React.FC = () => {
  const [userSub, setUserSub] = useState(DEFAULT_USER_SUBSCRIPTION);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan_gold');

  const handlePause = () => {
    setUserSub(prev => ({
      ...prev,
      status: prev.status === 'active' ? 'paused' : 'active'
    }));
  };

  return (
    <div className="client-account-screen space-y-6 pb-6 px-4">
      {/* Active User Subscription Status Card */}
      <div className="bg-gradient-to-br from-surface-card to-surface-base p-5 rounded-2xl border border-gold-base/40 shadow-xl space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold-base/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] text-gold-base uppercase font-bold tracking-widest block">Sua Assinatura Atual</span>
            <h3 className="text-base font-extrabold text-content-base mt-0.5">{userSub.plan_title}</h3>
            <span className="text-xs text-content-muted">R$ {userSub.monthly_price.toFixed(2)} / mês</span>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
            userSub.status === 'active'
              ? 'bg-status-success/20 text-status-success border-status-success/40'
              : 'bg-status-warning/20 text-[#FF8C00] border-[#FF8C00]/40'
          }`}>
            {userSub.status === 'active' ? '● Ativa' : '⏸ Pausada'}
          </span>
        </div>

        {/* Counter Progress */}
        <div className="bg-surface-card/80 p-3.5 rounded-xl border border-border-subtle space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gold-hover font-semibold">Cortes Utilizados no Mês</span>
            <span className="font-bold text-gold-base text-sm">{userSub.cuts_used_this_month} de ILIMITADO</span>
          </div>
          <div className="w-full h-2 bg-surface-card rounded-full overflow-hidden">
            <div className="h-full bg-gold-base text-surface-base w-3/4 rounded-full" />
          </div>
          <div className="flex items-center justify-between text-[10px] text-content-muted pt-1">
            <span>Próxima renovação automática</span>
            <span className="font-bold text-content-base">{userSub.next_billing_date}</span>
          </div>
        </div>

        {/* Manage Action Buttons */}
        <div className="flex items-center space-x-2 pt-1">
          <button
            onClick={handlePause}
            className="flex-1 py-2.5 rounded-xl bg-surface-card hover:bg-neutral-700 text-content-base text-xs font-semibold border border-border-subtle transition-all flex items-center justify-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gold-base" />
            <span>{userSub.status === 'active' ? 'Pausar Assinatura' : 'Reativar Plano'}</span>
          </button>
        </div>
      </div>

      {/* Subscription Plans Catalog */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gold-hover uppercase tracking-wider">
          Planos Disponíveis para Mudança
        </h3>

        <div className="space-y-4">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
                  plan.is_popular
                    ? 'bg-surface-card border-content-base shadow-[0_0_15px_rgba(201,169,110,0.25)]'
                    : 'bg-border-subtle backdrop-blur-[10px] border-border-subtle hover:border-neutral-600'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-2.5 right-4 px-3 py-0.5 rounded-full bg-gold-base text-surface-base font-extrabold text-[10px] uppercase shadow-md">
                    {plan.badge}
                  </span>
                )}

                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-content-base text-sm">{plan.title}</h4>
                    <p className="text-xs text-content-muted mt-0.5">{plan.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-gold-base">R$ {plan.monthly_price.toFixed(2)}</span>
                    <span className="text-[10px] text-content-muted block">/mês</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-border-subtle my-3">
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center space-x-2 text-xs text-content-base">
                      <Check className="w-3.5 h-3.5 text-status-success flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                <button
                  className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                    isSelected
                      ? 'bg-gold-base text-surface-base shadow-md'
                      : 'bg-surface-card text-content-base hover:bg-neutral-700'
                  }`}
                >
                  {plan.id === userSub.plan_id ? 'Plano Atual Ativo' : 'Trocar para Este Plano'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
