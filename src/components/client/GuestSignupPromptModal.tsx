import React from 'react';
import { UserPlus, X, Gift, History, Zap, MessageSquare, Sparkles, CheckCircle2 } from 'lucide-react';

interface GuestSignupPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  onDecline: () => void;
}

export const GuestSignupPromptModal: React.FC<GuestSignupPromptModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  onDecline
}) => {
  if (!isOpen) return null;

  const benefits = [
    {
      icon: Gift,
      title: 'Programa de Fidelidade Exclusivo',
      desc: 'Acumule pontos em cada corte e troque por serviços e descontos VIP.'
    },
    {
      icon: History,
      title: 'Histórico de Atendimentos',
      desc: 'Acesse seus agendamentos passados, barbeiros favoritos e recibos.'
    },
    {
      icon: Zap,
      title: 'Agendamento em 1-Clique',
      desc: 'Seus dados ficam pré-preenchidos para agendar em segundos.'
    },
    {
      icon: MessageSquare,
      title: 'Lembretes pelo WhatsApp',
      desc: 'Receba confirmações e lembretes para nunca perder a hora.'
    }
  ];

  return (
    <div 
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-surface-base/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-modal-title"
    >
      <div className="bg-surface-card w-full max-w-md rounded-3xl border border-border-subtle shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-amber-500/10 via-gold-base/20 to-amber-500/10 p-6 text-center border-b border-border-subtle relative">
          <button 
            onClick={onClose}
            aria-label="Fechar modal de cadastro"
            className="absolute top-4 right-4 p-2 rounded-full bg-border-subtle hover:bg-surface-card text-content-muted hover:text-content-base transition-colors focus:outline-none focus:ring-2 focus:ring-gold-base"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 rounded-2xl bg-gold-base text-surface-base mx-auto flex items-center justify-center shadow-xl shadow-[#C9A96E]/20 mb-3">
            <Sparkles className="w-7 h-7 text-surface-base" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-base/10 border border-gold-base/30 text-gold-base text-[10px] font-extrabold uppercase tracking-widest mb-1">
            <UserPlus className="w-3 h-3" />
            <span>Benefícios VIP NavoClub</span>
          </div>
          
          <h3 id="guest-modal-title" className="text-xl font-serif text-content-base font-semibold">Crie sua Conta Grátis</h3>
          <p className="text-xs text-content-muted mt-1 max-w-xs mx-auto">
            Aproveite a experiência completa e ganhe vantagens exclusivas em todas as suas visitas.
          </p>
        </div>

        {/* Benefits List */}
        <div className="p-5 space-y-3.5 max-h-[50vh] overflow-y-auto custom-scrollbar">
          {benefits.map((b, idx) => {
            const Icon = b.icon;
            return (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-2xl bg-border-subtle border border-border-subtle/50 hover:border-gold-base/30 transition-all">
                <div className="w-9 h-9 rounded-xl bg-gold-base/10 text-gold-base flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-extrabold text-content-base flex items-center gap-1.5">
                    {b.title}
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  </h4>
                  <p className="text-[11px] text-content-muted leading-tight mt-0.5">
                    {b.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="p-4 bg-surface-base border-t border-border-subtle flex flex-col gap-2.5">
          <button
            onClick={onAccept}
            className="w-full py-3.5 rounded-2xl bg-gold-base text-surface-base text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-[#C9A96E]/20 active:scale-98 transition-all hover:opacity-95 flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4 text-surface-base" />
            <span>Criar Minha Conta Grátis</span>
          </button>
          
          <button
            onClick={onDecline}
            className="w-full py-2.5 text-center text-content-muted hover:text-content-base text-xs font-bold transition-colors"
          >
            Continuar sem conta por enquanto
          </button>
        </div>
      </div>
    </div>
  );
};
