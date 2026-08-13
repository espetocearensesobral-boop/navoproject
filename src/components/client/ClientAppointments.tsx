import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Appointment } from '../../types';
import { fetchAppointmentsFromSupabase } from '../../services/supabaseDataService';
import { motion, AnimatePresence } from 'motion/react';
import { hapticLight, hapticSuccess, hapticMedium } from '../../lib/haptics';
import {
  Calendar,
  Clock,
  User,
  MapPin,
  ChevronRight,
  CheckCircle2,
  FileText,
  ArrowRight,
  Bell,
  Search,
  Loader2,
  Scissors,
  XCircle,
  RefreshCw,
  Sparkles,
  Phone,
  ShieldCheck,
  Lock,
  Ticket,
  KeyRound,
  Check
} from 'lucide-react';
import { ReviewModal } from './ReviewModal';
import { FullHistoryModal } from './FullHistoryModal';

const AppointmentDetailsModal = lazy(() => import('./AppointmentDetailsModal').then(m => ({ default: m.AppointmentDetailsModal })));

interface ClientAppointmentsProps {
  customAppointments?: Appointment[];
  isGuest?: boolean;
  currentUser?: any;
  onGoToBooking?: () => void;
}

export const ClientAppointments: React.FC<ClientAppointmentsProps> = ({
  customAppointments = [],
  isGuest = false,
  currentUser,
  onGoToBooking
}) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const matchPhoneNumbers = (phone1?: string, phone2?: string): boolean => {
    if (!phone1 || !phone2) return false;
    const digits1 = phone1.replace(/\D/g, '');
    const digits2 = phone2.replace(/\D/g, '');
    if (!digits1 || !digits2) return false;
    if (digits1 === digits2) return true;

    const norm1 = digits1.length >= 12 && digits1.startsWith('55') ? digits1.slice(2) : digits1;
    const norm2 = digits2.length >= 12 && digits2.startsWith('55') ? digits2.slice(2) : digits2;
    if (norm1 === norm2) return true;

    if (norm1.length >= 10 && norm2.length >= 10) {
      const ddd1 = norm1.slice(0, 2);
      const ddd2 = norm2.slice(0, 2);
      if (ddd1 !== ddd2) return false;

      const rest1 = norm1.slice(2);
      const rest2 = norm2.slice(2);
      if (rest1 === rest2) return true;
      if (rest1.slice(-8) === rest2.slice(-8)) return true;
      return false;
    }

    if (norm1.length >= 8 && norm2.length >= 8) {
      return norm1.slice(-8) === norm2.slice(-8);
    }
    return false;
  };

  const loadAppointments = async () => {
    setHasError(false);
    setIsLoading(true);

    // Visitantes não recebem histórico local: para consultar qualquer reserva
    // precisam validar telefone + voucher, inclusive no mesmo dispositivo.
    // Usuários autenticados só podem reutilizar o cache local do próprio client_id.
    const sessionOwnerId = currentUser?.id && currentUser.id !== 'guest' ? currentUser.id : '';
    const allLocal = isGuest
      ? []
      : customAppointments.filter((apt) => !sessionOwnerId || apt.client_id === sessionOwnerId);
    const uniqueLocalMap = new Map<string, Appointment>();
    allLocal.forEach(apt => {
      if (apt && apt.id) uniqueLocalMap.set(apt.id, apt);
    });
    const localCombined = Array.from(uniqueLocalMap.values());

    if (isGuest && !searchedPhone) {
      setAppointments([]);
      setIsLoading(false);
      return;
    }

    try {
      const phoneToSearch = searchedPhone || (isGuest ? undefined : currentUser?.phone);
      const data = await fetchAppointmentsFromSupabase(phoneToSearch);

      // Strict filtering
      const userApts = data.filter((a: Appointment) => {
        // Logged-in registered user matching ID or Phone
        if (!isGuest && currentUser?.id && currentUser.id !== 'guest') {
          if (a.client_id === currentUser.id) return true;
          if (currentUser.phone && a.client_phone && matchPhoneNumbers(currentUser.phone, a.client_phone)) return true;
          return false;
        }

        // Guest searching explicitly by phone number
        if (searchedPhone && a.client_phone && matchPhoneNumbers(searchedPhone, a.client_phone)) {
          return true;
        }

        // Guest matching appointment created in current session matching searched phone or session
        if (isGuest && localCombined.some(loc => loc.id === a.id)) {
          if (!searchedPhone || matchPhoneNumbers(searchedPhone, a.client_phone)) {
            return true;
          }
        }

        return false;
      });

      // Merge local session appointments and server data
      const fetchedIds = new Set(userApts.map((a: Appointment) => a.id));
      const uniqueLocal = localCombined.filter(a => {
        if (fetchedIds.has(a.id)) return false;
        if (searchedPhone && !matchPhoneNumbers(searchedPhone, a.client_phone)) return false;
        return true;
      });

      const merged = [...uniqueLocal, ...userApts].sort(
        (a, b) => new Date(b.date || b.created_at || '').getTime() - new Date(a.date || a.created_at || '').getTime()
      );

      setAppointments(merged);
    } catch (error: any) {
      console.error("Erro ao carregar agendamentos:", error);
      if (error.status === 401 && isGuest && searchedPhone) {
        // Token expired or invalid, reset guest auth state
        setSearchedPhone('');
        setVerifiedVoucher('');
        setAppointments([]);
        setHasError(false);
        
      } else if (localCombined.length > 0) {
        setAppointments(localCombined);
      } else {
        setHasError(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [isGuest, customAppointments, currentUser]);

  // Limpeza de estado do visitante ao desmontar/sair da tela
  useEffect(() => {
    return () => {
      if (isGuest) {
        navigator.sendBeacon(
          '/api/appointments/lookup/logout',
          new Blob([JSON.stringify({})], { type: 'application/json' })
        );
        setSearchedPhone('');
        setVerifiedVoucher('');
        setGuestPhoneInput('');
        setGuestPhoneError('');
        setVoucherInput('');
        setVoucherError('');
        setIsVoucherVerificationMode(false);
        setAppointments([]);
      }
    };
  }, [isGuest]);

  // Current appointment is the most recent active or non-cancelled one, or simply the first
  const currentAppointment = appointments.find(
    a => a.status === 'confirmed' || a.status === 'in_queue' || a.status === 'in_service' || a.status === 'pending_approval'
  ) || appointments[0];

  // History section only shows appointments other than the current active one (past/other appointments)
  const historyAppointments = currentAppointment
    ? appointments.filter(a => a.id !== currentAppointment.id)
    : appointments;


  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isFullHistoryOpen, setIsFullHistoryOpen] = useState(false);
  const [reviewAppointment, setReviewAppointment] = useState<Appointment | null>(null);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [guestPhoneInput, setGuestPhoneInput] = useState('');
  const [searchedPhone, setSearchedPhone] = useState('');
  const [verifiedVoucher, setVerifiedVoucher] = useState('');

  const [isSearchingGuest, setIsSearchingGuest] = useState(false);
  const [guestPhoneError, setGuestPhoneError] = useState('');

  // Voucher verification mode for visitors
  const [isVoucherVerificationMode, setIsVoucherVerificationMode] = useState(false);
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherError, setVoucherError] = useState('');

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setGuestPhoneInput(formatted);
    if (guestPhoneError) setGuestPhoneError('');
  };

  const handleGuestSearch = async (overridePhone?: string) => {
    const phoneToUse = overridePhone || guestPhoneInput;
    const numbers = phoneToUse.replace(/\D/g, '');
    if (numbers.length < 8) {
      setGuestPhoneError('Telefone inválido.\nDigite o número com DDD (ex: 11 99999-9999)');
      return;
    }

    setIsSearchingGuest(true);
    setGuestPhoneError('');
    setVoucherError('');
    setVoucherInput('');

    try {
      const [res] = await Promise.all([
        fetch(`/api/appointments/lookup/step1?phone=${encodeURIComponent(numbers)}`),
        new Promise(res => setTimeout(res, 400))
      ]);

      let data: any = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        throw new Error('Erro de conexão com o servidor. Tente novamente.');
      }
      
      if (!res.ok) {
        throw new Error(data.error || 'Nenhum agendamento encontrado.');
      }

      setSearchedPhone(phoneToUse);
      setIsVoucherVerificationMode(true); // Enter voucher verification step
      setAppointments([]); // Hide appointments until voucher is validated
    } catch (err: any) {
      setGuestPhoneError(err.message || 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
      setAppointments([]);
      setSearchedPhone('');
      setIsVoucherVerificationMode(false);
    } finally {
      setIsSearchingGuest(false);
    }
  };

  const handleVerifyVoucher = async () => {
    if (!voucherInput.trim()) {
      setVoucherError('Digite o código do voucher informado no comprovante de agendamento.');
      return;
    }

    const cleanInput = voucherInput.trim().toUpperCase().replace(/^#/, '');

    try {
      const res = await fetch(`/api/appointments/lookup/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: searchedPhone, code: cleanInput }),
        credentials: 'include' // needed to set cookie
      });

      const dataText = await res.text();
      let data: any = {};
      try {
        data = dataText ? JSON.parse(dataText) : {};
      } catch (e) {
        throw new Error('Erro de conexão com o servidor. Tente novamente.');
      }
      if (!res.ok) {
        throw new Error(data.error || 'Código do Voucher incorreto para o telefone informado.');
      }

      hapticSuccess();
      setVerifiedVoucher(cleanInput);
      setIsVoucherVerificationMode(false);
      setVoucherError('');
      

      // Reload appointments with newly acquired guest auth session
      loadAppointments();
    } catch (err: any) {
      hapticMedium();
      setVoucherError(err.message || 'Erro ao validar o código.');
    }
  };

  const handleClearSearch = async () => {
    try {
      await fetch(`/api/appointments/lookup/logout`, { method: 'POST', credentials: 'include' });
    } catch (e) {}

    setAppointments([]);
    setSearchedPhone('');
    setVerifiedVoucher('');
    setGuestPhoneInput('');
    setGuestPhoneError('');
    setVoucherInput('');
    setVoucherError('');
    setIsVoucherVerificationMode(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_queue':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-status-warning/15 text-status-warning border border-status-warning/30 inline-flex items-center space-x-1">
            <span>Fila</span>
          </span>
        );
      case 'in_service':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-status-success/15 text-status-success border border-status-success/30 inline-flex items-center space-x-1">
            <span>Atendimento</span>
          </span>
        );
      case 'pending_approval':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center space-x-1 animate-pulse">
            <span>⚠️ Aguardando Aprovação</span>
          </span>
        );
      case 'confirmed':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-status-success/15 text-status-success border border-status-success/30 inline-flex items-center space-x-1">
            <span>Confirmado</span>
          </span>
        );
      case 'cancelled':
      case 'cancelado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/15 text-red-400 border border-red-500/30 inline-flex items-center space-x-1">
            <span>Cancelado</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-card text-content-muted border border-border-subtle">
            Concluído
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 pb-6 px-4">
        <div className="h-20 card-elevation-1 rounded-2xl animate-shimmer" />
        <div className="h-16 card-elevation-1 rounded-2xl animate-shimmer" />
        <div className="h-40 card-elevation-1 rounded-2xl animate-shimmer" />
      </div>
    );
  }

  return (
    <div
      className={`space-y-4 pt-2 sm:pt-4 pb-8 px-4 relative flex-1 flex flex-col ${
        appointments.length === 0 ? 'min-h-[60vh] justify-center pt-0 my-auto' : ''
      }`}
    >

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
      {/* Loading Error State Card with Retry */}
      {hasError && (
        <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-3xl text-center space-y-3.5 backdrop-blur-md shadow-xl my-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/30">
            <XCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-content-base">Erro ao carregar dados</h3>
            <p className="text-xs text-content-muted max-w-xs mx-auto leading-relaxed">
              Não foi possível conectar ao servidor para buscar seus agendamentos. Verifique sua conexão e tente novamente.
            </p>
          </div>
          <button
            onClick={() => loadAppointments()}
            className="px-5 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs border border-red-500/30 transition-all active:scale-95 flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Tentar Novamente</span>
          </button>
        </div>
      )}

      {/* Empty State for Logged In User (No appointments yet) */}
      {!isGuest && appointments.length === 0 && !hasError && (
        <div className="w-full max-w-[350px] aspect-square mx-auto bg-surface-card/30 backdrop-blur-md p-6 rounded-3xl border border-border-subtle/70 text-center flex flex-col items-center justify-center space-y-4 shadow-lg my-auto">
          <div className="w-14 h-14 rounded-2xl bg-gold-base text-surface-base flex items-center justify-center shadow-lg shadow-[0_0_20px_rgba(201,169,110,0.25)] shrink-0">
            <Calendar className="w-7 h-7 stroke-[2.5]" />
          </div>
          <div className="space-y-1.5 max-w-xs mx-auto">
            <h3 className="text-base font-serif text-content-base font-semibold">Sua agenda está vazia</h3>
            <p className="text-xs text-content-muted leading-relaxed">
              Você ainda não possui horários marcados ou anteriores no histórico. Garanta o seu atendimento VIP!
            </p>
          </div>
          {onGoToBooking && (
            <button
              onClick={() => {
                hapticLight();
                onGoToBooking();
              }}
              className="mt-1 px-5 py-2.5 rounded-2xl bg-gold-base text-surface-base font-extrabold text-xs uppercase tracking-wider shadow-lg hover:opacity-95 active:scale-95 transition-all inline-flex items-center gap-2 shrink-0"
            >
              <Scissors className="w-4 h-4" />
              <span>Agendar Novo Horário</span>
            </button>
          )}
        </div>
      )}

      {/* Guest Step 1: Phone Search Bar (When no voucher verification or appointments active) */}
      {isGuest && !isVoucherVerificationMode && appointments.length === 0 && (
        <div className="w-full max-w-[360px] mx-auto bg-surface-card/30 backdrop-blur-md p-6 rounded-3xl border border-border-subtle/70 text-center flex flex-col items-center justify-center space-y-4 shadow-lg my-auto">
          <div className="w-14 h-14 rounded-2xl bg-gold-base text-surface-base flex items-center justify-center text-surface-base shadow-lg shadow-[0_0_20px_rgba(201,169,110,0.25)] shrink-0">
            {isSearchingGuest ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : (
              <Search className="w-7 h-7 stroke-[2.5]" />
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-serif text-content-base font-semibold">Consultar Meus Agendamentos</h3>
            <p className="text-xs text-content-base max-w-xs mx-auto leading-relaxed">
              {isSearchingGuest
                ? 'Buscando cadastro no sistema...'
                : 'Digite seu telefone para localizar seu agendamento e histórico.'}
            </p>
          </div>

          <div className="flex flex-col space-y-2 w-full max-w-[290px] mx-auto shrink-0">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                {isSearchingGuest ? (
                  <Loader2 className="w-4 h-4 text-gold-base absolute left-3 top-1/2 -translate-y-1/2 animate-spin" />
                ) : (
                  <Phone className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
                )}
                <input
                  type="tel"
                  inputMode="tel"
                  enterKeyHint="search"
                  autoComplete="tel"
                  disabled={isSearchingGuest}
                  placeholder="(11) 99999-9999"
                  value={guestPhoneInput}
                  onChange={handlePhoneChange}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!isSearchingGuest) {
                        handleGuestSearch();
                      }
                    }
                  }}
                  maxLength={15}
                  className={`w-full bg-surface-base border ${
                    guestPhoneError
                      ? 'border-red-500/50 focus:border-red-500'
                      : 'border-border-subtle focus:border-gold-base'
                  } rounded-2xl pl-9 pr-3 py-2.5 text-xs font-bold text-content-base placeholder-neutral-500 focus:outline-none transition-all disabled:opacity-75`}
                />
              </div>

              <button
                type="button"
                onClick={() => handleGuestSearch()}
                disabled={isSearchingGuest || !guestPhoneInput}
                className="h-10 px-4 rounded-2xl bg-gold-base text-surface-base font-extrabold text-xs flex items-center justify-center space-x-1 shadow-lg active:scale-95 transition-all disabled:opacity-50 shrink-0"
              >
                {isSearchingGuest ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Buscar</span>
                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </div>

            {guestPhoneError && (
              <p className="text-[11px] text-red-400 font-medium text-center pt-0.5 whitespace-pre-line leading-tight">
                {guestPhoneError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Guest Step 2: Voucher / Booking Code Validation Modal Card */}
      {isGuest && isVoucherVerificationMode && appointments.length === 0 && (
        <div className="w-full max-w-[360px] mx-auto bg-gradient-to-b from-surface-card/60 via-surface-card/40 to-surface-card/20 backdrop-blur-md p-6 rounded-3xl border border-gold-base/50 text-center flex flex-col items-center justify-center space-y-4 shadow-2xl my-auto animate-in zoom-in-95 duration-300">
          <div className="w-14 h-14 rounded-2xl bg-gold-base/20 border border-gold-base/40 text-gold-base flex items-center justify-center shadow-lg shrink-0">
            <Lock className="w-7 h-7 stroke-[2.5]" />
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gold-base/15 border border-gold-base/30 text-[10px] font-bold text-gold-base uppercase tracking-wider mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Telefone Encontrado</span>
            </div>
            <h3 className="text-base font-serif text-content-base font-bold">Validar Código do Voucher</h3>
            <p className="text-xs text-content-muted max-w-xs mx-auto leading-relaxed">
              Encontramos agendamento(s) para o telefone <strong className="text-content-base">{searchedPhone}</strong>. Por segurança, digite o código do voucher gerado no comprovante.
            </p>
          </div>

          <div className="flex flex-col space-y-3 w-full max-w-[290px] mx-auto shrink-0">
            <div className="relative">
              <Ticket className="w-4 h-4 text-gold-base absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder="Ex: BRX-A1B2C"
                value={voucherInput}
                onChange={e => {
                  setVoucherInput(e.target.value.toUpperCase());
                  if (voucherError) setVoucherError('');
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleVerifyVoucher();
                  }
                }}
                className={`w-full bg-surface-base border ${
                  voucherError
                    ? 'border-red-500/60 focus:border-red-500'
                    : 'border-gold-base/40 focus:border-gold-base'
                } rounded-2xl pl-10 pr-3 py-3 text-sm font-extrabold font-mono tracking-widest text-content-base uppercase placeholder-neutral-500 focus:outline-none transition-all shadow-inner`}
              />
            </div>

            {voucherError && (
              <p className="text-[11px] text-red-400 font-medium text-center whitespace-pre-line leading-tight">
                {voucherError}
              </p>
            )}

            <button
              type="button"
              onClick={handleVerifyVoucher}
              disabled={!voucherInput.trim()}
              className="w-full py-3 rounded-2xl bg-gold-base hover:opacity-95 text-surface-base font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-gold-base/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4 stroke-[2.5]" />
              <span>Validar e Acessar</span>
            </button>

            <button
              type="button"
              onClick={handleClearSearch}
              className="text-xs text-content-muted hover:text-gold-base font-semibold pt-1 transition-colors flex items-center justify-center gap-1 mx-auto"
            >
              <span>← Alterar número de telefone</span>
            </button>
          </div>
        </div>
      )}

      {/* SEARCHED PHONE & VOUCHER VERIFIED BANNER (When guest has authenticated appointments) */}
      {isGuest && searchedPhone && appointments.length > 0 && !isSearchingGuest && (
        <div className="bg-surface-card/40 backdrop-blur-md p-3.5 rounded-2xl border border-gold-base/40 flex items-center justify-between text-xs animate-in fade-in shadow-lg">
          <div className="flex items-center space-x-2 text-content-base min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gold-base/20 text-gold-base flex items-center justify-center shrink-0 border border-gold-base/30">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-gold-base font-extrabold uppercase tracking-wider">Consulta Autenticada</span>
              <span className="truncate text-xs font-bold text-content-base">
                {searchedPhone} {verifiedVoucher && <span className="text-content-muted font-normal">• Voucher #{verifiedVoucher}</span>}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearSearch}
            title="Sair da consulta"
            className="px-3 py-1.5 rounded-xl bg-surface-base hover:bg-neutral-800 text-content-muted hover:text-red-400 text-[11px] font-bold transition-all border border-border-subtle active:scale-95 shadow-sm flex items-center justify-center gap-1 shrink-0 ml-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>
      )}

      {/* SMART CARD 1: AGENDAMENTO ATUAL (Compact & Minimalist with Gold Accent) */}
      {!isSearchingGuest && currentAppointment && (
        <div
          onClick={() => setSelectedAppointment(currentAppointment)}
          className="relative bg-gradient-to-br from-surface-card via-surface-base to-surface-card p-3.5 sm:p-4 rounded-2xl border border-gold-base/40 shadow-xl cursor-pointer hover:border-content-base transition-all group overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          {/* Subtle Golden Glow */}
          <div className="absolute top-0 right-0 w-28 h-28 bg-gold-base/10 rounded-full blur-xl pointer-events-none" />

          {/* Card Top Row: Label + Badge */}
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle text-xs">
            <span className="text-[11px] font-serif text-content-base font-semibold uppercase tracking-wider">
              Agendamento Atual
            </span>
            {getStatusBadge(currentAppointment.status)}
          </div>

          {/* Compact Info Section */}
          <div className="py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-extrabold text-content-base capitalize truncate leading-tight">
                {currentAppointment.services?.map(s => s.title).join(', ') || 'Atendimento Navo Premium'}
              </h3>
              <p className="text-[11px] text-content-muted font-medium mt-0.5 capitalize">
                {currentAppointment.date} às <strong className="text-content-base">{currentAppointment.time_slot}</strong>
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-base font-black text-status-success">
                R$ {Number(currentAppointment.final_amount).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Compact Footer Line */}
          <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-content-muted">
            <span className="flex items-center space-x-1 font-medium">
              <FileText className="w-3.5 h-3.5 text-content-base" />
              <span>Toque para ver comprovante</span>
            </span>

            <div className="flex items-center space-x-1 text-content-base font-bold group-hover:translate-x-0.5 transition-transform">
              <span>Detalhes</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      )}

      {/* APPOINTMENTS HISTORY TABLE / CARDS */}
      {historyAppointments.length > 0 && !isSearchingGuest && (
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Scissors className="w-4 h-4 text-gold-base" />
              <h3 className="text-xs font-black text-gold-base uppercase tracking-wider">
                Histórico de Atendimentos
              </h3>
            </div>

            <button
              onClick={() => setIsFullHistoryOpen(true)}
              className="text-xs font-bold text-content-base hover:underline flex items-center space-x-1"
            >
              <span>Ver Completo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Minimalist Compact Table View */}
          <div className="bg-surface-card/90 rounded-2xl border border-border-subtle overflow-hidden shadow-lg">
            {/* Table View for wider displays */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-border-subtle border-b border-border-subtle text-content-muted font-bold uppercase text-[9px] tracking-widest">
                    <th className="py-2.5 px-3">Data / Hora</th>
                    <th className="py-2.5 px-3">Serviço</th>
                    <th className="py-2.5 px-3">Profissional</th>
                    <th className="py-2.5 px-3 text-right">Valor</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {historyAppointments.slice(0, 5).map(apt => (
                    <tr
                      key={apt.id}
                      onClick={() => setSelectedAppointment(apt)}
                      className="transition-colors hover:bg-border-subtle cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-semibold text-content-base capitalize whitespace-nowrap">
                        {apt.date} <span className="text-content-base font-bold">({apt.time_slot})</span>
                      </td>
                      <td className="py-2.5 px-3 text-content-base max-w-[160px] truncate">
                        {apt.services?.map(s => s.title).join(', ')}
                      </td>
                      <td className="py-2.5 px-3 text-content-base whitespace-nowrap">
                        {apt.professional_name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-status-success whitespace-nowrap">
                        R$ {Number(apt.final_amount).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {getStatusBadge(apt.status)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedAppointment(apt);
                          }}
                          className="px-2.5 py-1 rounded bg-border-subtle hover:bg-surface-card text-content-base hover:text-content-base font-bold text-[10px] border border-border-subtle hover:border-content-base transition-all"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Compact Mobile Cards */}
            <div className="sm:hidden divide-y divide-border-subtle">
              {historyAppointments.slice(0, 5).map(apt => (
                <div
                  key={apt.id}
                  onClick={() => setSelectedAppointment(apt)}
                  className="p-3 space-y-1.5 transition-colors cursor-pointer hover:bg-border-subtle"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-content-base capitalize">
                      {apt.date} <strong className="text-content-base">({apt.time_slot})</strong>
                    </span>
                    <span className="font-bold text-status-success">R$ {Number(apt.final_amount).toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-content-muted">
                    <span className="truncate max-w-[200px] text-content-base font-medium">
                      {apt.services?.map(s => s.title).join(', ')}
                    </span>
                    {getStatusBadge(apt.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      
      <ReviewModal
        isOpen={!!reviewAppointment}
        onClose={() => setReviewAppointment(null)}
        appointment={reviewAppointment!}
        onSuccess={(id) => {
          setAppointments(prev => prev.map(a => a.id === id ? { ...a, is_reviewed: true } : a));
          setReviewAppointment(null);
        }}
      />
      {selectedAppointment && (
        <Suspense fallback={null}>
          <AppointmentDetailsModal
            isOpen
            onClose={() => setSelectedAppointment(null)}
            appointment={selectedAppointment}
            onAppointmentUpdated={updated => {
              setSelectedAppointment(updated);
              setAppointments(prev => prev.map(a => (a.id === updated.id ? updated : a)));
            }}
          />
        </Suspense>
      )}

      <FullHistoryModal
        isOpen={isFullHistoryOpen}
        onClose={() => setIsFullHistoryOpen(false)}
        appointments={appointments}
        onAppointmentUpdated={updated => {
          setAppointments(prev => prev.map(a => (a.id === updated.id ? updated : a)));
        }}
        onReviewClick={(appointment) => setReviewAppointment(appointment)}
      />
      </motion.div>
    </div>
  );
};

