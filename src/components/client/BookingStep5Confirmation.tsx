import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { playConfirmationChime } from '../../lib/audio';
import { LottieIcon } from '../ui/LottieIcon';
import { ServiceItem, Professional } from '../../types';
import {
  CheckCircle2,
  CalendarDays,
  PlusCircle,
  Ticket,
  Copy,
  Check
} from 'lucide-react';

interface BookingStep5Props {
  selectedServices: ServiceItem[];
  selectedBarber: Professional | null;
  selectedDate: string;
  selectedTimeSlot: string;
  totalPaid: number;
  bookingCode?: string;
  onResetBooking: () => void;
  onViewAppointments: () => void;
}

export const BookingStep5Confirmation: React.FC<BookingStep5Props> = ({
  bookingCode,
  onResetBooking,
  onViewAppointments
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      playConfirmationChime();
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#C9A96E', '#F2EFE7', '#121212', '#000000']
      });
    } catch (e) {
      console.log('Confetti failed to run', e);
    }
  }, []);

  const handleCopyVoucher = () => {
    if (!bookingCode) return;
    navigator.clipboard.writeText(bookingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  return (
    <div className="space-y-5 text-center pb-8 px-4 max-w-md mx-auto animate-in fade-in duration-300 mt-6">
      {/* Ícone de Confirmação e Texto */}
      <div className="pt-2 flex flex-col items-center justify-center space-y-2">
        <div className="text-status-success flex items-center justify-center">
          <LottieIcon 
            fallbackIcon={<CheckCircle2 className="w-10 h-10 stroke-[2]" />}
            className="w-12 h-12"
            loop={false}
          />
        </div>
        <span className="text-xs font-bold text-status-success uppercase tracking-widest">
          Agendamento Confirmado!
        </span>
      </div>

      {/* VOUCHER / CÓDIGO DE RESERVA CARD */}
      {bookingCode && (
        <div className="bg-gradient-to-br from-gold-base/15 via-gold-base/10 to-gold-base/5 border border-gold-base/40 rounded-2xl p-4 text-center space-y-1.5 shadow-md animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-center gap-1.5 text-gold-base text-[11px] font-bold uppercase tracking-wider">
            <Ticket className="w-3.5 h-3.5" />
            <span>Código do Voucher / Agendamento</span>
          </div>

          <div className="flex items-center justify-center gap-2 pt-0.5">
            <span className="text-2xl font-black text-content-base tracking-widest font-mono select-all">
              {bookingCode}
            </span>
            <span className="sr-only"> </span><button type="button" onClick={handleCopyVoucher} aria-label={copied ? "Código copiado" : "Copiar código"} className="p-2 rounded-xl bg-gold-base/20 hover:bg-gold-base/30 text-gold-base active:scale-95 transition-all flex items-center gap-1 text-xs font-bold" title="Copiar Código">
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-status-success" />
                  <span className="text-status-success text-[10px]" aria-hidden="true">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="text-[10px]" aria-hidden="true">Copiar</span>
                </>
              )}
            </button>
          </div>

          <p className="text-[11px] text-content-muted font-medium pt-1">
            🔑 Guarde este código! Ele será solicitado para consultar seu agendamento como visitante.
          </p>
        </div>
      )}

      {/* Uncontained Notice */}
      <div className="space-y-1.5 py-1 text-center text-xs text-content-muted leading-relaxed max-w-xs mx-auto">
        <p className="font-bold text-content-base">Precisa cancelar ou reagendar?</p>
        <p>Solicite com pelo menos 2 horas de antecedência pelo menu "Meus Agendamentos" ou pelo WhatsApp.</p>
        <p className="text-content-muted font-medium">Agradecemos sua compreensão!</p>
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-2.5 pt-2">
        <button
          type="button"
          onClick={onResetBooking}
          className="flex-1 py-3.5 px-2 rounded-xl bg-surface-card/80 hover:bg-surface-card text-content-base border border-border-subtle text-xs font-bold hover:border-gold-base/50 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
        >
          <PlusCircle className="w-4 h-4 shrink-0 text-content-base" />
          <span className="truncate">Novo</span>
        </button>

        <button
          type="button"
          onClick={onViewAppointments}
          className="flex-[1.6] py-3.5 px-2 rounded-xl bg-gold-base text-surface-base font-black text-xs uppercase tracking-wider hover:opacity-95 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
        >
          <CalendarDays className="w-4 h-4 shrink-0 stroke-[2.5]" />
          <span className="truncate">Meus Agendamentos</span>
        </button>
      </div>
    </div>
  );
};
