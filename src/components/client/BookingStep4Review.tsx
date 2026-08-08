import React, { useState } from 'react';
import { ServiceItem, Professional, UserProfile } from '../../types';
import {
  Award,
  ArrowLeft,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  FileText,
  Phone,
  Loader2,
  X
} from 'lucide-react';

interface BookingStep4ReviewProps {
  selectedServices: ServiceItem[];
  selectedBarber: Professional | null;
  selectedDate: string;
  selectedTimeSlot: string;
  userProfile: UserProfile;
  isGuest?: boolean;
  isSubmitting?: boolean;
  onConfirmReview: (reviewDetails: { loyaltyDiscount: number; couponDiscount: number; clientName: string; clientPhone: string }) => void;
  onCancel: () => void;
}

export const BookingStep4Review: React.FC<BookingStep4ReviewProps> = ({
  selectedServices,
  selectedBarber,
  selectedDate,
  selectedTimeSlot,
  userProfile,
  isGuest = true,
  isSubmitting = false,
  onConfirmReview,
  onCancel
}) => {
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [clientName, setClientName] = useState<string>(
    userProfile?.name && userProfile.name !== 'Visitante' ? userProfile.name : ''
  );
  const [clientPhone, setClientPhone] = useState<string>(userProfile?.phone || '');

  const [clientNameError, setClientNameError] = useState('');
  const [clientPhoneError, setClientPhoneError] = useState('');
  const [isEditingData, setIsEditingData] = useState<boolean>(() => !clientName || !clientPhone || isGuest);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientName(e.target.value.toUpperCase());
    setClientNameError('');
  };

  const handleNameBlur = () => {
    if (!clientName.trim()) {
      setClientNameError('O nome completo é obrigatório');
    } else if (clientName.trim().length < 3) {
      setClientNameError('Digite um nome válido');
    } else {
      setClientNameError('');
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setClientPhone(formatted);
    const digits = formatted.replace(/\D/g, '');
    if (digits.length > 0 && digits.length < 10) {
      setClientPhoneError('Digite DDD e o número completo (10 ou 11 dígitos)');
    } else {
      setClientPhoneError('');
    }
  };

  const handlePhoneBlur = () => {
    const digits = clientPhone.replace(/\D/g, '');
    if (!clientPhone.trim()) {
      setClientPhoneError('O telefone é obrigatório');
    } else if (digits.length < 10) {
      setClientPhoneError('Telefone inválido. Digite DDD + número (10 ou 11 dígitos)');
    } else {
      setClientPhoneError('');
    }
  };

  const subtotal = selectedServices.reduce((acc, curr) => acc + curr.price, 0);
  const loyaltyDiscount = 0.00;
  const couponDiscount = 0.00;
  const totalDiscount = loyaltyDiscount + couponDiscount;
  const finalTotal = Math.max(0, subtotal - totalDiscount);

  const dateObj = new Date(`${selectedDate}T12:00:00`);
  const formattedDate = dateObj.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });

  const handleNext = () => {
    let hasError = false;
    if (!clientName.trim()) {
      setClientNameError('O nome completo é obrigatório');
      hasError = true;
    } else if (clientName.trim().length < 3) {
      setClientNameError('Digite um nome válido');
      hasError = true;
    }
    
    const phoneDigits = clientPhone.replace(/\D/g, '');
    if (!clientPhone.trim()) {
      setClientPhoneError('O telefone é obrigatório');
      hasError = true;
    } else if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setClientPhoneError('Telefone inválido. Digite DDD + número (10 ou 11 dígitos)');
      hasError = true;
    }

    if (hasError) {
      if (!clientName.trim() || clientName.trim().length < 3) {
        document.getElementById('name-input')?.focus();
      } else {
        document.getElementById('phone-input')?.focus();
      }
      return;
    }

    onConfirmReview({
      loyaltyDiscount,
      couponDiscount: 0,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim()
    });
  };
  return (
    <div className="space-y-4 pb-6 px-4 mt-6 relative">
      {/* Submitting Loading Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 z-[150] bg-surface-base/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-2xl bg-gold-base/15 border border-gold-base/30 text-gold-base flex items-center justify-center shadow-xl shadow-gold-base/10 animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-content-base">Confirmando seu agendamento...</h3>
            <p className="text-xs text-content-muted max-w-xs mx-auto leading-relaxed">
              Aguarde alguns instantes enquanto enviamos e gravamos as informações.
            </p>
          </div>
        </div>
      )}
      {/* Summary Box */}
      <div className="bg-border-subtle backdrop-blur-[10px] rounded-xl border border-border-subtle overflow-hidden">
        <div className="w-full p-3.5 flex items-center justify-between bg-border-subtle border-b border-border-subtle">
          <div className="flex flex-col text-left">
            <span className="text-sm font-bold text-content-base">Resumo do Agendamento</span>
            <span className="text-xs text-content-muted">
              {selectedServices.length} serviço{selectedServices.length > 1 ? 's' : ''} • <strong className="text-gold-base font-extrabold">R$ {finalTotal.toFixed(2)}</strong>
            </span>
          </div>
        </div>

        <div className="p-3.5 space-y-4">
          {/* Barber and Date info */}
          <div className="flex flex-col space-y-2.5 pb-3 border-b border-border-subtle">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-content-muted font-medium">Profissional</span>
              <span className="font-extrabold text-content-base flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-gold-base" />
                <span className="text-gold-base">{selectedBarber?.name || 'Livre'}</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-content-muted font-medium">Data e Hora</span>
              <div className="flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-gold-base" />
                <span className="capitalize font-bold text-content-base">{formattedDate}</span>
                <span className="text-content-muted">•</span>
                <Clock className="w-3.5 h-3.5 text-gold-base" />
                <span className="font-black text-sm text-gold-base">{selectedTimeSlot}</span>
              </div>
            </div>
          </div>

          {/* Services List */}
          <div className="space-y-2 pb-3 border-b border-border-subtle">
            <span className="text-xs font-bold text-content-muted uppercase tracking-wider block mb-2">Serviços</span>
            {selectedServices.map((srv) => (
              <div key={srv.id} className="flex items-center justify-between text-xs sm:text-sm py-0.5">
                <span className="text-content-base font-medium">• {srv.title}</span>
                <span className="text-content-base font-bold">R$ {srv.price.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between text-content-muted">
              <span>Subtotal</span>
              <span className="font-semibold text-content-base">R$ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm sm:text-base font-serif text-content-base font-semibold pt-2 border-t border-border-subtle">
              <span>Total</span>
              <span className="text-base sm:text-lg font-black text-gold-base">R$ {finalTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Client Details */}
      <div className="bg-border-subtle backdrop-blur-[10px] p-3.5 rounded-xl border border-border-subtle space-y-3">
        <h3 className="text-sm font-bold text-content-base mb-1.5 flex items-center justify-between">
          <span>Seus Dados</span>
          {!isEditingData ? (
            <button 
              type="button" 
              onClick={() => setIsEditingData(true)}
              className="text-xs text-gold-base hover:text-gold-hover"
            >
              Editar
            </button>
          ) : (
            <span className="text-[11px] font-normal text-content-muted">Obrigatório para agendamento</span>
          )}
        </h3>

        {!isEditingData ? (
          <div className="flex flex-col space-y-1 text-sm text-content-base bg-surface-base/50 p-3 rounded-lg border border-border-subtle/50">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-content-muted" />
              <span>{clientName}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4 text-content-muted" />
              <span>{clientPhone}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="space-y-1">
              <div className="relative">
                <User className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="name-input"
                  type="text"
                  inputMode="text"
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  value={clientName}
                  onChange={handleNameChange}
                  onBlur={handleNameBlur}
                  onFocus={(e) => {
                    setTimeout(() => {
                      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 150);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                       e.preventDefault();
                      document.getElementById('phone-input')?.focus();
                    }
                  }}
                  placeholder="SEU NOME COMPLETO"
                  className={`w-full bg-border-subtle backdrop-blur-[10px] text-content-base text-xs sm:text-sm pl-9 pr-3 py-2.5 rounded-lg border focus:outline-none transition-colors ${
                    clientNameError ? 'border-red-500 focus:border-red-500' : 'border-border-subtle focus:border-gold-base'
                  }`}
                />
              </div>
              {clientNameError && (
                <span className="text-xs text-red-400 pl-1">{clientNameError}</span>
              )}
            </div>
            <div className="space-y-1">
              <div className="relative">
                <Phone className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="phone-input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  enterKeyHint="done"
                  value={clientPhone}
                  onChange={handlePhoneChange}
                  onBlur={handlePhoneBlur}
                  onFocus={(e) => {
                    setTimeout(() => {
                      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 150);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      (e.target as HTMLElement).blur();
                      document.getElementById('confirm-booking-btn')?.focus();
                    }
                  }}
                  placeholder="(11) 99999-9999"
                  className={`w-full bg-border-subtle backdrop-blur-[10px] text-content-base text-xs sm:text-sm pl-9 pr-3 py-2.5 rounded-lg border focus:outline-none transition-colors ${
                    clientPhoneError ? 'border-red-500 focus:border-red-500' : 'border-border-subtle focus:border-gold-base'
                  }`}
                />
              </div>
              {clientPhoneError && (
                <span className="text-xs text-red-400 pl-1">{clientPhoneError}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Privacy Notice */}
      <div className="mt-4 text-center px-4 mb-20">
        <p className="text-[11px] text-content-muted leading-relaxed">
          Ao confirmar, seu agendamento será processado de acordo com a nossa{' '}
          <a href="#" onClick={(e) => e.preventDefault()} className="text-gold-base underline hover:text-gold-hover">
            Política de Privacidade
          </a>{' '}
          e os Termos de Uso do sistema.
        </p>
      </div>

      {/* Floating Bottom Tray */}
      <div className="sticky bottom-3 left-0 right-0 px-5 z-40 flex justify-center pointer-events-none animate-fade-in my-3">
        <div className="pointer-events-auto w-full max-w-[400px] bg-surface-base/90 backdrop-blur-xl border border-border-subtle p-3.5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center justify-between space-x-3">
          {showCancelConfirm ? (
            <div className="flex-1 flex flex-col items-center animate-fade-in">
              <span className="text-[11px] font-bold text-content-base mb-2 uppercase tracking-wider">Cancelar agendamento?</span>
              <div className="flex items-center space-x-2 w-full">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-2.5 rounded-full bg-border-subtle hover:bg-content-muted/30 text-content-base font-bold text-[11px] transition-all"
                >
                  Não
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 py-2.5 rounded-full bg-border-subtle hover:bg-surface-card border border-border-subtle text-content-base font-bold text-[11px] transition-all active:scale-95"
                >
                  Sim, cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                disabled={isSubmitting}
                className="flex-1 px-5 py-3 rounded-full bg-border-subtle hover:bg-surface-card border border-border-subtle text-content-base flex items-center justify-center space-x-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-surface-card active:scale-95"
                title="Cancelar"
              >
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  Cancelar
                </span>
                <X className="w-4 h-4" />
              </button>

              <button
                id="confirm-booking-btn"
                type="button"
                onClick={handleNext}
                disabled={isSubmitting}
                className={`flex-1 px-5 py-3 rounded-full bg-gold-base text-surface-base hover:opacity-95 flex items-center justify-center space-x-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-gold-base focus:ring-offset-2 focus:ring-offset-surface-card ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed scale-95' : 'active:scale-95'
                }`}
                title="Confirmar Agendamento"
              >
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  {isSubmitting ? '...' : 'Confirmar'}
                </span>
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

