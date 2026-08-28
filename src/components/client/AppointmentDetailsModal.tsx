import React, { useRef, useState, useEffect, useMemo } from 'react';
import { authFetch } from '../../lib/api';
import { Appointment } from '../../types';
import {
  X,
  Download,
  Share2,
  MapPin,
  Calendar,
  Clock,
  User,
  Scissors,
  CheckCircle2,
  Copy,
  MessageCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  Phone,
  CalendarX,
  Sun,
  Sunset
} from 'lucide-react';
import { Star } from 'lucide-react';
import { createAppointmentInSupabase, cancelAppointmentInSupabase } from '../../services/supabaseDataService';
import { useToast } from '../ui/Toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SuccessOverlay } from '../ui/SuccessOverlay';
import { LoadingButton } from '../ui/LoadingButton';
import { getTodayStringBRT, getCurrentTimeBRT, timeToMinutes, addDaysBRT } from '../../utils/dateUtils';
import { fetchShopProfile, isDateOpenInProfile, generateTimeSlotsFromProfile, defaultShopProfile, ShopProfile } from '../../services/shopProfileService';
import { fetchOperationSettings, defaultOperationSettings, type OperationSettings } from '../../services/operationSettingsService';
import { useDialogFocus } from '../../hooks/useDialogFocus';

interface AppointmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onAppointmentUpdated?: (updatedApt: Appointment) => void;
  onReviewClick?: () => void;
}

