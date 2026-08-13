import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { ServiceItem } from '../../types';
import { TermsAndPrivacyModal } from '../shared/TermsAndPrivacyModal';
import { 
  ShopProfile, 
  defaultShopProfile, 
  fetchShopProfile, 
  daysOfWeekMap 
} from '../../services/shopProfileService';
import { fetchServicesFromSupabase, fetchPublicReviews } from '../../services/supabaseDataService';
import { openWhatsAppDirect, openMapsDirect, openWazeDirect, openInstagramDirect, getShopStatusInfo } from '../../utils/externalLinks';
import { 
  Clock, 
  MapPin, 
  Star, 
  Scissors, 
  CalendarCheck, 
  Award, 
  Snowflake, 
  Coffee, 
  Wifi, 
  Car, 
  MessageCircle, 
  Navigation,
  Compass,
  ExternalLink,
  Phone,
  Instagram,
  ArrowUp,
  ArrowRight,
  ArrowLeft,
  List,
  Menu,
  X,
  User,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  ZoomIn,
  Sparkles,
  Sun,
  Moon
} from 'lucide-react';
import { hapticMedium, hapticLight } from '../../lib/haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { trackEvent } from '../../lib/analytics';
import { authFetch } from '../../lib/api';
import { optimizeImageUrl } from '../../lib/imageUtils';
import { 
  getTodayStringBRT, 
  getCurrentTimeBRT, 
  timeToMinutes, 
  minutesToTime, 
  getDayOfWeekKey,
  addDaysBRT
} from '../../utils/dateUtils';

