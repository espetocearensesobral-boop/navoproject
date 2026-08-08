import React, { useState, useEffect } from 'react';
import { Professional, ServiceItem } from '../../types';
import { fetchProfessionalsFromSupabase } from '../../services/supabaseDataService';
import { UserCheck, Star, Zap, CheckCircle, ArrowLeft, ArrowRight, User, Loader2, Calendar, Clock, AlertCircle } from 'lucide-react';
import { optimizeImageUrl } from '../../lib/imageUtils';
import { authFetch } from '../../lib/api';

interface BookingStep2Props {
  selectedServices?: ServiceItem[];
  selectedBarber: Professional | null;
  selectedDate?: string;
  selectedTimeSlot?: string;
  onSelectBarber: (barber: Professional) => void;
  onBack: () => void;
  onNext: () => void;
}

const semPreferenciaOption: Professional = {
  id: 'prof_any',
  name: 'Sem preferência',
  nickname: 'Primeiro disponível',
  role: 'Atendimento mais rápido',
  rating: 5.0,
  reviews_count: 250,
  photo_url: '',
  specialties: ['Qualquer barbeiro livre'],
  commission_rate: 0.40,
  working_hours: {
    days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    start: '08:00',
    end: '20:00'
  }
};

function processBarbersList(data: Professional[]): Professional[] {
  const safeData = Array.isArray(data) ? data : [];
  const hasAny = safeData.some((p) => p && p.id === 'prof_any');
  if (!hasAny) {
    return [semPreferenciaOption, ...safeData];
  }
  return safeData;
}

