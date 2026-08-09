import React, { useState, useEffect, useRef } from 'react';
import { ServiceItem, Professional, Appointment } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { hapticLight, hapticMedium, hapticSuccess } from '../../lib/haptics';
import { trackEvent } from '../../lib/analytics';

import { createAppointmentInSupabase, fetchServicesFromSupabase, fetchProfessionalsFromSupabase } from '../../services/supabaseDataService';
import { BookingSummaryCard } from './BookingSummaryCard';
import { BookingStep1Services } from './BookingStep1Services';
import { BookingStep2Barbers } from './BookingStep2Barbers';
import { BookingStep3DateTime } from './BookingStep3DateTime';
import { BookingStep4Review } from "./BookingStep4Review";
import { BookingStep5Confirmation } from "./BookingStep5Confirmation";
import { ClientSubscriptions } from './ClientSubscriptions';
import { ClientLoyalty } from './ClientLoyalty';
import { ClientAppointments } from './ClientAppointments';
import { ClientProfileModal } from './ClientProfileModal';
import { ClientLoginModal } from './ClientLoginModal';
import { PaymentChoiceModal } from './PaymentChoiceModal';
import { GuestSignupPromptModal } from './GuestSignupPromptModal';
import { LandingPage } from './LandingPage';
import { ClientMoreDrawer } from './ClientMoreDrawer';
import { PWAInstallModal } from '../pwa/PWAInstallModal';
import { PullToRefreshIndicator } from '../shared/PullToRefreshIndicator';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useTheme } from '../../contexts/ThemeContext';
import { Calendar, Crown, Award, Clock, Home, Menu, Smartphone, User, Sparkles, Scissors, Loader2, Sun, Moon, CheckCircle2, Info, AlertTriangle, Sliders, Download } from 'lucide-react';

import { authFetch } from '../../lib/api';