interface LandingPageProps {
  onGoToBooking: (service?: any) => void;
  onGoToAppointments?: () => void;
  isGuest?: boolean;
  currentUser?: any;
  onOpenLogin?: () => void;
  onOpenProfile?: () => void;
  onOpenMenu: () => void;
  /** Recebe a referência do container real de scroll (snap-scroll de seções), usado pelo pull-to-refresh do componente pai. */
  scrollContainerRef?: React.MutableRefObject<HTMLElement | null>;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGoToBooking, onGoToAppointments, isGuest = true, currentUser, onOpenLogin, onOpenProfile, onOpenMenu, scrollContainerRef }) => {
  const { theme, setTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const finalCtaRef = useRef<HTMLDivElement>(null);
  const [isFinalCtaVisible, setIsFinalCtaVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsFinalCtaVisible(entry.isIntersecting);
      },
      { root: containerRef.current, threshold: 0.1 }
    );
    if (finalCtaRef.current) {
      observer.observe(finalCtaRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Expõe o container de scroll interno (a landing page rola dentro de si mesma,
  // com snap-scroll por seção) para o pai identificar corretamente o topo real.
  useEffect(() => {
    if (scrollContainerRef) {
      scrollContainerRef.current = containerRef.current;
    }
    return () => {
      if (scrollContainerRef) scrollContainerRef.current = null;
    };
  }, [scrollContainerRef]);
  const [activeCategory, setActiveCategory] = useState<'todos' | 'cabelo' | 'barba'>('todos');
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [termsPrivacyTab, setTermsPrivacyTab] = useState<'terms' | 'privacy' | null>(null);
  const [isHoursModalOpen, setIsHoursModalOpen] = useState(false);
  const [shopProfile, setShopProfile] = useState<ShopProfile>(defaultShopProfile);
  const [dbServices, setDbServices] = useState<ServiceItem[]>([]);
  const [publicReviews, setPublicReviews] = useState<any[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    fetchShopProfile().then(data => {
      if (isMounted && data) setShopProfile(data);
    });

    const loadServices = async () => {
      try {
        const data = await fetchServicesFromSupabase(true);
        if (!isMounted) return;
        const services = Array.isArray(data) ? data : [];
        setDbServices(services);
        if (services.length === 0) {
          retryTimer = setTimeout(async () => {
            const retryData = await fetchServicesFromSupabase(true).catch(() => []);
            if (isMounted) setDbServices(Array.isArray(retryData) ? retryData : []);
          }, 800);
        }
      } catch {
        if (isMounted) setDbServices([]);
      }
    };

    loadServices();
    fetchPublicReviews()
      .then(data => { if (isMounted) setPublicReviews(Array.isArray(data) ? data : []); })
      .catch(() => { if (isMounted) setPublicReviews([]); });

    return () => {
      isMounted = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  const toggleMenu = () => {
    hapticLight();
    onOpenMenu();
  };

  const toggleHoursModal = () => {
    hapticLight();
    setIsHoursModalOpen(prev => !prev);
  };

  const scrollToSection = (index: number) => {
    hapticLight();
    if (containerRef.current) {
      const sections = containerRef.current.querySelectorAll('section');
      if (sections[index]) {
        sections[index].scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const scrollToTop = () => {
    scrollToSection(0);
  };

  const [nextAvailableTimeSlot, setNextAvailableTimeSlot] = useState<string>('');

  const scheduleSummary = useMemo(() => {
    if (!shopProfile || !shopProfile.operatingSchedule) return 'Ter-Sáb: 09:00 às 20:00';
    
    const days = [
      { key: 'monday', label: 'Seg' },
      { key: 'tuesday', label: 'Ter' },
      { key: 'wednesday', label: 'Qua' },
      { key: 'thursday', label: 'Qui' },
      { key: 'friday', label: 'Sex' },
      { key: 'saturday', label: 'Sáb' },
      { key: 'sunday', label: 'Dom' }
    ] as const;

    const activeDays = days.filter(d => shopProfile.operatingSchedule[d.key]?.active);
    if (activeDays.length === 0) return 'Fechado temporariamente';

    const groups: Array<{ startIndex: number; endIndex: number; open: string; close: string }> = [];
    activeDays.forEach((day) => {
      const schedule = shopProfile.operatingSchedule[day.key];
      if (!schedule) return;
      const dayIndex = days.findIndex(item => item.key === day.key);
      const previous = groups[groups.length - 1];
      if (previous && dayIndex === previous.endIndex + 1 && previous.open === schedule.open && previous.close === schedule.close) {
        previous.endIndex = dayIndex;
      } else {
        groups.push({ startIndex: dayIndex, endIndex: dayIndex, open: schedule.open, close: schedule.close });
      }
    });

    return groups.map((group) => {
      const startLabel = days[group.startIndex].label;
      const endLabel = days[group.endIndex].label;
      const rangeLabel = group.startIndex === group.endIndex ? startLabel : `${startLabel} a ${endLabel}`;
      return `${rangeLabel}: ${group.open} às ${group.close}`;
    }).join(' · ');
  }, [shopProfile]);

  useEffect(() => {
    let isMounted = true;
    async function calculateNextAvailableSlot() {
      try {
        const res = await authFetch('/api/availability/next');
        if (res.ok) {
          const data = await res.json();
          if (data.nextAvailableTimeSlot && isMounted) {
            // Data vem no formato YYYY-MM-DDTHH:mm
            const [dateStr, timeStr] = data.nextAvailableTimeSlot.split('T');
            const todayStr = getTodayStringBRT();
            
            if (dateStr === todayStr) {
              setNextAvailableTimeSlot(timeStr);
            } else {
              const futDayKey = getDayOfWeekKey(dateStr);
              const dayItem = daysOfWeekMap.find(item => item.key === futDayKey);
              let dayLabel = 'Próximo';
              
              if (addDaysBRT(todayStr, 1) === dateStr) {
                dayLabel = 'Amanhã';
              } else if (dayItem) {
                dayLabel = dayItem.label.split('-')[0].trim();
              }
              
              setNextAvailableTimeSlot(`${dayLabel} ${timeStr}`);
            }
          }
        }
      } catch (e) {
        console.warn('Erro ao obter disponibilidade para landing page:', e);
      }
    }

    calculateNextAvailableSlot();
    return () => { isMounted = false; };
  }, []);

  // A landing page não possui catálogo local: banco vazio significa galeria vazia.
  const servicesToDisplay = dbServices;

  const filteredServices = servicesToDisplay.filter(s => {
    if (activeCategory === 'todos') return true;
    const cat = `${s.category_id || ''} ${s.title || ''} ${s.description || ''}`.toLowerCase();
    if (activeCategory === 'cabelo') return cat.includes('cabelo') || cat.includes('corte');
    if (activeCategory === 'barba') return cat.includes('barba');
    return true;
  });

  const differentials = [
    { icon: Scissors, label: 'Serviços reais', desc: 'Catálogo atualizado da Navo', strokeColor: 'var(--color-gold-deep)', bgColor: 'color-mix(in srgb, var(--color-gold-base) 14%, transparent)' },
    { icon: User, label: 'Equipe disponível', desc: 'Escolha o profissional no fluxo', strokeColor: '#80b6c6', bgColor: '#e3f4f8' },
    { icon: CalendarCheck, label: 'Agenda em tempo real', desc: 'Horários conforme a disponibilidade', strokeColor: '#9e795a', bgColor: '#f5efe9' },
    { icon: MessageCircle, secondaryIcon: Check, secondaryColor: '#4ade80', label: 'Confirmação clara', desc: 'Comprovante após o agendamento', strokeColor: '#c1877f', bgColor: '#faece9' }
  ];

  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState<number | null>(null);

  const galleryFeaturedItems = useMemo(() => {
    const list = dbServices.filter(s => Boolean(s.popular || s.is_popular || s.badge || s.is_featured || s.isFeatured || s.is_combo));
    const services = list.length > 0 ? list : dbServices;
    return services.slice(0, 3).map((service, idx) => ({
      service,
      id: service.id || `db_service_${idx}`,
      title: service.title || 'Serviço',
      price: Number(service.price || 0),
      duration: Number(service.duration_minutes || service.duration || 0),
      description: service.description || '',
      badge: service.badge || (service.is_combo ? 'Combo Especial' : (service.popular || service.is_popular) ? 'Mais Vendido' : ''),
      src: service.image || service.image_url || (Array.isArray(service.gallery_urls) ? service.gallery_urls[0] : '') || ''
    }));
  }, [dbServices]);

  useEffect(() => {
    if (selectedGalleryIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setSelectedGalleryIndex(prev => (prev !== null && prev > 0 ? prev - 1 : galleryFeaturedItems.length - 1));
      } else if (e.key === 'ArrowRight') {
        setSelectedGalleryIndex(prev => (prev !== null ? (prev + 1) % galleryFeaturedItems.length : 0));
      } else if (e.key === 'Escape') {
        setSelectedGalleryIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedGalleryIndex, galleryFeaturedItems]);

  useEffect(() => {
    if (!isCatalogOpen) return;
    const handleCatalogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCatalogOpen(false);
    };
    window.addEventListener('keydown', handleCatalogKeyDown);
    return () => window.removeEventListener('keydown', handleCatalogKeyDown);
  }, [isCatalogOpen]);

  const activeReview = publicReviews[testimonialIndex] || null;
  const reviewCount = publicReviews.length;
  const averageRating = reviewCount > 0
    ? (publicReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviewCount).toFixed(1)
    : null;

  const handleOpenGoogleMaps = () => {
    hapticLight();
    openMapsDirect(shopProfile.address, shopProfile.mapsUrl);
  };

  const handleOpenWhatsApp = () => {
    hapticLight();
    openWhatsAppDirect(shopProfile.whatsapp, `Olá! Gostaria de agendar um horário na ${shopProfile.name}.`);
  };

  const handleOpenWaze = () => {
    hapticLight();
    openWazeDirect(shopProfile.address);
  };

  const shopStatusInfo = useMemo(() => {
    return getShopStatusInfo(shopProfile);
  }, [shopProfile]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-0 overflow-y-auto bg-white text-neutral-900 font-sans antialiased relative selection:bg-gold-base/20 selection:text-neutral-900 no-scrollbar">
      <AnimatePresence>
        {!isFinalCtaVisible && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-0 left-0 right-0 z-40 md:hidden pointer-events-none pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex justify-center px-4"
          >
            <button 
              onClick={(e) => {
                 e.preventDefault();
                 hapticMedium();
                 onGoToBooking();
              }} 
              className="pointer-events-auto w-full max-w-xs bg-gold-base text-[#0a0a0a] font-extrabold text-base py-3 px-6 rounded-xl shadow-[0_8px_30px_color-mix(in_srgb,var(--color-gold-base)_35%,transparent)] border border-gold-base flex items-center justify-center gap-2 hover:bg-gold-deep active:scale-95 transition-all"
            >
              <CalendarCheck className="w-5 h-5" />
              Agendar agora
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HOURS MODAL OVERLAY */}

      <AnimatePresence>
        {isHoursModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center p-4"
          >
            <button 
              onClick={toggleHoursModal} 
              className="absolute top-5 right-5 w-11 h-11 rounded-full bg-white/8 border border-white/10 text-white text-xl flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
              aria-label="Fechar modal"
            >
              ✕
            </button>
            <motion.div 
              initial={reducedMotion ? {} : { opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-8 w-full max-w-sm flex flex-col gap-4"
            >
              <h3 className="text-white text-xl font-extrabold mb-1 tracking-wide uppercase">Horário de Funcionamento</h3>
              
              <div className="space-y-2">
                {daysOfWeekMap.map(d => {
                  const sch = shopProfile.operatingSchedule?.[d.key];
                  if (!sch) return null;
                  return (
                    <div key={d.key} className="flex justify-between items-center text-[#f5f5f5] text-sm font-medium">
                      <span className="text-[#a0a0a0]">{d.label}</span>
                      {sch.active ? (
                        <span className="font-mono text-amber-400">{sch.open} - {sch.close}</span>
                      ) : (
                        <span className="text-red-500 font-bold">Fechado</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleOpenWhatsApp}
                className="mt-3 w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-colors text-sm cursor-pointer"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                </svg>
                Falar no WhatsApp
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MENU OVERLAY REMOVIDO EM FAVOR DO DRAWER COMPARTILHADO */}

      {/* SECTION 0: HERO */}
      <section className="relative w-full min-h-full shrink-0 bg-[#0a0a0a] text-[#f5f5f5] overflow-hidden flex flex-col justify-between box-border">
        {/* Background Image with Gradient Overlay */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(10,10,10,0.4) 0%, rgba(10,10,10,0.85) 45%, #0a0a0a 95%), url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80')`
          }}
        />

        {/* HEADER */}
        <motion.header 
          initial={reducedMotion ? {} : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative z-20 flex items-center justify-between p-5 shrink-0"
        >
          <div className="font-serif font-bold text-lg tracking-tight text-white flex items-center gap-1">
            <span>NAVO</span><span className="text-gold-base">PREMIUM</span>
          </div>
          <div className="flex items-center gap-2">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={toggleMenu} 
              className="w-10 h-10 rounded-full bg-white/8 border border-white/10 text-white flex items-center justify-center backdrop-blur-md cursor-pointer"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5 text-white" />
            </motion.button>
          </div>
        </motion.header>

        {/* HERO CONTENT */}
        <div className="relative z-10 p-5 pb-6 flex flex-col justify-end items-center text-center my-auto min-h-0 w-full max-w-md md:max-w-2xl mx-auto">
          {/* LOGO DA BARBEARIA (ESTILO INSTAGRAM CIRCULAR) */}
          <motion.div 
            initial={reducedMotion ? {} : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.05, ease: 'easeOut' }}
            className="mb-3.5 flex flex-col items-center justify-center shrink-0 cursor-pointer group"
            onClick={() => {
              hapticLight();
              openInstagramDirect(shopProfile.instagram);
            }}
            title={shopProfile.instagram ? `Ver ${shopProfile.instagram} no Instagram` : 'Instagram da Barbearia'}
          >
            {/* Anel de Gradiente no Padrão Dourado do Sistema */}
            <div className="relative p-[3px] rounded-full bg-gradient-to-tr from-amber-600 via-gold-base to-amber-300 shadow-xl group-hover:scale-105 transition-transform duration-300">
              <div className="p-[2.5px] bg-[#0a0a0a] rounded-full">
                <div className="w-[120px] h-[120px] rounded-full overflow-hidden bg-neutral-900 flex items-center justify-center relative shadow-inner">
                  {shopProfile.logoUrl ? (
                    <img 
                      src={shopProfile.logoUrl} 
                      alt={shopProfile.name || 'Logo Barbearia'} 
                      className="w-full h-full object-cover rounded-full"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                        if (e.currentTarget.parentElement) {
                          const fallback = e.currentTarget.parentElement.querySelector('.logo-fallback');
                          if (fallback) fallback.classList.remove('hidden');
                        }
                      }}
                    />
                  ) : null}
                  <div className={`logo-fallback ${shopProfile.logoUrl ? 'hidden' : ''} flex flex-col items-center justify-center w-full h-full bg-neutral-900 text-gold-base`}>
                    <Scissors className="w-11 h-11 text-gold-base stroke-[1.8]" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* TITLE */}
          <motion.h1 
            initial={reducedMotion ? {} : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
            className="font-serif text-[clamp(1.85rem,4.5vh,2.8rem)] font-bold leading-[1.08] tracking-tight text-white mb-3"
          >
            Seu melhor <span className="text-gold-base">visual</span><br />
            começa aqui.
          </motion.h1>

          {/* SUBTITLE */}
          <motion.p 
            initial={reducedMotion ? {} : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
            className="text-[clamp(0.875rem,1.45vh,1rem)] leading-snug text-[#e5e7eb] mb-5 max-w-[19rem] sm:max-w-md font-medium"
          >
            Escolha serviço, barbeiro e horário. Confirmação imediata pelo WhatsApp.
          </motion.p>

          {/* CTA GROUP */}
          <motion.div 
            initial={reducedMotion ? {} : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease: 'easeOut' }}
            className="flex flex-col gap-5 w-full items-center"
          >
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => { 
                hapticMedium(); 
                trackEvent('cta_click', 'landing', 'agendar_horario_hero');
                onGoToBooking(); 
              }}
              className="w-full bg-gold-base hover:bg-gold-deep text-[#0a0a0a] font-bold text-base py-3 px-8 rounded-2xl flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer"
            >
              <span className="flex items-center gap-2 font-extrabold tracking-wide">
                Agendar meu horário
                <ArrowRight className="w-5 h-5 text-[#0a0a0a]" />
              </span>
            </motion.button>
            <button 
              onClick={() => onGoToAppointments && onGoToAppointments()}
              className="mt-1 flex items-center justify-center gap-1.5 text-[0.85rem] font-bold text-gold-base border border-gold-base/40 hover:border-gold-base hover:bg-gold-base/10 px-5 py-2.5 rounded-full cursor-pointer transition-all active:scale-95"
            >
              <span>Já marcou seu corte? Clique aqui</span>
            </button>


          </motion.div>
        </div>

        {/* HERO FOOTER / TRUST TAGS */}
        <div className="relative z-10 w-full max-w-md md:max-w-2xl mx-auto px-5 pb-6 shrink-0 mt-auto">
          <div className="w-full h-px bg-white/10 mb-6"></div>

          <div className="w-full flex justify-center mt-2 pb-4">
             <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-1.5 px-4 py-2 max-w-sm sm:max-w-none text-center">
               <span className={`w-2 h-2 shrink-0 rounded-full ${shopStatusInfo.status === 'open' ? 'bg-green-500 animate-pulse' : shopStatusInfo.status === 'closing_soon' ? 'bg-amber-400' : 'bg-neutral-500'}`} />
               <span className="text-xs font-medium text-white/90">
                 {shopStatusInfo.status === 'closed' 
                   ? `Fechado no momento · Próximo atendimento `
                   : `Aberto agora · Próximo atendimento `}
                   {nextAvailableTimeSlot || '...'}
               </span>
               <span className="hidden sm:inline-block text-white/40 px-1">•</span>
               <button onClick={() => {
                  hapticLight();
                  onGoToBooking();
               }} className="text-xs font-bold text-gold-base hover:text-gold-deep cursor-pointer">
                 {shopStatusInfo.status === 'closed' ? 'Reservar próximo horário' : 'Ver horários disponíveis'}
               </button>
             </div>
          </div>
        </div>
      </section>


      {/* SECTION: CONFIANÇA IMEDIATA */}
      <section className="w-full bg-neutral-900 border-b border-white/5 py-4 px-4 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-12 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center text-gold-base">
            <Star className="w-4 h-4 fill-current" />
            <Star className="w-4 h-4 fill-current" />
            <Star className="w-4 h-4 fill-current" />
            <Star className="w-4 h-4 fill-current" />
            <Star className="w-4 h-4 fill-current" />
          </div>
          <span className="text-white/90 text-sm font-medium">
            {averageRating ? `${averageRating}/5` : 'Avaliações verificadas'}
            {averageRating && <span className="text-white/50"> ({reviewCount})</span>}
          </span>
        </div>
        <div className="hidden sm:block w-px h-6 bg-white/10" />
        <div className="flex items-center gap-2 text-white/80 text-sm font-medium">
          <CalendarCheck className="w-4 h-4 text-gold-base" />
          <span>Confirmação imediata via WhatsApp</span>
        </div>
      </section>


      {/* SECTION: SERVIÇOS MAIS PROCURADOS */}
      <section className="relative w-full py-16 px-[clamp(1rem,3vh,2rem)] bg-neutral-50 flex flex-col items-center shrink-0">
        <div className="max-w-5xl w-full mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="font-serif text-[clamp(1.75rem,3vh,2.25rem)] font-bold text-neutral-900 tracking-tight">
              Escolha seu ritual
            </h2>
            <p className="text-neutral-500 font-medium text-sm">
              Corte, barba ou combo: escolha o cuidado que combina com o seu momento.
            </p>
          </div>

          {galleryFeaturedItems.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0 scrollbar-none">
              {galleryFeaturedItems.map((item, idx) => {
                const image = item.src || '/placeholder-service.svg';
                const durationLabel = item.duration > 0 ? `${item.duration} min` : 'Consulte a duração';
                const priceLabel = item.price > 0
                  ? item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  : 'Consulte o valor';
                const badge = item.badge || (idx === 0 ? 'Destaque da casa' : 'Escolha Navo');
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedGalleryIndex(idx)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedGalleryIndex(idx);
                      }
                    }}
                    className="group cursor-pointer min-w-[84%] sm:min-w-[56%] md:min-w-0 snap-start bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-xl hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-base transition-all duration-300 flex flex-col"
                    aria-label={`Ver detalhes de ${item.title}`}
                  >
                    <div className="h-48 relative overflow-hidden bg-neutral-100">
                      <div className="absolute top-3 left-3 z-10 bg-gold-base text-neutral-900 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {badge}
                      </div>
                      <img src={optimizeImageUrl(image, 600, 80)} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>
                    <div className="p-5 flex flex-col flex-1 justify-between">
                      <div>
                        <h3 className="font-bold text-lg text-neutral-900 line-clamp-2">{item.title}</h3>
                        <div className="flex items-center gap-2 mt-2 text-neutral-500 text-sm">
                          <Clock className="w-4 h-4" />
                          <span>{durationLabel}</span>
                        </div>
                      </div>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <span className="font-extrabold text-neutral-900">{priceLabel}</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            hapticMedium();
                            onGoToBooking(item.service);
                          }}
                          className="bg-neutral-900 text-white text-xs font-bold px-4 py-2 rounded-xl group-hover:bg-gold-base group-hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-base transition-colors"
                        >
                          Agendar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-500">
              <p className="font-semibold">Os serviços estão sendo atualizados.</p>
              <p className="text-sm mt-1">Consulte o catálogo completo para ver as opções disponíveis.</p>
            </div>
          )}

          <div className="flex justify-center pt-4">
            <button type="button" onClick={() => setIsCatalogOpen(true)} className="text-neutral-900 border border-neutral-300 hover:border-neutral-900 bg-white hover:bg-neutral-50 px-6 py-3 rounded-full font-bold text-sm transition-all flex items-center gap-2 shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-base">
              Ver todos os serviços
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>


      {/* SECTION: COMO FUNCIONA */}
      <section className="relative w-full py-16 px-[clamp(1rem,3vh,2rem)] bg-white flex flex-col items-center shrink-0 border-t border-neutral-100">
        <div className="max-w-5xl w-full mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="font-serif text-[clamp(1.75rem,3vh,2.25rem)] font-bold text-neutral-900 tracking-tight">
              Como funciona
            </h2>
            <p className="text-neutral-500 font-medium text-sm">
              Sem ligar, sem esperar. Resolva seu agendamento em três passos simples.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting Line (Desktop only) */}
            <div className="hidden md:block absolute top-8 left-[16.66%] right-[16.66%] h-px bg-neutral-200" />
            
            <div className="flex flex-col items-center text-center relative z-10 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gold-base/10 border border-gold-base flex items-center justify-center text-gold-deep shadow-sm">
                <Scissors className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 mb-1">1. Escolha o serviço</h3>
                <p className="text-sm text-neutral-500 leading-relaxed max-w-[250px]">Corte, barba ou química. Veja os detalhes e tempo de duração.</p>
              </div>
            </div>
            
            <div className="flex flex-col items-center text-center relative z-10 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gold-base/10 border border-gold-base flex items-center justify-center text-gold-deep shadow-sm">
                <CalendarCheck className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 mb-1">2. Selecione o horário</h3>
                <p className="text-sm text-neutral-500 leading-relaxed max-w-[250px]">Escolha seu barbeiro favorito e a data perfeita na agenda dele.</p>
              </div>
            </div>

            <div className="flex flex-col items-center text-center relative z-10 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gold-base/10 border border-gold-base flex items-center justify-center text-gold-deep shadow-sm">
                <MessageCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 mb-1">3. Receba confirmação</h3>
                <p className="text-sm text-neutral-500 leading-relaxed max-w-[250px]">Tudo pronto! Seu comprovante chega na hora no WhatsApp.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: POR QUE A NAVO */}
      <section className="relative w-full h-full min-h-fit py-12 shrink-0 flex flex-col justify-between p-[clamp(0.75rem,2vh,2rem)] bg-white overflow-hidden box-border">
        <motion.div 
          initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto w-full h-full flex flex-col justify-between items-stretch min-h-0 my-auto"
        >
          <div className="shrink-0 mb-[clamp(0.25rem,0.8vh,0.75rem)]">
            <span className="text-gold-base text-[clamp(0.6rem,1.1vh,0.8rem)] font-bold tracking-widest uppercase block mb-0.5">
              POR QUE A NAVO
            </span>
            <h2 className="font-serif text-[clamp(1.25rem,3.2vh,2.5rem)] font-bold text-neutral-900 tracking-tight leading-tight">
              Feito para você <span className="text-gold-deep">relaxar</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1 min-h-0 my-auto py-2 items-stretch">
            {differentials.map((item, idx) => {
              const Icon = item.icon;
              const SecondaryIcon = item.secondaryIcon;
              return (
                <motion.div 
                  key={idx}
                  whileHover={reducedMotion ? {} : { y: -3, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white border border-neutral-200/80 rounded-2xl p-[clamp(0.75rem,1.5vh,1.25rem)] flex flex-col items-center justify-center gap-[clamp(0.5rem,1.5vh,1rem)] text-center shadow-xs hover:shadow-md transition-shadow duration-300 group h-full min-h-0 cursor-pointer"
                >
                  <div 
                    className="w-[clamp(3.5rem,8vh,4.5rem)] h-[clamp(3.5rem,8vh,4.5rem)] rounded-full flex items-center justify-center relative shrink-0 transition-transform group-hover:scale-105"
                    style={{ backgroundColor: item.bgColor }}
                  >
                    <Icon 
                      className="w-[clamp(1.75rem,4vh,2.25rem)] h-[clamp(1.75rem,4vh,2.25rem)] stroke-[1.5]" 
                      style={{ color: item.strokeColor }} 
                    />
                    {SecondaryIcon && (
                      <div className="absolute bottom-1 right-1 bg-white rounded-full p-[2px] shadow-sm">
                        <SecondaryIcon 
                          className="w-[clamp(0.875rem,2vh,1.125rem)] h-[clamp(0.875rem,2vh,1.125rem)] stroke-[2.5]" 
                          style={{ color: item.secondaryColor || item.strokeColor }} 
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[clamp(0.75rem,1.4vh,0.9rem)] font-bold text-neutral-800 leading-[1.2] px-1 max-w-[80%]">
                      {item.label}
                    </span>
                    <span className="text-[clamp(0.6rem,1.1vh,0.7rem)] text-neutral-500 font-medium leading-[1.2] px-1 max-w-[90%]">
                      {item.desc}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* SECTION 3: GALERIA */}
            {/* SECTION: EXPERIÊNCIA NAVO */}
      <section id="experiencia" className="relative w-full py-16 px-[clamp(1rem,3vh,2rem)] bg-neutral-900 flex flex-col items-center shrink-0">
        <div className="max-w-5xl w-full mx-auto space-y-12">
          <div className="text-center space-y-3">
             <div className="flex justify-center items-center gap-1.5 mb-2 text-gold-base">
               <Star className="w-5 h-5 fill-current" />
               <Star className="w-5 h-5 fill-current" />
               <Star className="w-5 h-5 fill-current" />
               <Star className="w-5 h-5 fill-current" />
               <Star className="w-5 h-5 fill-current" />
             </div>
            <h2 className="font-serif text-[clamp(1.75rem,3vh,2.25rem)] font-bold text-white tracking-tight">
              Experiência <span className="text-gold-base">Navo</span>
            </h2>
            <p className="text-white/60 font-medium text-sm">
              Mais que um corte, um ritual de cuidado. Avaliações verificadas de clientes Navo.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-8 items-stretch">
            {/* Galeria de 3 fotos */}
            <div className="w-full md:w-1/2 flex flex-col gap-3">
               <div className="flex items-center justify-between px-1">
                 <span className="text-white/80 font-bold text-sm uppercase tracking-wider">Serviços da casa</span>
                 <button type="button" onClick={() => { hapticLight(); setIsCatalogOpen(true); }} className="text-gold-base hover:text-gold-deep text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-base">Ver catálogo completo →</button>
               </div>
               <div className="grid grid-cols-2 gap-3 h-full min-h-[300px]">
                 {galleryFeaturedItems.slice(0, 3).map((item, idx) => (
                   <div key={idx} className={`relative rounded-xl overflow-hidden group bg-neutral-800 ${idx === 0 ? 'col-span-2 row-span-2 min-h-[200px]' : 'col-span-1 min-h-[120px]'}`}>
                     <img src={optimizeImageUrl(item.src, idx === 0 ? 800 : 400, 75)} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3">
                        <span className="text-white font-bold text-sm line-clamp-1">{item.title}</span>
                     </div>
                   </div>
                 ))}
                 {galleryFeaturedItems.length === 0 && (
                   <div className="col-span-2 row-span-2 flex items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 text-center p-6">
                     <p className="text-sm font-medium text-white/50">Fotos não disponíveis</p>
                   </div>
                 )}
               </div>
            </div>

            {/* Depoimento Único de Impacto */}
            <div className="w-full md:w-1/2 flex flex-col justify-center bg-white/5 border border-white/10 rounded-2xl p-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                 <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                   <path d="M14.017 21L16.411 14.976C15.047 14.694 14.017 13.504 14.017 12.015C14.017 10.354 15.358 9 17.017 9C18.675 9 20.017 10.354 20.017 12.015C20.017 15.688 17.202 19.387 14.017 21ZM5.01697 21L7.411 14.976C6.04697 14.694 5.01697 13.504 5.01697 12.015C5.01697 10.354 6.35797 9 8.01697 9C9.67597 9 11.017 10.354 11.017 12.015C11.017 15.688 8.20197 19.387 5.01697 21Z" />
                 </svg>
               </div>
               
               {activeReview ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    {activeReview.photoUrl ? (
                      <img src={activeReview.photoUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gold-base flex items-center justify-center text-neutral-900 font-bold text-lg">
                        {(activeReview.clientName || 'C').slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-white text-base">{activeReview.clientName || 'Cliente Navo'}</h4>
                      <p className="text-white/50 text-xs">Atendimento com {activeReview.professionalName || 'nossa equipe'}</p>
                    </div>
                  </div>
                  <p className="text-white/90 text-[clamp(1rem,2vh,1.15rem)] font-medium leading-relaxed italic mb-6">
                    “{activeReview.comment || 'Experiência registrada com a equipe Navo.'}”
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="bg-white/10 px-3 py-1 rounded-full text-xs text-white/80 font-medium">Avaliação verificada</div>
                    <div className="flex items-center gap-1 text-gold-base text-sm font-bold">
                      <Star className="w-4 h-4 fill-current" />
                      {Number(activeReview.rating || 0).toFixed(1)}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
                  <p className="font-semibold">As avaliações verificadas aparecerão aqui.</p>
                  <p className="text-sm text-white/55 mt-2">Depois do seu atendimento, compartilhe sua experiência com a Navo.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: LOCALIZAÇÃO */}
      <section className="relative w-full h-full min-h-fit py-12 shrink-0 flex flex-col justify-between p-[clamp(0.75rem,2vh,2rem)] bg-white overflow-hidden box-border">
        <motion.div 
          initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto w-full h-full flex flex-col justify-between items-stretch min-h-0 my-auto"
        >
          {/* Section Header */}
          <div className="shrink-0 mb-[clamp(0.25rem,0.8vh,0.75rem)] flex items-end justify-between gap-3">
            <div>
              <span className="text-gold-base text-[clamp(0.6rem,1.1vh,0.8rem)] font-bold tracking-widest uppercase flex items-center gap-1.5 mb-0.5">
                <MapPin className="w-3.5 h-3.5 text-gold-base" />
                LOCALIZAÇÃO & ATENDIMENTO
              </span>
              <h2 className="font-serif text-[clamp(1.25rem,3.2vh,2.5rem)] font-bold text-neutral-900 tracking-tight leading-tight">
                Onde estamos
              </h2>
            </div>

            {/* Live Open/Closed Status Pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-800 border border-neutral-200/90 shadow-2xs shrink-0">
              <span className={`w-2 h-2 rounded-full ${shopStatusInfo.status === 'open' ? 'bg-emerald-500 animate-pulse' : shopStatusInfo.status === 'closing_soon' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-[clamp(0.6rem,1.1vh,0.75rem)] font-bold uppercase tracking-wider">
                {shopStatusInfo.detail}
              </span>
            </div>
          </div>

          {/* Main Card Container (Light System Palette) */}
          <div className="bg-white border border-neutral-200/90 rounded-[clamp(0.75rem,1.6vh,1.25rem)] p-[clamp(0.625rem,1.5vh,1.25rem)] shadow-lg flex-1 min-h-0 my-auto flex flex-col md:grid md:grid-cols-12 gap-[clamp(0.625rem,1.5vh,1.25rem)] items-stretch justify-between text-neutral-900 overflow-hidden">
            
            {/* Real Interactive Google Maps Embedded iframe */}
            <div className="relative w-full md:col-span-7 flex-1 min-h-[clamp(8.5rem,18vh,15rem)] rounded-[clamp(0.625rem,1.2vh,1rem)] overflow-hidden bg-neutral-100 border border-neutral-200 shrink-0 md:shrink group shadow-2xs">
              <iframe
                title="Mapa de Localização da Barbearia"
                width="100%"
                height="100%"
                style={{ border: 0, filter: 'contrast(102%) brightness(98%)' }}
                loading="lazy"
                allowFullScreen
                src={`https://maps.google.com/maps?q=${encodeURIComponent(shopProfile.address || 'Rua Fortaleza, 1420 - Expectativa, Sobral - CE')}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                className="w-full h-full min-h-full rounded-[clamp(0.5rem,1vh,0.875rem)]"
              />
              
              {/* Map Floating Expand Link */}
              <div className="absolute top-2.5 right-2.5 flex items-center justify-end pointer-events-none">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleOpenGoogleMaps}
                  className="bg-white/95 hover:bg-neutral-50 text-neutral-800 border border-neutral-200 px-2.5 py-1 rounded-lg shadow-xs transition-all pointer-events-auto flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold cursor-pointer"
                  title="Abrir no Google Maps"
                >
                  <ExternalLink className="w-3 h-3 text-gold-base" />
                  <span className="hidden sm:inline">Ver no Mapa</span>
                </motion.button>
              </div>
            </div>

            {/* Details Panel & Action Buttons */}
            <div className="md:col-span-5 flex flex-col justify-between space-y-[clamp(0.375rem,1vh,0.875rem)] min-h-0">
              
              {/* Highlighted Custom Typography */}
              <div className="space-y-[clamp(0.375rem,1vh,0.75rem)]">
                <div>
                  <span className="text-[clamp(0.6rem,1vh,0.725rem)] font-bold uppercase tracking-widest text-gold-base block mb-0.5">
                    {shopProfile.unitName || 'Unidade Expectativa'}
                  </span>
                  <h3 className="text-[clamp(1.1rem,2.2vh,1.5rem)] font-extrabold text-neutral-900 tracking-tight leading-tight">
                    {shopProfile.name}
                  </h3>
                </div>

                {/* Big Display Address Highlight Callout */}
                <div className="bg-neutral-50 border border-neutral-200/80 p-[clamp(0.5rem,1.2vh,0.75rem)] rounded-xl space-y-1.5 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gold-base/15 border border-gold-base/30 text-gold-base flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider block">Endereço de Atendimento</span>
                      <p className="text-[clamp(0.725rem,1.4vh,0.9rem)] font-extrabold text-neutral-900 leading-snug">
                        {shopProfile.address}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Info Grid (Hours & Phone) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-neutral-50 border border-neutral-200/80 p-2 rounded-lg flex items-center gap-2 shadow-2xs">
                    <Clock className={`w-3.5 h-3.5 shrink-0 ${shopStatusInfo.status === 'open' ? 'text-emerald-500' : 'text-gold-base'}`} />
                    <div>
                      <span className="text-[8.5px] text-neutral-500 uppercase tracking-wider block font-bold">Horário Hoje</span>
                      <span className="text-[10.5px] font-bold text-neutral-800 truncate block">
                        {shopStatusInfo.status === 'closed' ? 'Fechado hoje' : shopStatusInfo.todayHours}
                      </span>
                    </div>
                  </div>

                  <a href={`tel:${(shopProfile.phone || '(88) 99834-0085').replace(/\D/g, '')}`} className="bg-neutral-50 border border-neutral-200/80 p-2 rounded-lg flex items-center gap-2 shadow-2xs hover:bg-neutral-100 transition-colors cursor-pointer group">
                    <Phone className="w-3.5 h-3.5 text-gold-base shrink-0 group-hover:scale-110 transition-transform" />
                    <div>
                      <span className="text-[8.5px] text-neutral-500 uppercase tracking-wider block font-bold">Contato Direto</span>
                      <span className="text-[10.5px] font-bold text-neutral-800">
                        {shopProfile.phone || '(88) 99834-0085'}
                      </span>
                    </div>
                  </a>
                  
                </div>
              </div>

              {/* Action Buttons Zone */}
              <div className="pt-2 sm:pt-3 border-t border-neutral-200/80 shrink-0 grid grid-cols-2 gap-2">
                <motion.button 
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleOpenGoogleMaps}
                  className="w-full bg-neutral-900 hover:bg-black text-white font-extrabold text-[clamp(0.7rem,1.4vh,0.8rem)] py-3 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer tracking-wide border border-neutral-900"
                >
                  <Navigation className="w-4 h-4 fill-gold-base text-gold-base" />
                  <span>COMO CHEGAR</span>
                </motion.button>
                <motion.a 
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  href={`tel:${(shopProfile.phone || '(88) 99834-0085').replace(/\D/g, '')}`}
                  className="w-full bg-white hover:bg-neutral-50 text-neutral-900 font-extrabold text-[clamp(0.7rem,1.4vh,0.8rem)] py-3 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer tracking-wide border border-neutral-200"
                >
                  <Phone className="w-4 h-4 fill-neutral-200 text-neutral-900" />
                  <span>LIGAR AGORA</span>
                </motion.a>
              </div>

            </div>

          </div>
        </motion.div>
      </section>

      {/* SECTION 6: FINAL CTA & FOOTER */}
      <section ref={finalCtaRef} className="relative w-full h-full min-h-fit py-12 shrink-0 flex flex-col justify-between bg-[#0a0b0e] text-white overflow-hidden box-border">
        
        {/* Background Image with Dark Overlay */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-30 mix-blend-luminosity pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(10,11,14,0.85) 0%, rgba(10,11,14,0.95) 50%, #06070a 100%), url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1200&q=80')`
          }}
        />

        {/* Main CTA Content Area */}
        <motion.div 
          initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative z-10 w-full flex-1 flex flex-col justify-center items-center my-auto py-[clamp(1rem,3vh,2.5rem)] px-[clamp(1.25rem,4vh,3rem)] text-center max-w-2xl lg:max-w-3xl mx-auto min-h-0"
        >

          {/* MAIN HEADING */}
          <h2 className="font-serif text-[clamp(1.75rem,4.2vh,3rem)] font-bold text-white mb-[clamp(0.35rem,1.2vh,0.85rem)] tracking-tight leading-[1.12]">
            Pronto para o seu <span className="text-gold-base font-bold">novo visual</span>?
          </h2>

          {/* SUBTITLE */}
          <p className="text-[clamp(0.85rem,1.7vh,1.1rem)] text-[#d1d5db] font-medium leading-relaxed mb-[clamp(1rem,2.2vh,1.75rem)] max-w-md sm:max-w-lg">
            Agende em segundos, escolha seu barbeiro e garanta seu horário exclusivo com atendimento VIP.
          </p>

          {/* ACTION BUTTONS GROUP */}
          <div className="flex flex-col gap-3 w-full max-w-sm sm:max-w-md items-center">
            
            {/* PRIMARY CTA - GOLD BUTTON */}
            <motion.button 
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                hapticMedium();
                trackEvent('cta_click', 'landing', 'agendar_online_footer');
                onGoToBooking();
              }}
              className="w-full bg-gold-base hover:bg-gold-deep text-[#0a0a0a] font-extrabold text-[clamp(1rem,2vh,1.15rem)] py-[clamp(1rem,2.2vh,1.25rem)] px-6 rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer border border-gold-base shadow-lg shadow-gold-base/10"
            >
              <span className="tracking-wide">Agendar meu horário agora</span>
              <ArrowRight className="w-5 h-5 text-[#0a0a0a]" />
            </motion.button>

            {/* SECONDARY CTA - WHATSAPP LINK */}
            <button 
              onClick={() => {
                trackEvent('cta_click', 'landing', 'agendar_whatsapp_footer');
                handleOpenWhatsApp();
              }}
              className="flex items-center justify-center gap-2 text-[#4ade80]/80 hover:text-[#4ade80] font-semibold text-[clamp(0.7rem,1.4vh,0.8rem)] py-1.5 transition-colors cursor-pointer group"
            >
              <MessageCircle className="w-3.5 h-3.5 fill-current group-hover:scale-110 transition-transform" />
              <span className="border-b border-transparent group-hover:border-[#4ade80]/50 transition-colors">Tirar dúvidas no WhatsApp</span>
            </button>
          </div>

          {/* TRUST GUARANTEES BADGES */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-[clamp(1rem,2.2vh,1.5rem)] pt-[clamp(0.75rem,1.8vh,1.25rem)] border-t border-gray-800 text-[#d1d5db] text-[clamp(0.7rem,1.4vh,0.82rem)] font-semibold">
            <span className="flex items-center gap-1.5"><span className="text-[#4ade80] font-bold">✓</span> Catálogo atualizado</span>
            <span className="flex items-center gap-1.5"><span className="text-[#4ade80] font-bold">✓</span> Horários reais da equipe</span>
            <span className="flex items-center gap-1.5"><span className="text-[#4ade80] font-bold">✓</span> Confirmação via WhatsApp</span>
          </div>
        </motion.div>

        {/* BACK TO TOP BUTTON */}
        <div className="relative z-10 flex justify-center pt-1 pb-[clamp(0.5rem,1.5vh,1rem)] shrink-0 px-4">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={scrollToTop}
            className="group flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#181a20] hover:bg-[#22252e] border border-gray-700 text-gray-200 hover:text-white transition-all text-xs font-bold cursor-pointer"
            aria-label="Voltar ao topo"
          >
            <ArrowUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform duration-300 text-gold-base" />
            <span>Voltar ao topo</span>
          </motion.button>
        </div>

        {/* FOOTER */}
        <footer className="relative z-10 w-full bg-[#06070a] border-t border-gray-800 px-5 py-6 shrink-0 flex flex-col gap-5 mt-auto text-[0.75rem] text-[#8b919e] font-medium">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800/60 pb-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-gold-base font-bold text-sm uppercase tracking-widest">{shopProfile.name}</span>
              <span>{shopProfile.address}</span>
              <span className="text-gray-400">{scheduleSummary}</span>
            </div>
            <div className="flex flex-wrap gap-4 sm:gap-6">
              <button
                type="button"
                onClick={() => setTermsPrivacyTab('privacy')}
                className="hover:text-white transition-colors cursor-pointer text-left"
              >
                Privacidade
              </button>
              <button
                type="button"
                onClick={() => setTermsPrivacyTab('terms')}
                className="hover:text-white transition-colors cursor-pointer text-left"
              >
                Termos
              </button>
              {shopProfile.instagramUrl && (
                <a href={shopProfile.instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <Instagram className="w-3.5 h-3.5" /> Instagram
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 w-full">
            <p>
              © {new Date().getFullYear()} {shopProfile.name}. Todos os direitos reservados.
            </p>
            <p>
              Desenvolvido por <span className="text-gold-base font-bold">Navo</span>
            </p>
          </div>
        </footer>
      </section>

      <AnimatePresence>
        {isCatalogOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="services-catalog-title"
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center"
            onMouseDown={() => setIsCatalogOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              onMouseDown={(event) => event.stopPropagation()}
              className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl bg-surface-card text-content-base border border-border-subtle shadow-2xl p-5 sm:p-7"
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-gold-base text-xs font-bold uppercase tracking-[0.18em]">Catálogo Navo</p>
                  <h2 id="services-catalog-title" className="font-serif text-2xl sm:text-3xl font-bold mt-1">Escolha seu ritual</h2>
                  <p className="text-content-muted text-sm mt-2">Veja somente serviços cadastrados e escolha o que combina com o seu momento.</p>
                </div>
                <button type="button" onClick={() => setIsCatalogOpen(false)} aria-label="Fechar catálogo" className="w-10 h-10 rounded-full border border-border-subtle text-content-muted hover:text-content-base hover:bg-surface-base flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-base">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Filtrar serviços">
                {([
                  ['todos', 'Todos'],
                  ['cabelo', 'Cortes'],
                  ['barba', 'Barba']
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === value}
                    onClick={() => setActiveCategory(value)}
                    className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-base ${activeCategory === value ? 'bg-gold-base text-surface-base border-gold-base' : 'border-border-subtle text-content-muted hover:text-content-base hover:bg-surface-base'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {filteredServices.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredServices.map((service) => {
                    const image = service.image_url || service.gallery_urls?.[0] || '/placeholder-service.svg';
                    const price = Number(service.price || 0);
                    const duration = Number(service.duration_minutes || 0);
                    return (
                      <article key={service.id} className="rounded-2xl overflow-hidden border border-border-subtle bg-surface-base flex flex-col">
                        <div className="h-40 relative bg-surface-card">
                          <img src={optimizeImageUrl(image, 600, 80)} alt={service.title} className="w-full h-full object-cover" loading="lazy" />
                          {service.popular && <span className="absolute top-3 left-3 rounded-full bg-gold-base text-surface-base px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">Mais agendado</span>}
                        </div>
                        <div className="p-4 flex flex-col flex-1">
                          <h3 className="font-bold text-base leading-snug">{service.title}</h3>
                          <p className="text-content-muted text-sm mt-2 line-clamp-3 min-h-[3.75rem]">{service.description || 'Experiência Navo com atendimento personalizado.'}</p>
                          <div className="flex items-center justify-between gap-3 mt-4 text-sm">
                            <span className="font-black text-gold-base">{price > 0 ? price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Consulte o valor'}</span>
                            <span className="text-content-muted">{duration > 0 ? `${duration} min` : 'Consulte a duração'}</span>
                          </div>
                          <button type="button" onClick={() => { setIsCatalogOpen(false); onGoToBooking(service); }} className="mt-4 w-full rounded-xl bg-gold-base hover:bg-gold-deep text-surface-base font-bold py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-base">
                            Agendar este serviço
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border-subtle p-8 text-center text-content-muted">
                  Nenhum serviço disponível nesta categoria no momento.
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <TermsAndPrivacyModal
        isOpen={!!termsPrivacyTab}
        defaultTab={termsPrivacyTab || 'privacy'}
        onClose={() => setTermsPrivacyTab(null)}
      />

      {/* MODAL FULLSCREEN CARROSSEL DE FOTOS DOS CORTES REAIS */}

      <AnimatePresence>
        {selectedGalleryIndex !== null && galleryFeaturedItems[selectedGalleryIndex] && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 bg-surface-base/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-4 md:p-6 pb-4 select-none overflow-hidden"
          >
            {/* Photo Carousel Area - Fills space to the top */}
            <div className="relative flex-1 flex items-center justify-center mb-3 w-full max-w-4xl mx-auto min-h-0">
              {/* Left Navigation Arrow */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  hapticLight();
                  setSelectedGalleryIndex(prev => (prev !== null && prev > 0 ? prev - 1 : galleryFeaturedItems.length - 1));
                }}
                className="absolute left-2 md:left-4 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-surface-card/80 hover:bg-surface-card text-content-base border border-border-subtle flex items-center justify-center backdrop-blur-md shadow-2xl cursor-pointer"
                title="Anterior"
              >
                <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
              </motion.button>

              {/* Photo Container - Fills area cleanly */}
              <motion.div 
                initial={reducedMotion ? {} : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="relative w-full h-full flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl border border-border-subtle bg-surface-card group"
              >
                <img
                  src={galleryFeaturedItems[selectedGalleryIndex].src}
                  alt={galleryFeaturedItems[selectedGalleryIndex].title}
                  className="w-full h-full object-cover transition-transform duration-300"
                />
              </motion.div>

              {/* Right Navigation Arrow */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  hapticLight();
                  setSelectedGalleryIndex(prev => (prev !== null ? (prev + 1) % galleryFeaturedItems.length : 0));
                }}
                className="absolute right-2 md:right-4 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-surface-card/80 hover:bg-surface-card text-content-base border border-border-subtle flex items-center justify-center backdrop-blur-md shadow-2xl cursor-pointer"
                title="Próxima"
              >
                <ChevronRight className="w-6 h-6 stroke-[2.5]" />
              </motion.button>
            </div>

            {/* Bottom Info Card & Actions: Galeria > Agendar (Uses App Theme Palette) */}
            <motion.div 
              initial={reducedMotion ? {} : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="w-full max-w-2xl mx-auto bg-surface-card/95 backdrop-blur-xl p-4 md:p-5 rounded-2xl border border-border-subtle space-y-3 z-10 shadow-2xl text-content-base"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2.5">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base md:text-lg font-extrabold text-content-base tracking-tight leading-tight truncate">
                    {galleryFeaturedItems[selectedGalleryIndex].title}
                  </h3>
                  <p className="text-xs md:text-sm text-content-muted font-normal leading-normal line-clamp-2 mt-0.5">
                    {galleryFeaturedItems[selectedGalleryIndex].description}
                  </p>
                </div>

                <div className="text-right shrink-0 pl-2">
                  <span className="text-base md:text-lg font-black text-gold-base block leading-none">
                    R$ {galleryFeaturedItems[selectedGalleryIndex].price.toFixed(2)}
                  </span>
                  <span className="text-[10px] md:text-xs text-content-muted font-medium mt-1 block">
                    ⏱️ {galleryFeaturedItems[selectedGalleryIndex].duration} min
                  </span>
                </div>
              </div>

              {/* Buttons in order: Galeria > Agendar */}
              <div className="flex items-center gap-2.5 pt-0.5">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    hapticLight();
                    setSelectedGalleryIndex(null);
                  }}
                  className="px-4 md:px-6 py-3 rounded-xl bg-surface-base hover:bg-surface-base/80 text-content-base font-bold text-xs md:text-sm uppercase tracking-wider border border-border-subtle flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  title="Voltar para a Galeria"
                >
                  <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                  <span>Galeria</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    hapticMedium();
                    const selectedService = galleryFeaturedItems[selectedGalleryIndex].service;
                    setSelectedGalleryIndex(null);
                    onGoToBooking(selectedService);
                  }}
                  className="flex-1 py-3 rounded-xl bg-gold-base hover:bg-gold-deep text-surface-base font-bold text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-gold-base/20 cursor-pointer"
                  title="Agendar este serviço"
                >
                  <CalendarCheck className="w-4 h-4 stroke-[2.5]" />
                  <span>Agendar</span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
