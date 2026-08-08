import React, { useState } from 'react';
import { X, CreditCard, Store, Loader2 } from 'lucide-react';

interface PaymentChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPayNow: () => void;
  onPayLater: () => void;
}

export const PaymentChoiceModal: React.FC<PaymentChoiceModalProps> = ({
  isOpen,
  onClose,
  onPayNow,
  onPayLater
}) => {
  const [loadingChoice, setLoadingChoice] = useState<'now' | 'later' | null>(null);

  if (!isOpen) return null;

  const handlePayNowClick = () => {
    setLoadingChoice('now');
    setTimeout(() => {
      onPayNow();
      setLoadingChoice(null);
    }, 150);
  };

  const handlePayLaterClick = () => {
    setLoadingChoice('later');
    setTimeout(() => {
      onPayLater();
      setLoadingChoice(null);
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-base/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full sm:w-[360px] bg-surface-card rounded-3xl border border-border-subtle shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-5 border-b border-border-subtle flex items-center justify-between">
          <h2 className="text-lg font-serif text-content-base font-semibold">Forma de Pagamento</h2>
          <button 
            onClick={onClose}
            disabled={loadingChoice !== null}
            className="p-1.5 rounded-full bg-border-subtle backdrop-blur-[10px] text-content-muted hover:text-content-base transition-colors disabled:opacity-50"
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-content-muted text-center font-medium">
            Deseja fazer o pagamento antecipado agora ou prefere pagar diretamente na barbearia?
          </p>

          <div className="space-y-3 mt-4">
            <button
              onClick={handlePayNowClick}
              disabled={loadingChoice !== null}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-content-base bg-border-subtle backdrop-blur-[10px] hover:bg-surface-card transition-all group active:scale-98 disabled:opacity-60"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gold-base text-surface-base flex items-center justify-center">
                  {loadingChoice === 'now' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CreditCard className="w-5 h-5" />
                  )}
                </div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-content-base">
                    {loadingChoice === 'now' ? 'Processando...' : 'Pagar Agora'}
                  </span>
                  <span className="block text-[10px] text-content-base">Cartão, PIX, Assinatura</span>
                </div>
              </div>
              <span className="text-content-base opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </button>

            <button
              onClick={handlePayLaterClick}
              disabled={loadingChoice !== null}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-border-subtle backdrop-blur-[10px] hover:bg-surface-card transition-all group active:scale-98 disabled:opacity-60"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-surface-card flex items-center justify-center text-content-base border border-border-subtle">
                  {loadingChoice === 'later' ? (
                    <Loader2 className="w-5 h-5 animate-spin text-gold-base" />
                  ) : (
                    <Store className="w-5 h-5" />
                  )}
                </div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-content-base">
                    {loadingChoice === 'later' ? 'Confirmando no local...' : 'Pagar na Barbearia'}
                  </span>
                  <span className="block text-[10px] text-content-muted">Pula direto para confirmação</span>
                </div>
              </div>
              <span className="text-content-muted opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
