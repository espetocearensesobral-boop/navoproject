import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Professional, ServiceItem } from '../../types';
import { Calendar as CalendarIcon, Clock, ArrowLeft, ArrowRight, Loader2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { authFetch } from '../../lib/api';
import { 
  ShopProfile, 
  defaultShopProfile, 
  fetchShopProfile, 
  generateTimeSlotsFromProfile, 
  isDateOpenInProfile 
} from '../../services/shopProfileService';
import { 
  getTodayStringBRT, 
  getCurrentTimeBRT, 
  formatDateBR, 
  calculateTotalServicesDuration,
  timeToMinutes
} from '../../utils/dateUtils';

// Deriva ano/mês "de hoje" a partir da string BRT (não de `new Date()` local),
// pra não desalinhar a navegação do calendário quando o dispositivo do cliente
// está em outro fuso horário.
function getTodayYearMonthBRT(todayStr: string): { year: number; month: number } {
  const [y, m] = todayStr.split('-').map(Number);
  return { year: y, month: m - 1 };
}

interface BookingStep3Props {
  selectedServices: ServiceItem[];
  selectedBarber: Professional | null;
  selectedDate: string; // YYYY-MM-DD
  selectedTimeSlot: string; // HH:mm
  onSelectDate: (date: string) => void;
  onSelectTimeSlot: (time: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export const BookingStep3DateTime: React.FC<BookingStep3Props> = ({
  selectedServices,
  selectedBarber,
  selectedDate,
  selectedTimeSlot,
  onSelectDate,
  onSelectTimeSlot,
  onBack,
  onNext
}) => {
  const [busySlots, setBusySlots] = useState<string[]>([]);
  const [requiresApprovalSlots, setRequiresApprovalSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [shopProfile, setShopProfile] = useState<ShopProfile>(defaultShopProfile);

  const totalDurationMinutes = useMemo(() => {
    return calculateTotalServicesDuration(selectedServices);
  }, [selectedServices]);

  useEffect(() => {
    fetchShopProfile().then(p => {
      if (p) setShopProfile(p);
    });
  }, []);

  const timeSectionRef = useRef<HTMLDivElement>(null);

  // Set default date to today in BRT if empty or in the past
  const todayStr = useMemo(() => {
    return getTodayStringBRT();
  }, []);

  // Calendar Modal State — inicializado a partir do "hoje" em BRT, não de new Date()
  // local, pra não desalinhar com todayStr se o dispositivo estiver em outro fuso.
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const { year, month } = getTodayYearMonthBRT(todayStr);
    return new Date(year, month, 1);
  });

  useEffect(() => {
    if (!selectedDate || selectedDate < todayStr) {
      onSelectDate(todayStr);
    }
  }, [selectedDate, onSelectDate, todayStr]);

  // Fetch availability considering duration and outside hours approval
  useEffect(() => {
    let isMounted = true;
    
    const fetchAvailability = async () => {
      if (!selectedDate) return;
      setIsLoadingSlots(true);
      try {
        const profId = selectedBarber?.id || 'prof_any';
        const response = await authFetch(`/api/availability?professionalId=${profId}&date=${selectedDate}&duration=${totalDurationMinutes}`);
        if (response.ok) {
          const resData = await response.json();
          if (Array.isArray(resData)) {
            const bookedTimes = resData.map((apt: any) => apt?.timeSlot || apt).filter(Boolean);
            if (isMounted) {
              setBusySlots(bookedTimes);
              setRequiresApprovalSlots([]);
            }
          } else {
            if (isMounted) {
              setBusySlots(resData.busySlots || []);
              setRequiresApprovalSlots(resData.requiresApprovalSlots || []);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch availability:', err);
      } finally {
        if (isMounted) setIsLoadingSlots(false);
      }
    };

    fetchAvailability();

    return () => {
      isMounted = false;
    };
  }, [selectedDate, selectedBarber, totalDurationMinutes]);

  // Base Time Slots list dynamically generated from shopProfile and duration
  const baseSlots = useMemo(() => {
    return generateTimeSlotsFromProfile(shopProfile, selectedDate, totalDurationMinutes);
  }, [shopProfile, selectedDate, totalDurationMinutes]);

  const monthYearHeader = useMemo(() => {
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${monthNames[calendarMonth.getMonth()]} ${calendarMonth.getFullYear()}`;
  }, [calendarMonth]);

  const calendarDaysGrid = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Dom
    const totalDays = new Date(year, month + 1, 0).getDate();

    const blanks = Array.from({ length: firstDayIndex });
    const days = Array.from({ length: totalDays }, (_, i) => i + 1);

    return { year, month, blanks, days };
  }, [calendarMonth]);

  const canGoPrevMonth = useMemo(() => {
    const { year: currentYear, month: currentMonth } = getTodayYearMonthBRT(todayStr);
    return calendarMonth.getFullYear() > currentYear || (calendarMonth.getFullYear() === currentYear && calendarMonth.getMonth() > currentMonth);
  }, [calendarMonth, todayStr]);

  const handlePrevMonth = () => {
    if (!canGoPrevMonth) return;
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const totalPrice = selectedServices.reduce((a, b) => a + (b.price || 0), 0);
  const choicesSummaryText = selectedBarber 
    ? `${selectedBarber.name} • R$ ${totalPrice.toFixed(2)}`
    : `R$ ${totalPrice.toFixed(2)}`;

  return (
    <div className="space-y-5 px-4 pb-28">
      {/* SECTION 1: CALENDAR */}
      <div>
        <div className="bg-surface-card border border-border-subtle rounded-card p-5 shadow-sm space-y-4">
          {/* Calendar Header */}
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <span className="text-sm font-extrabold text-content-base">
              {monthYearHeader}
            </span>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                disabled={!canGoPrevMonth}
                onClick={handlePrevMonth}
                className={`p-1.5 rounded-btn transition-colors ${
                  canGoPrevMonth
                    ? 'bg-border-subtle hover:bg-surface-card text-content-base'
                    : 'opacity-20 text-content-muted cursor-not-allowed'
                }`}
                title="Mês Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-btn bg-border-subtle hover:bg-surface-card text-content-base transition-colors"
                title="Próximo Mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekdays Row */}
          <div className="grid grid-cols-7 text-center text-[10px] font-bold text-content-muted uppercase">
            <span>Dom</span>
            <span>Seg</span>
            <span>Ter</span>
            <span>Qua</span>
            <span>Qui</span>
            <span>Sex</span>
            <span>Sáb</span>
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDaysGrid.blanks.map((_, idx) => (
              <div key={`blank-${idx}`} className="h-9" />
            ))}

            {calendarDaysGrid.days.map((dNum) => {
              const dayStr = String(dNum).padStart(2, '0');
              const monthStr = String(calendarDaysGrid.month + 1).padStart(2, '0');
              const isoDate = `${calendarDaysGrid.year}-${monthStr}-${dayStr}`;

              const isPast = isoDate < todayStr;
              const isClosed = !isDateOpenInProfile(shopProfile, isoDate);
              const isSelected = isoDate === selectedDate;

              return (
                <button
                  key={isoDate}
                  type="button"
                  disabled={isPast || isClosed}
                  onClick={() => {
                    if ('vibrate' in navigator) navigator.vibrate(40);
                    onSelectDate(isoDate);
                    onSelectTimeSlot(''); // Clear selected time when date changes
                    setTimeout(() => {
                      timeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                  title={isClosed ? 'Barbearia fechada neste dia' : undefined}
                  className={`h-9 rounded-btn text-xs font-bold transition-all flex items-center justify-center ${
                    isSelected
                      ? 'bg-gold-base text-surface-base shadow-md scale-105'
                      : (isPast || isClosed)
                      ? 'text-content-muted cursor-not-allowed opacity-30 line-through'
                      : 'text-content-base hover:bg-surface-card hover:text-content-base'
                  }`}
                >
                  {dNum}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 2: HORÁRIOS DISPONÍVEIS */}
      <div ref={timeSectionRef} className="scroll-mt-20">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-[11px] font-bold text-content-muted uppercase tracking-widest">
            HORÁRIOS DISPONÍVEIS
          </h2>
          {selectedDate && (
            <span className="text-[11px] text-content-muted font-medium">
              {formatDateBR(selectedDate)}
            </span>
          )}
        </div>

        {isLoadingSlots ? (
          <div className="py-12 bg-surface-card border border-border-subtle rounded-card text-center text-xs text-content-muted animate-pulse flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 text-gold-base animate-spin" />
            <span>Carregando horários para {formatDateBR(selectedDate)}...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {baseSlots.map((time) => {
                const isSelected = selectedTimeSlot === time;
                
                // Validar se o horário já passou na data de hoje usando Fuso BRT
                const currTimeBRT = getCurrentTimeBRT();
                const slotMins = timeToMinutes(time);
                const isPastTime = selectedDate === todayStr && slotMins <= currTimeBRT.totalMinutes;
                
                const isBusy = busySlots.includes(time) || isPastTime;
                const isReqApproval = requiresApprovalSlots.includes(time);
                const isAvailable = !isBusy;

                return (
                  <button
                    key={time}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => {
                      if ('vibrate' in navigator) navigator.vibrate(40);
                      onSelectTimeSlot(time);
                    }}
                    className={`py-3.5 px-2 rounded-btn text-center text-sm sm:text-base transition-all duration-200 focus:outline-none select-none flex flex-col items-center justify-center ${
                      isSelected
                        ? isReqApproval
                          ? 'bg-amber-500 text-surface-base font-extrabold shadow-lg scale-[1.02]'
                          : 'bg-gold-base text-surface-base font-extrabold shadow-lg scale-[1.02]'
                        : isReqApproval
                        ? 'bg-amber-500/10 border border-amber-500/40 text-amber-300 font-bold hover:bg-amber-500/20 active:scale-95'
                        : isAvailable
                        ? 'bg-surface-card border border-border-subtle hover:border-border-subtle text-content-base font-bold hover:bg-surface-card active:scale-95'
                        : 'bg-surface-base text-content-muted line-through cursor-not-allowed opacity-40 border border-transparent'
                    }`}
                  >
                    <span>{time}</span>
                    {isReqApproval && (
                      <span className="text-[9px] font-medium tracking-tight uppercase opacity-90 mt-0.5">
                        Fora Expediente
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedTimeSlot && requiresApprovalSlots.includes(selectedTimeSlot) && (
              <div className="mt-3 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs flex items-start gap-2.5 animate-fade-in shadow-sm">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold text-amber-200 text-xs mb-0.5">
                    Solicitação Fora do Expediente
                  </strong>
                  Este atendimento ultrapassa o horário normal de funcionamento. O agendamento será enviado para análise e aprovação do barbeiro.
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Bottom Action Bar */}
      <div className="sticky bottom-2 z-40 px-4 my-2 flex justify-center pointer-events-none animate-fade-in">
        <div className="pointer-events-auto w-full max-w-[440px] bg-surface-base/95 backdrop-blur-xl border border-border-subtle p-3 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center justify-between">
          {showBackConfirm ? (
            <div className="flex-1 flex flex-col items-center animate-fade-in w-full px-2">
              <span className="text-[11px] font-bold text-content-base mb-2 uppercase tracking-wider">Deseja voltar aos profissionais?</span>
              <div className="flex items-center space-x-2 w-full">
                <button
                  type="button"
                  onClick={() => setShowBackConfirm(false)}
                  className="flex-1 py-2 rounded-full bg-border-subtle hover:bg-content-muted/30 text-content-base font-bold text-[11px] transition-all"
                >
                  Não
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="flex-1 py-2 rounded-full bg-border-subtle hover:bg-surface-card border border-border-subtle text-content-base font-bold text-[11px] transition-all active:scale-95"
                >
                  Sim, voltar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col pl-3.5 min-w-0 pr-2">
                <span className="text-[10px] text-content-muted font-bold uppercase tracking-wider block truncate">
                  {choicesSummaryText}
                </span>
                <div className="text-xs font-serif text-content-base font-semibold flex items-center space-x-1.5 truncate">
                  {selectedDate && selectedTimeSlot ? (
                    <>
                      <CalendarIcon className="w-3.5 h-3.5 text-gold-base shrink-0" />
                      <span className="truncate">{formatDateBR(selectedDate)}</span>
                      <span className="text-content-muted shrink-0">•</span>
                      <Clock className="w-3.5 h-3.5 text-gold-base shrink-0" />
                      <span className="shrink-0">{selectedTimeSlot}</span>
                    </>
                  ) : (
                    <span className="text-content-muted font-medium italic">Escolha data e hora</span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => (selectedDate || selectedTimeSlot) ? setShowBackConfirm(true) : onBack()}
                  className="w-10 h-10 rounded-full bg-border-subtle hover:bg-surface-card border border-border-subtle flex items-center justify-center text-content-base transition-all active:scale-95 shrink-0"
                  title="Voltar"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedDate && selectedTimeSlot && !isAdvancing) {
                      setIsAdvancing(true);
                      onNext();
                    }
                  }}
                  disabled={!selectedDate || !selectedTimeSlot || isAdvancing}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    selectedDate && selectedTimeSlot
                      ? 'bg-gold-base text-surface-base shadow-lg shadow-[#C9A96E]/20 active:scale-95'
                      : 'bg-surface-card text-content-muted cursor-not-allowed opacity-50'
                  }`}
                  title="Avançar"
                >
                  {isAdvancing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-5 h-5" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Custom calendar modal removed since it is now inline */}
    </div>
  );
};