export const ClientApp: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [isAppInitializing, setIsAppInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'booking' | 'subscriptions' | 'loyalty' | 'appointments'>('home');
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState<number>(1);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalView, setLoginModalView] = useState<'login' | 'register'>('login');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);
  const [showGuestSignupPrompt, setShowGuestSignupPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Pull-to-refresh: força recarregar dados em cache e remonta a aba de agendamentos
  const mainRef = useRef<HTMLElement | null>(null);
  // Na aba "home" o <main> usa overflow-hidden — quem rola de verdade é o
  // snap-scroll interno da LandingPage, então precisamos da ref dele para
  // o pull-to-refresh saber quando o usuário está realmente no topo.
  const landingScrollRef = useRef<HTMLElement | null>(null);
  const [appointmentsRefreshKey, setAppointmentsRefreshKey] = useState(0);

  // Toast Notification System State
  const [toast, setToast] = useState<{ id: number; message: string; type?: 'success' | 'info' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    hapticLight();
    setToast({ id: Date.now(), message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Touch Swipe Gesture Handling
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    // Check URL for referral code ?ref=NAV-XXX
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    if (refCode) {
      showToast(`Código de indicação ${refCode.toUpperCase()} ativado! Cadastre-se para ganhar 50 pontos bônus.`, 'info');
    }

    // Pre-fetch services and professionals in background for instant UI rendering
    fetchServicesFromSupabase();
    fetchProfessionalsFromSupabase();

    const timer = setTimeout(() => {
      setIsAppInitializing(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);
  
  const [isGuest, setIsGuest] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>({ id: 'guest', name: 'Visitante', role: 'guest', loyalty_points: 0, loyalty_tier: 'Bronze' });
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
  
  useEffect(() => {
    // Sync current user profile from server if logged in
    if (!isGuest && currentUser && currentUser.id !== 'guest') {
      authFetch('/api/auth/me')
        .then(res => res.ok ? res.json() : null)
        .then(me => {
          if (me && me.id) {
            setCurrentUser(me);
          }
        })
        .catch(() => {});
    }

  }, [isGuest]);



  // Booking Flow State
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [totalPaid, setTotalPaid] = useState<number>(0);
  const [createdBookingCode, setCreatedBookingCode] = useState<string>('');
  const [reviewDetails, setReviewDetails] = useState({ loyaltyDiscount: 0, couponDiscount: 0 });
  // O histórico é sempre carregado da API; este estado contém apenas a resposta da sessão atual.
  const [userCreatedAppointments, setUserCreatedAppointments] = useState<Appointment[]>([]);
  const [isConfirmingBooking, setIsConfirmingBooking] = useState(false);

  const handleToggleService = (service: ServiceItem) => {
    hapticLight();
    setSelectedServices(prev => {
      const exists = prev.some(s => s.id === service.id);
      if (exists) {
        showToast(`Serviço "${service.title}" removido`, 'info');
        return prev.filter(s => s.id !== service.id);
      } else {
        showToast(`Serviço "${service.title}" selecionado!`, 'success');
        return [...prev, service];
      }
    });
  };

  const handleConfirmBooking = async (paymentDetails: { method: string; loyaltyDiscount: number; totalPaid: number; clientName?: string; clientPhone?: string }) => {
    hapticSuccess();
    setIsConfirmingBooking(true);
    setTotalPaid(paymentDetails.totalPaid);

    const clientName = paymentDetails.clientName || currentUser.name || 'Cliente';
    const clientPhone = paymentDetails.clientPhone || currentUser.phone || '';
    const generatedVoucher = `BRX-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Create appointment object
    const newApt: Appointment = {
      id: `apt_${Date.now()}`,
      booking_code: generatedVoucher,
      client_id: currentUser.id || `guest_${Date.now()}`,
      client_name: clientName,
      client_phone: clientPhone,
      professional_id: selectedBarber?.id || 'prof_1',
      professional_name: selectedBarber?.name || 'Carlos Silva',
      services: selectedServices,
      total_duration_minutes: selectedServices.reduce((a, b) => a + b.duration_minutes, 0),
      original_amount: selectedServices.reduce((a, b) => a + b.price, 0),
      discount_amount: paymentDetails.loyaltyDiscount,
      final_amount: paymentDetails.totalPaid,
      loyalty_points_used: paymentDetails.loyaltyDiscount > 0 ? 200 : 0,
      date: selectedDate,
      time_slot: selectedTimeSlot,
      status: 'in_queue',
      payment_method: paymentDetails.method as any,
      created_at: new Date().toISOString()
    };

    try {
      // Save into real Supabase Database
      const savedApt = await createAppointmentInSupabase(newApt);
      const finalVoucherCode = savedApt.booking_code || generatedVoucher;
      setCreatedBookingCode(finalVoucherCode);

      setUserCreatedAppointments(prev => [savedApt, ...prev]);
      trackEvent('funnel_step', 'booking', 'step5_confirmed');
      trackEvent('funnel_step', 'booking', `payment_${paymentDetails.method}`);
      showToast('Agendamento realizado com sucesso!', 'success');
      setBookingStep(5);
    } catch (error) {
      console.warn("Error creating appointment:", error);
      const message = error instanceof Error && error.message
        ? error.message
        : 'Erro ao confirmar agendamento. Tente novamente.';
      showToast(message, 'warning');
    } finally {
      setIsConfirmingBooking(false);
    }
  };


  const executeResetBooking = () => {
    setBookingStep(1);
    setSelectedServices([]);
    setSelectedBarber(null);
    setSelectedDate('');
    setSelectedTimeSlot('');
    setTotalPaid(0);
  };

  // Step & Tab Transition Loading States
  const [isChangingStep, setIsChangingStep] = useState(false);
  const [stepLoadingMessage, setStepLoadingMessage] = useState('Carregando...');
  const [isChangingTab, setIsChangingTab] = useState(false);
  const [tabLoadingMessage, setTabLoadingMessage] = useState('Carregando...');

  const bookingStepLabels: Record<number, string> = {
    1: 'step1_services',
    2: 'step2_barber',
    3: 'step3_datetime',
    4: 'step4_review'
  };

  const goToStep = (targetStep: number, message?: string) => {
    if (targetStep > bookingStep && bookingStepLabels[targetStep]) {
      trackEvent('funnel_step', 'booking', bookingStepLabels[targetStep]);
    }
    setIsChangingStep(true);
    setStepLoadingMessage(
      message ||
      (targetStep === 2 ? 'Carregando equipe de barbeiros...' :
       targetStep === 3 ? 'Buscando disponibilidade da agenda...' :
       targetStep === 4 ? 'Preparando resumo do agendamento...' :
       targetStep === 1 ? 'Retornando à seleção de serviços...' : 'Carregando próxima etapa...')
    );
    setTimeout(() => {
      setBookingStep(targetStep);
      setIsChangingStep(false);
    }, 280);
  };

  const { pullDistance, isRefreshing, handlers: pullToRefreshHandlers } = usePullToRefresh(
    activeTab === 'home' ? landingScrollRef : mainRef,
    {
      enabled: !isChangingTab && !isChangingStep,
      onRefresh: async () => {
        await Promise.allSettled([
          fetchServicesFromSupabase(true),
          fetchProfessionalsFromSupabase(true),
        ]);
        if (activeTab === 'appointments') {
          setAppointmentsRefreshKey((k) => k + 1);
        }
      },
    }
  );

  const handleTabChange = (tabId: 'home' | 'booking' | 'appointments' | 'more') => {
    hapticLight();
    
    // Proteção: se está no meio do booking e vai sair
    if (activeTab === 'booking' && bookingStep >= 1 && bookingStep <= 4 && tabId !== 'booking') {
      if (selectedServices.length > 0 || selectedBarber || selectedDate) {
        const confirmLeave = window.confirm(
          'Você tem um agendamento em andamento. Se sair, perderá o progresso. Deseja continuar?'
        );
        if (!confirmLeave) return;
        executeResetBooking();
      }
    }
    
    // Se clica em "Agendar" e já confirmou, reseta para novo agendamento
    if (tabId === 'booking' && bookingStep > 4) {
      executeResetBooking();
    }
    
    // Se clica em "Mais", abre o drawer em vez de mudar tab
    if (tabId === 'more') {
      setIsMoreDrawerOpen(true);
      return;
    }
    
    if (tabId !== activeTab) {
      setActiveTab(tabId);
    }
  };

  const handleStartBookingWithService = (service?: ServiceItem) => {
    hapticLight();
    if (service) {
      setSelectedServices([service]);
      if (selectedBarber) {
        setBookingStep(3);
        showToast(`Serviço "${service.title}" selecionado! Profissional já definido.`, 'success');
      } else {
        setBookingStep(2);
        showToast(`Serviço "${service.title}" selecionado! Escolha o profissional.`, 'success');
      }
    } else {
      setSelectedServices([]);
      setBookingStep(1);
    }
    setActiveTab('booking');
  };

  const handleBookingFinished = (action: () => void) => {
    if (isGuest) {
      setPendingAction(() => action);
      setShowGuestSignupPrompt(true);
    } else {
      action();
    }
  };

  const handleGuestSignupAccept = () => {
    setShowGuestSignupPrompt(false);
    setLoginModalView('register');
    setIsLoginModalOpen(true);
  };

  const handleGuestSignupDecline = () => {
    setShowGuestSignupPrompt(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  if (isAppInitializing) {
    return (
      <div className="flex-1 bg-surface-base flex flex-col items-center justify-center p-6 space-y-4 animate-in fade-in duration-200 select-none">
        <div className="w-16 h-16 rounded-2xl bg-gold-base text-surface-base flex items-center justify-center text-surface-base shadow-2xl shadow-[0_0_30px_rgba(201,169,110,0.3)] animate-pulse">
          <Scissors className="w-9 h-9 stroke-[2.5]" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-lg font-serif text-content-base font-semibold uppercase tracking-widest">BARBERX</h2>
          <p className="text-xs text-content-muted font-medium flex items-center justify-center space-x-1.5">
            <Loader2 className="w-3.5 h-3.5 text-gold-base animate-spin" />
            <span>Carregando experiência...</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center bg-surface-base w-full flex-1 overflow-hidden relative">
      {/* Skip Link for Keyboard Accessibility */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-gold-base focus:text-surface-base focus:font-extrabold focus:rounded-xl focus:shadow-2xl focus:outline-none"
      >
        Pular para o conteúdo principal
      </a>

      {/* Web App View */}
      <div className="w-full max-w-3xl lg:max-w-4xl bg-surface-base flex flex-col flex-1 relative overflow-hidden shadow-2xl mx-auto">

        {/* Client App Header (hidden on home/landing page) */}
        {activeTab !== 'home' && (
          <header className="px-4 sm:px-6 py-2.5 sm:py-4 flex justify-between items-center bg-transparent z-10 shrink-0">
            <div className="flex items-center gap-3">
              {isGuest ? (
                <button 
                  onClick={() => {
                    setLoginModalView('login');
                    setIsLoginModalOpen(true);
                  }}
                  className="flex items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-gold-base rounded-xl px-2 py-1 -ml-2 transition-all hover:bg-border-subtle"
                >
                  <div className="w-10 h-10 rounded-full bg-surface-card flex items-center justify-center border border-border-subtle">
                    <User className="w-5 h-5 text-content-muted" />
                  </div>
                  <div>
                    <h1 className="text-sm font-semibold text-content-base">Olá, Visitante</h1>
                    <p className="text-[10px] text-content-muted">Acesse seus benefícios</p>
                  </div>
                </button>
              ) : (
                <button 
                  onClick={() => setIsProfileModalOpen(true)}
                  className="relative rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-base active:scale-95 transition-transform flex items-center gap-3 px-2 py-1 -ml-2 hover:bg-border-subtle"
                >
                  <img
                    src={currentUser.avatar_url || currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=75&w=150'}
                    alt={currentUser.name}
                    className="w-10 h-10 rounded-full object-cover border border-content-base"
                  />
                  <div className="text-left">
                    <h1 className="text-sm font-semibold text-content-base">Olá, {currentUser.name}</h1>
                    <span className="text-[10px] font-bold bg-gradient-to-r from-content-base to-content-base bg-clip-text text-transparent flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-gold-base" />
                      <span>{currentUser.loyalty_points || 0} Pts • {currentUser.loyalty_tier || 'Bronze'}</span>
                    </span>
                  </div>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Theme Toggle Button in Header */}
              <button
                onClick={() => {
                  hapticLight();
                  setTheme(theme === 'dark' ? 'light' : 'dark');
                }}
                title={theme === 'dark' ? 'Tema Escuro' : 'Tema Claro'}
                aria-label="Alternar tema"
                className="p-2 rounded-xl text-content-base hover:text-content-base transition-all active:scale-95 flex items-center justify-center shrink-0"
              >
                {theme === 'dark' ? (
                  <Moon className="w-5 h-5 text-gold-base" />
                ) : (
                  <Sun className="w-5 h-5 text-gold-base" />
                )}
              </button>

              {/* Install PWA Button in Header */}
              <button
                onClick={() => setIsPwaModalOpen(true)}
                title="Instalar App"
                aria-label="Instalar App"
                className="p-2 rounded-xl text-content-base hover:text-content-base transition-all active:scale-95 flex items-center justify-center shrink-0"
              >
                <Download className="w-5 h-5 text-gold-base" />
              </button>

            </div>
          </header>
        )}

        {/* Floating Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute top-16 left-4 right-4 z-[90] pointer-events-none flex justify-center"
            >
              <div className={`px-4 py-2.5 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-center gap-2.5 max-w-sm text-xs font-bold ${
                toast.type === 'success'
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40 shadow-emerald-950/30'
                  : toast.type === 'warning'
                    ? 'bg-amber-950/90 text-amber-300 border-amber-500/40 shadow-amber-950/30'
                    : 'bg-surface-card/95 text-gold-base border-gold-base/40 shadow-black/50'
              }`}>
                {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
                {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />}
                {toast.type === 'info' && <Sparkles className="w-4 h-4 shrink-0 text-gold-base" />}
                <span>{toast.message}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area with Swipe Gesture */}
        <main
          ref={mainRef}
          id="main-content"
          className={`flex-1 min-h-0 ${activeTab === 'home' ? 'overflow-hidden' : 'overflow-y-auto no-scrollbar'} outline-none flex flex-col`}
          tabIndex={-1}
          onTouchStart={pullToRefreshHandlers.onTouchStart}
          onTouchMove={pullToRefreshHandlers.onTouchMove}
          onTouchEnd={pullToRefreshHandlers.onTouchEnd}
        >
          <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
          {/* Loading transition indicator when changing tab or step */}
          {(isChangingTab || isChangingStep) ? (
            <div className="flex-1 min-h-[60vh] px-6 my-auto flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="w-16 h-16 rounded-2xl bg-gold-base/15 border border-gold-base/30 text-gold-base flex items-center justify-center shadow-xl shadow-gold-base/10 animate-pulse">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-extrabold text-content-base tracking-wide">
                  {isChangingTab ? tabLoadingMessage : stepLoadingMessage}
                </p>
                <p className="text-xs text-content-muted">
                  Aguarde um instante...
                </p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'home' && (
                <LandingPage
                  onGoToBooking={handleStartBookingWithService}
                  onGoToAppointments={() => handleTabChange('appointments')}
                  isGuest={isGuest}
                  currentUser={currentUser}
                  onOpenLogin={() => {
                    setLoginModalView('login');
                    setIsLoginModalOpen(true);
                  }}
                  onOpenProfile={() => setIsProfileModalOpen(true)}
                  scrollContainerRef={landingScrollRef}
                />
              )}

              {activeTab === 'booking' && (
                <>
                  {bookingStep >= 2 && bookingStep <= 4 && (
                    <div className="sticky top-0 z-40 bg-surface-base px-4 pt-3 pb-2 border-b border-border-subtle shadow-md">
                      <div className="flex justify-between items-end mb-1.5">
                        <h1 className="text-lg font-extrabold text-content-base">
                          {bookingStep === 2 && "Com quem?"}
                          {bookingStep === 3 && "Quando?"}
                          {bookingStep === 4 && "Revise e Confirme"}
                        </h1>
                        <span className="text-[10px] text-content-muted font-medium">
                          PASSO {bookingStep} DE 4
                        </span>
                      </div>
                      <div className="w-full h-1 bg-surface-card rounded-full overflow-hidden">
                        <div className={`h-full bg-gold-base text-surface-base transition-all duration-300 ${
                          bookingStep === 2 ? 'w-2/4' : 
                          bookingStep === 3 ? 'w-3/4' : 
                          'w-full'
                        }`}></div>
                      </div>
                    </div>
                  )}
                  {/* Steps rendering */}

                  {bookingStep === 1 && (
                    <BookingStep1Services
                      selectedServices={selectedServices}
                      onToggleService={handleToggleService}
                      onClearServices={() => setSelectedServices([])}
                      onNext={() => {
                        if (selectedBarber) {
                          goToStep(3, 'Buscando horários na agenda...');
                        } else {
                          goToStep(2, 'Carregando barbeiros disponíveis...');
                        }
                      }}
                    />
                  )}
                  {bookingStep === 2 && (
                    <BookingStep2Barbers
                      selectedServices={selectedServices}
                      selectedBarber={selectedBarber}
                      selectedDate={selectedDate}
                      selectedTimeSlot={selectedTimeSlot}
                      onSelectBarber={setSelectedBarber}
                      onBack={() => goToStep(1, 'Retornando para serviços...')}
                      onNext={() => goToStep(3, 'Buscando horários na agenda...')}
                    />
                  )}
                  {bookingStep === 3 && (
                    <BookingStep3DateTime
                      selectedServices={selectedServices}
                      selectedBarber={selectedBarber}
                      selectedDate={selectedDate}
                      selectedTimeSlot={selectedTimeSlot}
                      onSelectDate={setSelectedDate}
                      onSelectTimeSlot={setSelectedTimeSlot}
                      onBack={() => goToStep(2, 'Retornando para equipe...')}
                      onNext={() => goToStep(4, 'Preparando resumo...')}
                    />
                  )}
                  {bookingStep === 4 && (
                    <BookingStep4Review
                      selectedServices={selectedServices}
                      selectedBarber={selectedBarber}
                      selectedDate={selectedDate}
                      selectedTimeSlot={selectedTimeSlot}
                      userProfile={currentUser}
                      isGuest={isGuest}
                      isSubmitting={isConfirmingBooking}
                      onConfirmReview={(details) => {
                        setReviewDetails(details);
                        handleConfirmBooking({ 
                          method: 'in_store',
                          clientName: details.clientName,
                          clientPhone: details.clientPhone,
                          loyaltyDiscount: details.loyaltyDiscount,
                          totalPaid: Math.max(0, selectedServices.reduce((a, b) => a + b.price, 0) - details.loyaltyDiscount - details.couponDiscount)
                        });
                      }}
                      onCancel={() => {
                        goToStep(1, 'Reiniciando agendamento...');
                        setSelectedServices([]);
                        setSelectedBarber(null);
                        setSelectedDate('');
                        setSelectedTimeSlot('');
                      }}
                    />
                  )}
                  {bookingStep === 5 && (
                    <BookingStep5Confirmation
                      selectedServices={selectedServices}
                      selectedBarber={selectedBarber}
                      selectedDate={selectedDate}
                      selectedTimeSlot={selectedTimeSlot}
                      totalPaid={totalPaid}
                      bookingCode={createdBookingCode}
                      onResetBooking={() => handleBookingFinished(executeResetBooking)}
                      onViewAppointments={() => handleBookingFinished(() => {
                        executeResetBooking();
                        setActiveTab('appointments');
                      })}
                    />
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'subscriptions' && <ClientSubscriptions />}
          {activeTab === 'loyalty' && <ClientLoyalty currentUser={currentUser} />}
          {activeTab === 'appointments' && (
            <ClientAppointments 
              key={appointmentsRefreshKey}
              customAppointments={userCreatedAppointments} 
              isGuest={isGuest} 
              currentUser={currentUser} 
              onGoToBooking={() => handleTabChange('booking')}
            />
          )}
        </main>

        {/* Bottom Navigation */}
        {activeTab !== 'home' && (
          <div className="bg-surface-base border-t border-border-subtle px-2 py-1.5 flex justify-around items-center pb-safe shrink-0 z-30">
            {[
              { id: 'home' as const, label: 'Início', icon: Home },
              { id: 'booking' as const, label: 'Agendar', icon: Calendar },
              { id: 'appointments' as const, label: 'Meus Cortes', icon: Clock },
              { id: 'more' as const, label: 'Mais', icon: Menu },
            ].map((tab) => {
              const isActive = activeTab === tab.id || (tab.id === 'more' && (activeTab === 'subscriptions' || activeTab === 'loyalty'));
              const Icon = tab.icon;
              const upcomingBadgeCount = userCreatedAppointments.length || (isGuest ? 0 : 1);
              
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-1.5 sm:py-2 rounded-lg transition-all duration-200 select-none ${
                    isActive 
                      ? 'text-gold-base font-bold' 
                      : 'text-content-muted hover:text-content-base font-medium'
                  }`}
                >
                  {/* Pill indicador superior */}
                  {isActive && (
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gold-base rounded-full shadow-[0_0_8px_rgba(201,169,110,0.8)]" />
                  )}
                  
                  {/* Badge de notificação (só em Meus Cortes) */}
                  {tab.id === 'appointments' && upcomingBadgeCount > 0 && !isActive && (
                    <div className="absolute top-1 right-3 sm:right-6 w-3.5 h-3.5 bg-gold-base text-surface-base font-black text-[8px] rounded-full flex items-center justify-center shadow-md">
                      {upcomingBadgeCount}
                    </div>
                  )}
                  
                  <Icon className="w-5 h-5 relative z-10" strokeWidth={isActive ? 2.5 : 2} />
                  <span className={`text-[10px] relative z-10 ${isActive ? 'font-black' : 'font-medium'}`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ClientMoreDrawer
        isOpen={isMoreDrawerOpen}
        onClose={() => setIsMoreDrawerOpen(false)}
        currentUser={currentUser}
        isGuest={isGuest}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenSubscriptions={() => setActiveTab('subscriptions')}
        onOpenLoyalty={() => setActiveTab('loyalty')}
        onOpenLogin={() => {
          setLoginModalView('login');
          setIsLoginModalOpen(true);
        }}
        onLogout={() => {
          setUserCreatedAppointments([]);
          setIsGuest(true);
          setCurrentUser({ id: `guest_${Date.now()}`, name: 'Visitante', role: 'guest', loyalty_points: 0, loyalty_tier: 'Bronze' });
        }}
        onOpenInstall={() => setIsPwaModalOpen(true)}
      />

      <ClientProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userProfile={currentUser}
        onLogout={() => {
          setUserCreatedAppointments([]);
          setIsGuest(true);
          setCurrentUser({ id: `guest_${Date.now()}`, name: 'Visitante', role: 'guest', loyalty_points: 0, loyalty_tier: 'Bronze' });
          setIsProfileModalOpen(false);
        }}
        onUpdateProfile={async (updates) => {
          try {
            const updated = { ...currentUser, ...updates };
            setCurrentUser(updated);
          } catch (e) {
            console.warn(e);
          }
        }}
      />

      <ClientLoginModal
        isOpen={isLoginModalOpen}
        initialView={loginModalView}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(user) => {
          setIsLoginModalOpen(false);
          setIsGuest(false);
          setCurrentUser(user);
          if (user.role === 'admin') {
            window.location.href = '/admin';
            return;
          }
          if (pendingAction) {
            const action = pendingAction;
            setPendingAction(null);
            action();
          }
        }}
      />

      <GuestSignupPromptModal
        isOpen={showGuestSignupPrompt}
        onClose={handleGuestSignupDecline}
        onAccept={handleGuestSignupAccept}
        onDecline={handleGuestSignupDecline}
      />

      <PaymentChoiceModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onPayNow={() => {
          setIsPaymentModalOpen(false);
          setBookingStep(4);
        }}
        onPayLater={() => {
          setIsPaymentModalOpen(false);
          const totalAmount = selectedServices.reduce((a, b) => a + b.price, 0);
          handleConfirmBooking({
            method: 'Pagamento no Local',
            loyaltyDiscount: 0,
            totalPaid: totalAmount
          });
        }}
      />

      <PWAInstallModal
        isOpen={isPwaModalOpen}
        onClose={() => setIsPwaModalOpen(false)}
        onShowToast={showToast}
      />
    </div>
  );
};