export const AppointmentDetailsModal: React.FC<AppointmentDetailsModalProps> = ({
  isOpen,
  onClose,
  appointment,
  onAppointmentUpdated,
  onReviewClick
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [currentApt, setCurrentApt] = useState<Appointment | null>(appointment);
  const [copiedShare, setCopiedShare] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelToast, setCancelToast] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const rescheduleModalRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useDialogFocus(isOpen && !showRescheduleModal, modalRef);
  useDialogFocus(showRescheduleModal, rescheduleModalRef);
  const [cancelReason, setCancelReason] = useState('Compromisso inesperado');
  const [cancelOtherReason, setCancelOtherReason] = useState('');

  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState('');
  const [busySlots, setBusySlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [shopProfile, setShopProfile] = useState<ShopProfile>(defaultShopProfile);
  const [operationSettings, setOperationSettings] = useState<OperationSettings>(defaultOperationSettings);

  const { showToast } = useToast();
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [successOverlayMessage, setSuccessOverlayMessage] = useState({ title: '', subtitle: '' });
  const [successOverlayAction, setSuccessOverlayAction] = useState<'close_modal' | 'stay_open'>('close_modal');

  const todayStrBRT = useMemo(() => getTodayStringBRT(), []);
  const currTimeBRT = useMemo(() => getCurrentTimeBRT(), []);
  const maximumRescheduleDate = useMemo(() => addDaysBRT(todayStrBRT, operationSettings.maximumBookingHorizonDays), [todayStrBRT, operationSettings.maximumBookingHorizonDays]);

  // Load shop profile
  useEffect(() => {
    fetchShopProfile().then(p => {
      if (p) setShopProfile(p);
    });
    fetchOperationSettings().then(setOperationSettings);
  }, []);

  // Calculate duration of appointment services
  const durationMinutes = useMemo(() => {
    if (!currentApt) return 30;
    if (currentApt.total_duration_minutes) return Number(currentApt.total_duration_minutes);
    if (Array.isArray(currentApt.services) && currentApt.services.length > 0) {
      const sum = currentApt.services.reduce((acc, s) => {
        const dur = Number(s.duration_minutes || (s as any).durationMinutes || 0);
        return acc + dur;
      }, 0);
      if (sum > 0) return sum;
    }
    return 30;
  }, [currentApt]);

  // Check if date is open in shop
  const isClosedOnSelectedDate = useMemo(() => {
    if (!rescheduleDate) return false;
    return !isDateOpenInProfile(shopProfile, rescheduleDate);
  }, [shopProfile, rescheduleDate]);

  // Dynamic slots based on shop schedule & duration
  const dynamicSlots = useMemo(() => {
    if (!rescheduleDate || isClosedOnSelectedDate) return [];
    return generateTimeSlotsFromProfile(shopProfile, rescheduleDate, durationMinutes, operationSettings.slotIntervalMinutes);
  }, [shopProfile, rescheduleDate, durationMinutes, isClosedOnSelectedDate, operationSettings.slotIntervalMinutes]);

  // Initialize reschedule state when modal opens
  useEffect(() => {
    if (showRescheduleModal && currentApt) {
      const initialDate = currentApt.date || todayStrBRT;
      setRescheduleDate(initialDate >= todayStrBRT ? initialDate : todayStrBRT);
      setRescheduleTimeSlot('');
    }
  }, [showRescheduleModal, currentApt, todayStrBRT]);

  // Fetch real availability from backend /api/availability
  useEffect(() => {
    let isMounted = true;
    const fetchAvailability = async () => {
      if (!rescheduleDate || !currentApt || isClosedOnSelectedDate) return;
      setIsLoadingSlots(true);
      try {
        const profId = currentApt.professional_id || (currentApt as any).professionalId || 'prof_any';
        const url = `/api/availability?professionalId=${profId}&date=${rescheduleDate}&duration=${durationMinutes}&excludeAppointmentId=${currentApt.id}`;
        const response = await authFetch(url);
        if (response.ok) {
          const busyData = await response.json();
          const bookedTimes = Array.isArray(busyData)
            ? busyData.map((b: any) => typeof b === 'string' ? b : (b.timeSlot || b.time_slot)).filter(Boolean)
            : Array.isArray(busyData?.busySlots)
              ? busyData.busySlots
              : Array.isArray(busyData?.slots)
                ? busyData.slots.filter((slot: any) => slot && !slot.available).map((slot: any) => slot.timeSlot || slot.time_slot).filter(Boolean)
                : [];
          if (isMounted) setBusySlots(bookedTimes);
        }
      } catch (err) {
        console.warn('Failed to fetch availability:', err);
      } finally {
        if (isMounted) setIsLoadingSlots(false);
      }
    };
    if (showRescheduleModal) fetchAvailability();
    return () => { isMounted = false; };
  }, [rescheduleDate, currentApt, durationMinutes, showRescheduleModal, isClosedOnSelectedDate]);

  const handleConfirmReschedule = async () => {
    if (!currentApt || !rescheduleDate || !rescheduleTimeSlot) return;

    if (rescheduleDate < todayStrBRT) {
      showToast('error', 'Data inválida', 'Selecione uma data futura.');
      return;
    }

    if (rescheduleDate > maximumRescheduleDate) {
      showToast('error', 'Data fora do limite', `Escolha uma data até ${maximumRescheduleDate.split('-').reverse().join('/')}.`);
      return;
    }

    if (isClosedOnSelectedDate) {
      showToast('error', 'Barbearia fechada', 'A barbearia não funciona nesta data.');
      return;
    }

    setIsRescheduling(true);
    try {
      const profId = currentApt.professional_id || (currentApt as any).professionalId;
      const res = await authFetch(`/api/appointments/${currentApt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: rescheduleDate,
          timeSlot: rescheduleTimeSlot,
          time_slot: rescheduleTimeSlot,
          professionalId: profId,
          professional_id: profId,
          totalDurationMinutes: durationMinutes,
          total_duration_minutes: durationMinutes,
          clientPhone: currentApt.client_phone || (currentApt as any).clientPhone,
          client_phone: currentApt.client_phone || (currentApt as any).clientPhone,
          bookingCode: currentApt.booking_code || (currentApt as any).bookingCode
        })
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(resData.error || 'Falha ao reagendar agendamento');
      }

      const updatedApt = {
        ...currentApt,
        date: rescheduleDate,
        timeSlot: rescheduleTimeSlot,
        time_slot: rescheduleTimeSlot
      };

      setCurrentApt(updatedApt);
      if (onAppointmentUpdated) {
        onAppointmentUpdated(updatedApt);
      }
      setShowRescheduleModal(false);
      setSuccessOverlayMessage({
        title: 'Agendamento atualizado!',
        subtitle: `Novo horário: ${formatDateDisplay(rescheduleDate)} às ${rescheduleTimeSlot}`
      });
      setSuccessOverlayAction('close_modal');
      setShowSuccessOverlay(true);

      setTimeout(() => {
        showToast(
          'success',
          'Agendamento atualizado!',
          `Novo horário: ${formatDateDisplay(rescheduleDate)} às ${rescheduleTimeSlot}`
        );
      }, 2600);

      if (navigator.vibrate) navigator.vibrate([50]);
    } catch (err: any) {
      console.warn('Erro ao reagendar:', err);
      showToast(
        'error',
        'Não foi possível reagendar',
        err.message || 'Verifique se o horário ainda está disponível.'
      );
    } finally {
      setIsRescheduling(false);
    }
  };

  useEffect(() => {
    setCurrentApt(appointment);
    setShowCancelModal(false);
    setCancelToast(false);
    setCancelError(null);
  }, [appointment]);

  if (!isOpen || !currentApt) return null;

  const isCancelled = currentApt.status === 'cancelled' || currentApt.status === 'cancelado';

  // Format Date nicely
  const formatDateDisplay = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      if (year && month && day) {
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;
    setIsDownloading(true);
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ]);
      const imgData = await toPng(receiptRef.current, {
        pixelRatio: 3,
        backgroundColor: '#faf8f4',
        cacheBust: true,
      });

      const img = new Image();
      img.src = imgData;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const naturalWidth = img.naturalWidth || 1;
      const naturalHeight = img.naturalHeight || 1;
      const aspectRatio = naturalHeight / naturalWidth;

      const pdfWidthMm = 105;
      const pdfHeightMm = pdfWidthMm * aspectRatio;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidthMm, pdfHeightMm]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidthMm, pdfHeightMm, undefined, 'FAST');
      pdf.save(`comprovante-barberx-${currentApt.id.substring(0, 8)}.pdf`);
    } catch (error) {
      console.warn('Error generating PDF', error);
    } finally {
      setIsDownloading(false);
    }
  };

  // Google Calendar URL Generator
  const getGoogleCalendarUrl = () => {
    const title = encodeURIComponent(`NavoClub - ${currentApt.services?.[0]?.title || 'Agendamento'}`);
    const details = encodeURIComponent(
      `Agendamento NavoClub\nBarbeiro: ${currentApt.professional_name}\nServiços: ${(currentApt.services || []).map(s => s.title).join(', ')}\nLocal: NavoClub - Rua Fortaleza, 1420 - Expectativa, Sobral - CE`
    );
    const location = encodeURIComponent('NavoClub - Rua Fortaleza, 1420 - Expectativa, Sobral - CE');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
  };

  // WhatsApp Message Link Generator
  const getWhatsAppUrl = () => {
    const text = encodeURIComponent(
      `💈 *NAVO PREMIUM*\n\nOlá! Gostaria de falar sobre o meu agendamento:\n\n📋 *Voucher:* #${currentApt.booking_code || currentApt.id.replace('apt_', '').substring(0, 8)}\n📅 *Data:* ${currentApt.date}\n⏰ *Horário:* ${currentApt.time_slot}\n✂️ *Barbeiro:* ${currentApt.professional_name}`
    );
    return `https://api.whatsapp.com/send?phone=5588998340085&text=${text}`;
  };

  // Google Maps Link
  const getMapsUrl = () => {
    return 'https://maps.app.goo.gl/2uCakwEHwA6bbXq97';
  };

  // Confirm cancellation logic
  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    setCancelError(null);
    try {
      const fullReason = cancelReason === 'Outro' ? cancelOtherReason : cancelReason;
      const res = await cancelAppointmentInSupabase(currentApt.id, { ...currentApt, cancellation_reason: fullReason });
      if (res.success && res.appointment) {
        setCurrentApt(res.appointment);
        if (onAppointmentUpdated) {
          onAppointmentUpdated(res.appointment);
        }
        setShowCancelModal(false);
        setSuccessOverlayMessage({
          title: 'Cancelado com sucesso!',
          subtitle: 'O horário foi liberado para outros clientes'
        });
        setSuccessOverlayAction('close_modal');
        setShowSuccessOverlay(true);

        setTimeout(() => {
          showToast(
            'success',
            'Agendamento cancelado',
            'Você receberá uma confirmação por WhatsApp'
          );
        }, 2600);

        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      } else {
        setCancelError(res.error || 'Falha ao cancelar o agendamento.');
        showToast('error', 'Não foi possível cancelar', res.error || 'Falha ao cancelar o agendamento.');
      }
    } catch (err: any) {
      console.warn('Erro ao cancelar agendamento:', err);
      setCancelError('Ocorreu um erro ao cancelar. Tente novamente.');
      showToast('error', 'Não foi possível cancelar', 'Ocorreu um erro ao cancelar. Tente novamente.');
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse';
      case 'in_queue':
        return 'bg-status-warning/20 text-[#FF8C00] border-status-warning/30';
      case 'in_service':
        return 'bg-status-success/20 text-status-success border-status-success/30';
      case 'confirmed':
        return 'bg-status-success/20 text-status-success border-status-success/30';
      case 'cancelled':
      case 'cancelado':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-surface-card text-content-muted border-border-subtle';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return '⚠️ Aguardando Aprovação (Fora do Expediente)';
      case 'in_queue':
        return '⏳ Em Fila de Espera';
      case 'in_service':
        return '✂️ Em Atendimento';
      case 'confirmed':
        return '✓ Agendamento Confirmado';
      case 'cancelled':
      case 'cancelado':
        return '❌ Agendamento Cancelado';
      default:
        return 'Status Desconhecido';
    }
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'pix':
        return 'PIX';
      case 'credit_card':
        return 'Cartão de Crédito';
      case 'debit_card':
        return 'Cartão de Débito';
      case 'pay_at_venue':
        return 'Pagar na Barbearia';
      case 'Pagamento no Local':
        return 'Pagamento no Local';
      default:
        return method || 'Presencial';
    }
  };

  return (
    <>
      {/* Main Voucher/Receipt Modal */}
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="receipt-title" tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-surface-inverse/70 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto outline-none" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <div className="w-full max-w-[380px] my-auto flex flex-col items-center animate-in zoom-in-95 duration-200">
          
          {/* VOUCHER TICKET CARD */}
          <div
            ref={receiptRef}
            className="w-full bg-surface-card text-content-base rounded-modal overflow-hidden shadow-2xl border border-[#e8e0d4] relative select-none"
          >
            {/* Watermark Background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
              <span className="font-serif text-[26px] font-bold tracking-[0.15em] text-gold-base opacity-[0.05] -rotate-[15deg] select-none whitespace-nowrap">
                NAVO PREMIUM
              </span>
            </div>

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gold-base flex items-center justify-center text-surface-base shadow-sm">
                    <Scissors className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <h2 id="receipt-title" className="text-[15px] font-semibold text-content-base">Comprovante</h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar comprovante"
                  className="w-7 h-7 rounded-full bg-[#f0ebe3] hover:bg-[#e5ddd2] flex items-center justify-center text-[#9a9188] hover:text-content-base transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Brand Strip */}
              <div className="text-center px-5 pt-4 pb-3">
                {shopProfile.logoUrl ? (
                  <div className="w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-amber-600 via-gold-base to-amber-300 mx-auto mb-2 shadow-md overflow-hidden flex items-center justify-center">
                    <img 
                      src={shopProfile.logoUrl} 
                      alt={shopProfile.name || 'Logo Barbearia'} 
                      className="w-full h-full object-cover rounded-full bg-neutral-900"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                        if (e.currentTarget.parentElement) {
                          const fb = e.currentTarget.parentElement.querySelector('.voucher-logo-fallback');
                          if (fb) fb.classList.remove('hidden');
                        }
                      }}
                    />
                    <div className="voucher-logo-fallback hidden w-full h-full bg-gold-base flex items-center justify-center text-surface-base">
                      <Scissors className="w-6 h-6 stroke-[2.5]" />
                    </div>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gold-base flex items-center justify-center text-surface-base mx-auto mb-2 shadow-[0_3px_12px_color-mix(in_srgb,var(--color-gold-base)_30%,transparent)]">
                    <Scissors className="w-5 h-5 stroke-[2.5]" />
                  </div>
                )}
                <h1 className="text-xl font-bold tracking-[0.1em] text-content-base mb-0.5 uppercase font-serif">
                  {shopProfile.name || 'NAVO PREMIUM'}
                </h1>
                <div className="text-[10px] text-content-muted tracking-[0.08em] font-mono uppercase">
                  VOUCHER #{currentApt.booking_code || currentApt.id.replace('apt_', '').substring(0, 8).toUpperCase()}
                </div>
              </div>

              {/* Status Bar */}
              <div className="flex justify-center px-5 pb-3.5">
                {currentApt.status === 'in_queue' ? (
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-[#f59e0b]/10 text-[#d97706] border border-[#f59e0b]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    Em fila de espera
                  </div>
                ) : currentApt.status === 'in_service' ? (
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-[#22c55e]/10 text-[#16a34a] border border-[#22c55e]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    Em atendimento
                  </div>
                ) : isCancelled ? (
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-[#ef4444]/10 text-[#dc2626] border border-[#ef4444]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    Agendamento Cancelado
                  </div>
                ) : currentApt.status === 'completed' ? (
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-[#22c55e]/10 text-[#16a34a] border border-[#22c55e]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    Concluído
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-[#22c55e]/10 text-[#16a34a] border border-[#22c55e]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    Confirmado
                  </div>
                )}
              </div>

              {/* Perforation Line */}
              <div className="relative my-0.5 mx-4 h-4 flex items-center justify-center">
                <div className="w-full border-t-[1.5px] border-dashed border-[#ddd5c8]" />
                <div className="absolute -left-[26px] w-[20px] h-[20px] bg-surface-inverse rounded-full" />
                <div className="absolute -right-[26px] w-[20px] h-[20px] bg-surface-inverse rounded-full" />
              </div>

              {/* Details Grid */}
              <div className="px-5 py-3.5 grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-content-muted font-semibold">Profissional</span>
                  <span className="text-[13px] font-semibold text-content-base leading-tight">{currentApt.professional_name}</span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-content-muted font-semibold">Cliente</span>
                  <span className="text-[13px] font-semibold text-content-base leading-tight">{currentApt.client_name || 'Cliente'}</span>
                  {currentApt.client_phone && (
                    <span className="text-[11px] font-normal text-[#7a7268]">{currentApt.client_phone}</span>
                  )}
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-content-muted font-semibold">Data</span>
                  <span className="text-[13px] font-semibold text-content-base capitalize leading-tight">{formatDateDisplay(currentApt.date)}</span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-content-muted font-semibold">Horário</span>
                  <span className="text-[15px] font-bold text-gold-base leading-tight">{currentApt.time_slot}</span>
                </div>

                <div className="col-span-2 flex flex-col gap-0.5 pt-0.5">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-content-muted font-semibold">Localização</span>
                  <div className="flex items-start gap-2 mt-0.5">
                    <div className="w-6.5 h-6.5 rounded-lg bg-gold-base/10 flex items-center justify-center text-gold-base shrink-0 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-content-base leading-tight">NavoClub</div>
                      <div className="text-[11px] text-[#7a7268]">Rua Fortaleza, 1420 — Expectativa, Sobral</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Perforation Line */}
              <div className="relative my-0.5 mx-4 h-4 flex items-center justify-center">
                <div className="w-full border-t-[1.5px] border-dashed border-[#ddd5c8]" />
                <div className="absolute -left-[26px] w-[20px] h-[20px] bg-surface-inverse rounded-full" />
                <div className="absolute -right-[26px] w-[20px] h-[20px] bg-surface-inverse rounded-full" />
              </div>

              {/* Services */}
              <div className="px-5 pb-3">
                <div className="text-[9px] uppercase tracking-[0.12em] text-content-muted font-semibold mb-2">
                  Serviços · {currentApt.total_duration_minutes || 60} min
                </div>
                <div className="space-y-0">
                  {(currentApt.services || []).map((service, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center py-2 border-b border-[#f0ebe3] last:border-b-0"
                    >
                      <div className="text-[13px] font-medium text-content-base flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-gold-base" />
                        {service.title}
                      </div>
                      <span className="text-[13px] font-bold text-content-base tabular-nums">
                        R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Section */}
              <div className="px-5 py-3 bg-surface-base border-t border-border-subtle">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-[#7a7268]">Subtotal</span>
                  <span className="text-xs text-[#7a7268] tabular-nums">
                    R$ {(currentApt.original_amount || currentApt.final_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {Number(currentApt.discount_amount) > 0 && (
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[11px] text-[#16a34a]">Desconto</span>
                    <span className="text-xs text-[#16a34a] font-semibold tabular-nums">
                      - R$ {Number(currentApt.discount_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[13px] font-semibold text-content-base">Total</span>
                  <span className="text-[18px] font-bold text-[#16a34a] tabular-nums">
                    R$ {Number(currentApt.final_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t-[1.5px] border-dashed border-[#ddd5c8]">
                  <span className="text-[10px] text-content-muted">Pagamento</span>
                  <span className="text-[10px] font-bold text-[#7a7268] uppercase tracking-[0.08em]">
                    {getPaymentMethodText(currentApt.payment_method)}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 text-center border-t border-border-subtle bg-surface-base">
                <p className="text-[10px] text-content-muted leading-relaxed">
                  Válido apenas para o dia e horário agendado. Chegue com 10 min de antecedência.
                </p>
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="w-full mt-3 flex flex-col gap-2">
            {/* Circular Quick Action Buttons (Single Row) */}
            <div className="flex items-center justify-center gap-3 my-1">
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                title="Baixar PDF"
                aria-label="Baixar PDF"
                className="w-11 h-11 rounded-full bg-[#e8e0d4] hover:bg-[#ddd5c8] text-[#5a5248] flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {isDownloading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
              </button>

              <a
                href={getMapsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver Localização"
                aria-label="Ver Localização"
                className="w-11 h-11 rounded-full bg-[#e8e0d4] hover:bg-[#ddd5c8] text-[#5a5248] flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
              >
                <MapPin className="w-5 h-5" />
              </a>

              <a
                href={getGoogleCalendarUrl()}
                target="_blank"
                rel="noopener noreferrer"
                title="Adicionar ao Google Agenda"
                aria-label="Adicionar ao Google Agenda"
                className="w-11 h-11 rounded-full bg-[#e8e0d4] hover:bg-[#ddd5c8] text-[#5a5248] flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
              >
                <Calendar className="w-5 h-5" />
              </a>

              <a
                href={getWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                title="Enviar via WhatsApp"
                aria-label="Enviar via WhatsApp"
                className="w-11 h-11 rounded-full bg-[#25d366] hover:bg-[#1ebd5a] text-content-inverse flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            </div>

            {currentApt.status === 'completed' && !currentApt.is_reviewed && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onReviewClick) onReviewClick();
                }}
                className="w-full flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl bg-gold-base hover:bg-gold-hover text-surface-base font-semibold text-[13px] transition-all cursor-pointer shadow-md"
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>Avaliar Serviço</span>
              </button>
            )}

            {!isCancelled && currentApt.status !== 'completed' ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRescheduleDate(currentApt?.date || '');
                    setRescheduleTimeSlot(currentApt?.time_slot || currentApt?.timeSlot || '');
                    setShowRescheduleModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[#2d2a26] hover:bg-[#1a1815] text-content-inverse font-semibold text-xs sm:text-[13px] transition-all cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Reagendar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-[#fef2f2] hover:bg-[#fee2e2] border border-[#fecaca] text-[#dc2626] font-semibold text-xs sm:text-[13px] transition-all cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Cancelar</span>
                </button>
              </div>
            ) : (
              <div className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] font-semibold text-[13px]">
                <XCircle className="w-3.5 h-3.5" />
                <span>Agendamento Cancelado</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Cancellation */}
      <ConfirmDialog
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleConfirmCancel}
        isLoading={isCancelling}
        variant="danger"
        icon={<AlertTriangle className="w-6 h-6" />}
        title="Cancelar agendamento?"
        description={`Tem certeza de que deseja cancelar este agendamento? Esta ação desmarcará seu horário e liberará a vaga para outros clientes.`}
        confirmText="Sim, Cancelar"
        cancelText="Manter Agendamento"
      />

      <SuccessOverlay
        isVisible={showSuccessOverlay}
        title={successOverlayMessage.title}
        subtitle={successOverlayMessage.subtitle}
        onClose={() => {
          setShowSuccessOverlay(false);
          if (successOverlayAction === 'close_modal') {
            onClose(); // Close the modal
          }
        }}
      />

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="reschedule-title" tabIndex={-1} className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-surface-inverse/80 backdrop-blur-sm animate-in fade-in duration-200 outline-none" onKeyDown={(e) => { if (e.key === "Escape") setShowRescheduleModal(false); }} ref={rescheduleModalRef}>
          <div className="w-full sm:w-[380px] bg-surface-card rounded-2xl border border-border-subtle shadow-2xl p-5 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 id="reschedule-title" className="text-base font-serif text-content-base font-semibold">Reagendar</h3>
              <button type="button" aria-label="Fechar reagendamento" onClick={() => setShowRescheduleModal(false)} className="p-2 -mr-2 text-content-muted hover:text-content-base rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Date Selection */}
              <div className="space-y-2">
                <label className="text-content-muted font-medium">Data do Agendamento</label>
                <div className="relative">
                  <input
                    type="date"
                    value={rescheduleDate}
                    min={todayStrBRT}
                    max={maximumRescheduleDate}
                    onChange={(e) => {
                      setRescheduleDate(e.target.value);
                      setRescheduleTimeSlot(''); // reset time when date changes
                    }}
                    className="w-full bg-surface-base border border-border-subtle rounded-xl px-4 py-3 text-content-base focus:outline-none focus:border-gold-base"
                  />
                  <Calendar className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" />
                </div>
              </div>

              {/* Time Selection */}
              <div className="space-y-2">
                <label className="text-content-muted font-medium flex items-center justify-between">
                  <span>Horários Disponíveis ({durationMinutes} min)</span>
                  {isLoadingSlots && <Loader2 className="w-3 h-3 animate-spin text-gold-base" />}
                </label>

                {isClosedOnSelectedDate ? (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs text-center font-medium">
                    A barbearia está fechada nesta data. Por favor, escolha outro dia.
                  </div>
                ) : rescheduleDate < todayStrBRT ? (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-xl text-xs text-center font-medium">
                    Selecione uma data futura para reagendar.
                  </div>
                ) : dynamicSlots.length === 0 ? (
                  <div className="p-3 bg-surface-base border border-border-subtle text-content-muted rounded-xl text-xs text-center font-medium">
                    Nenhum horário disponível para esta data.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                    {/* Morning slots */}
                    {dynamicSlots.filter((s) => timeToMinutes(s) < 720).length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-content-base uppercase tracking-wider">
                          <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Manhã</span>
                          <span className="text-[10px] text-content-muted font-normal lowercase">(Até 12h)</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {dynamicSlots.filter((s) => timeToMinutes(s) < 720).map((slotTime) => {
                            const slotMins = timeToMinutes(slotTime);
                            const isPast = rescheduleDate === todayStrBRT && slotMins <= currTimeBRT.totalMinutes;
                            const isBusy = busySlots.includes(slotTime) || isPast;
                            const isSelected = rescheduleTimeSlot === slotTime;
                            return (
                              <button
                                key={slotTime}
                                type="button"
                                disabled={isBusy}
                                onClick={() => setRescheduleTimeSlot(slotTime)}
                                className={`py-2 rounded-lg text-center font-bold text-xs transition-all border ${
                                  isSelected
                                    ? 'bg-gold-base text-surface-base border-gold-base shadow-md font-extrabold scale-[1.02]'
                                    : isBusy
                                    ? 'bg-border-subtle/50 border-transparent text-content-muted opacity-40 cursor-not-allowed line-through'
                                    : 'bg-surface-base border-border-subtle text-content-base hover:border-gold-base/50 hover:bg-surface-card'
                                }`}
                              >
                                {slotTime}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Afternoon/Evening slots */}
                    {dynamicSlots.filter((s) => timeToMinutes(s) >= 720).length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-content-base uppercase tracking-wider">
                          <Sunset className="w-3.5 h-3.5 text-gold-base shrink-0" />
                          <span>Tarde / Noite</span>
                          <span className="text-[10px] text-content-muted font-normal lowercase">(A partir das 12h)</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {dynamicSlots.filter((s) => timeToMinutes(s) >= 720).map((slotTime) => {
                            const slotMins = timeToMinutes(slotTime);
                            const isPast = rescheduleDate === todayStrBRT && slotMins <= currTimeBRT.totalMinutes;
                            const isBusy = busySlots.includes(slotTime) || isPast;
                            const isSelected = rescheduleTimeSlot === slotTime;
                            return (
                              <button
                                key={slotTime}
                                type="button"
                                disabled={isBusy}
                                onClick={() => setRescheduleTimeSlot(slotTime)}
                                className={`py-2 rounded-lg text-center font-bold text-xs transition-all border ${
                                  isSelected
                                    ? 'bg-gold-base text-surface-base border-gold-base shadow-md font-extrabold scale-[1.02]'
                                    : isBusy
                                    ? 'bg-border-subtle/50 border-transparent text-content-muted opacity-40 cursor-not-allowed line-through'
                                    : 'bg-surface-base border-border-subtle text-content-base hover:border-gold-base/50 hover:bg-surface-card'
                                }`}
                              >
                                {slotTime}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-base border border-border-subtle flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-content-muted text-xs">Serviços mantidos</span>
                <span className="text-content-base font-bold text-xs">{currentApt?.services?.length || 1} serviço(s) ({durationMinutes} min)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-content-muted text-xs">Diferença de valor</span>
                <span className="text-status-success font-bold text-xs">R$ 0,00</span>
              </div>
              <p className="text-[10px] text-content-muted mt-1 opacity-70">O valor original foi mantido para este reagendamento.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setShowRescheduleModal(false)}
                disabled={isRescheduling}
                className="py-3 rounded-xl bg-surface-card hover:bg-neutral-700 text-content-base font-bold transition-all disabled:opacity-50"
              >
                Voltar
              </button>
              <LoadingButton
                onClick={handleConfirmReschedule}
                isLoading={isRescheduling}
                disabled={isRescheduling || !rescheduleDate || !rescheduleTimeSlot || isClosedOnSelectedDate || rescheduleDate < todayStrBRT || rescheduleDate > maximumRescheduleDate}
                className="py-3 rounded-xl bg-gold-base hover:bg-gold-hover text-surface-base font-bold transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
                loadingText="Salvando..."
              >
                Confirmar
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