export const BookingStep2Barbers: React.FC<BookingStep2Props> = ({
  selectedServices = [],
  selectedBarber,
  selectedDate,
  selectedTimeSlot,
  onSelectBarber,
  onBack,
  onNext
}) => {
  const [barbers, setBarbers] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [busyMap, setBusyMap] = useState<Record<string, string[]>>({});

  const totalPrice = selectedServices.reduce((a, b) => a + (b.price || 0), 0);
  const servicesSummaryText = selectedServices.length > 0
    ? `${selectedServices.length} ${selectedServices.length === 1 ? 'serviço' : 'serviços'} • R$ ${totalPrice.toFixed(2)}`
    : 'Profissional';

  useEffect(() => {
    let isMounted = true;
    async function loadBarbers() {
      setLoading(true);
      const data = await fetchProfessionalsFromSupabase();
      if (isMounted) {
        setBarbers(processBarbersList(data));
        setLoading(false);
      }
    }
    loadBarbers();
    return () => { isMounted = false; };
  }, []);

  // Buscar disponibilidade de cada barbeiro para a data selecionada
  useEffect(() => {
    if (!selectedDate) return;
    let isMounted = true;

    async function loadBarbersAvailability() {
      try {
        const newMap: Record<string, string[]> = {};
        for (const b of barbers) {
          if (b.id === 'prof_any') continue;
          const res = await authFetch(`/api/availability?professionalId=${b.id}&date=${selectedDate}`);
          if (res.ok) {
            const data = await res.json();
            newMap[b.id] = Array.isArray(data) ? data.map((item: any) => item?.timeSlot).filter(Boolean) : [];
          }
        }
        if (isMounted) {
          setBusyMap(newMap);
        }
      } catch (err) {
        console.warn('Erro ao carregar disponibilidade dos barbeiros:', err);
      }
    }

    loadBarbersAvailability();
    return () => { isMounted = false; };
  }, [selectedDate, barbers]);

  // Format date BR
  const formatDateBR = (iso: string) => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
  };

  return (
    <div className="space-y-3 pb-28 px-4">
      {/* Active Filter Banner if Date/Time selected */}
      {selectedDate && (
        <div className="bg-surface-card border border-gold-base/30 rounded-card p-3 flex items-center justify-between text-xs animate-fade-in shadow-sm">
          <div className="flex items-center space-x-2 text-content-base">
            <Calendar className="w-4 h-4 text-gold-base shrink-0" />
            <span>Filtro de agenda: <strong>{formatDateBR(selectedDate)}</strong> {selectedTimeSlot ? `às ${selectedTimeSlot}` : ''}</span>
          </div>
          <span className="text-[10px] text-gold-base font-bold uppercase tracking-wider bg-gold-base/10 px-2 py-0.5 rounded-full border border-gold-base/20">
            {selectedTimeSlot ? 'Horário Filtrado' : 'Data Filtrada'}
          </span>
        </div>
      )}

      {/* Barbers List */}
      {loading ? (
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-border-subtle border border-border-subtle animate-pulse">
              <div className="flex items-center space-x-3.5 w-full">
                <div className="w-14 h-14 rounded-full bg-white/10 shrink-0" />
                <div className="space-y-2 w-full max-w-[200px]">
                  <div className="h-4 w-28 bg-white/10 rounded" />
                  <div className="h-3 w-36 bg-white/10 rounded" />
                  <div className="h-3 w-20 bg-white/10 rounded" />
                </div>
              </div>
              <div className="w-6 h-6 rounded-full bg-white/10 shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
          {barbers.map((barber) => {
            const isSelected = selectedBarber?.id === barber.id;
            const isAny = barber.id === 'prof_any';
            const initial = barber.name.trim().charAt(0).toUpperCase();
            const subtitle = isAny 
              ? 'Atendimento mais rápido' 
              : (barber.nickname || barber.specialties?.[0] || barber.role || 'Barbeiro especialista');
            const cortesCount = barber.reviews_count || 120;

            // Verificar se o profissional está ocupado no horário selecionado
            const isOccupiedAtSlot = Boolean(
              selectedTimeSlot && 
              !isAny && 
              busyMap[barber.id]?.includes(selectedTimeSlot)
            );

            return (
              <div
                key={barber.id}
                onClick={() => {
                  if (isOccupiedAtSlot) return;
                  if ('vibrate' in navigator) navigator.vibrate(50);
                  onSelectBarber(barber);
                }}
                className={`flex items-center justify-between p-3.5 sm:p-4 rounded-card cursor-pointer transition-all duration-200 select-none relative overflow-hidden ${
                  isOccupiedAtSlot
                    ? 'opacity-50 cursor-not-allowed bg-surface-card border border-status-danger/30'
                    : isSelected
                    ? 'bg-surface-base border-2 border-content-base shadow-[0_0_20px_rgba(201,169,110,0.15)] scale-[1.01]'
                    : 'bg-surface-card border border-border-subtle hover:border-border-subtle hover:bg-surface-card'
                }`}
              >
                {/* Left: Avatar + Info */}
                <div className="flex items-center space-x-3.5 min-w-0 pr-2">
                  {/* Avatar Circle */}
                  <div className="relative w-14 h-14 rounded-full shrink-0 overflow-hidden bg-gold-base/20 border border-gold-base/30 flex items-center justify-center">
                    {isAny ? (
                      <div className="w-full h-full bg-gradient-to-br from-content-base to-content-muted flex items-center justify-center text-surface-base">
                        <Zap className="w-7 h-7 fill-black" />
                      </div>
                    ) : barber.photo_url ? (
                      <img
                        src={optimizeImageUrl(barber.photo_url, 200)}
                        alt={barber.name}
                        decoding="async"
                        loading="eager"
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gold-base/30 text-gold-hover font-black text-xl flex items-center justify-center">
                        {initial}
                      </div>
                    )}
                  </div>

                  {/* Info Column */}
                  <div className="min-w-0">
                    <h3 className="font-bold text-base leading-snug truncate text-content-base">
                      {barber.name}
                    </h3>

                    <p className="text-xs text-content-muted truncate mt-0.5 font-normal">
                      {subtitle}
                    </p>

                    <div className="flex items-center space-x-1.5 mt-1 text-xs">
                      {isAny ? (
                        <span className="text-[10px] text-status-success font-bold uppercase tracking-wider bg-status-success/10 px-2 py-0.5 rounded-full border border-status-success/20">
                          Mais disponibilidade
                        </span>
                      ) : isOccupiedAtSlot ? (
                        <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Ocupado às {selectedTimeSlot}
                        </span>
                      ) : (
                        <div className="flex items-center text-content-muted text-xs">
                          <Star className="w-3.5 h-3.5 text-gold-base fill-content-base mr-1 shrink-0" />
                          <span className="font-bold text-content-base mr-1">{barber.rating}</span>
                          <span className="text-content-muted mr-1">·</span>
                          <span className="text-content-muted">{cortesCount} cortes</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Radio Selection Circle */}
                <div className="shrink-0 pl-2 flex items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${
                    isSelected
                      ? 'bg-gold-base border-2 border-content-base shadow-sm'
                      : 'border-2 border-border-subtle bg-transparent'
                  }`}>
                    {isSelected && (
                      <div className="w-2.5 h-2.5 rounded-full bg-surface-base shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Action Bar */}
      <div className="sticky bottom-2 z-40 px-4 my-2 flex justify-center pointer-events-none animate-fade-in">
        <div className="pointer-events-auto w-full max-w-[440px] bg-surface-base/95 backdrop-blur-xl border border-border-subtle p-3 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center justify-between">
          {showBackConfirm ? (
            <div className="flex-1 flex flex-col items-center animate-fade-in w-full px-2">
              <span className="text-[11px] font-bold text-content-base mb-2 uppercase tracking-wider">Deseja voltar aos serviços?</span>
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
                  {servicesSummaryText}
                </span>
                <div className="text-xs font-serif text-content-base font-semibold flex items-center space-x-1.5 truncate">
                  {selectedBarber ? (
                    <>
                      <User className="w-3.5 h-3.5 text-gold-base shrink-0" />
                      <span className="truncate">{selectedBarber.name}</span>
                    </>
                  ) : (
                    <span className="text-content-muted font-medium italic">Selecione um barbeiro</span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => selectedBarber ? setShowBackConfirm(true) : onBack()}
                  className="w-10 h-10 rounded-full bg-border-subtle hover:bg-surface-card border border-border-subtle flex items-center justify-center text-content-base transition-all active:scale-95 shrink-0"
                  title="Voltar"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedBarber && !isAdvancing) {
                      setIsAdvancing(true);
                      onNext();
                    }
                  }}
                  disabled={!selectedBarber || isAdvancing}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    selectedBarber
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
    </div>
  );
};
