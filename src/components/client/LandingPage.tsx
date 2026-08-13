import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TermsAndPrivacyModal } from '../shared/TermsAndPrivacyModal';
import { 
  ShopProfile, 
  defaultShopProfile, 
  fetchShopProfile, 
  daysOfWeekMap 
} from '../../services/shopProfileService';
import { fetchServicesFromSupabase } from '../../services/supabaseDataService';
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
  const [termsPrivacyTab, setTermsPrivacyTab] = useState<'terms' | 'privacy' | null>(null);
  const [isHoursModalOpen, setIsHoursModalOpen] = useState(false);
  const [shopProfile, setShopProfile] = useState<ShopProfile>(defaultShopProfile);
  const [dbServices, setDbServices] = useState<any[]>([]);
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
    fetchShopProfile().then(data => {
      if (data) setShopProfile(data);
    });
    fetchServicesFromSupabase()
      .then(data => setDbServices(Array.isArray(data) ? data : []))
      .catch(() => setDbServices([]));
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

    const firstActive = activeDays[0];
    const lastActive = activeDays[activeDays.length - 1];
    const sch = shopProfile.operatingSchedule[firstActive.key];
    
    if (activeDays.length === 1) return `${firstActive.label}: ${sch.open} às ${sch.close}`;
    return `${firstActive.label} a ${lastActive.label}: ${sch.open} às ${sch.close}`;
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
    const cat = (s.category || '').toLowerCase();
    if (activeCategory === 'cabelo') return cat.includes('cabelo') || cat.includes('corte');
    if (activeCategory === 'barba') return cat.includes('barba');
    return true;
  });

  const differentials = [
    { icon: User, secondaryIcon: Scissors, label: 'Barbeiros Master', desc: '10+ anos de experiência', strokeColor: 'var(--color-gold-deep)', bgColor: 'color-mix(in srgb, var(--color-gold-base) 14%, transparent)' },
    { icon: Snowflake, label: 'Ambiente Premium', desc: 'Som e ar-condicionado', strokeColor: '#80b6c6', bgColor: '#e3f4f8' },
    { icon: Coffee, label: 'Bebida Cortesia', desc: 'Café e cerveja artesanal', strokeColor: '#9e795a', bgColor: '#f5efe9' },
    { icon: Wifi, label: 'Conectividade', desc: 'Wi-Fi de alta velocidade livre', strokeColor: '#71a67a', bgColor: '#e6f5ea' },
    { icon: Car, label: 'Estacionamento', desc: 'Vagas próprias gratuitas', strokeColor: '#9a9bc4', bgColor: '#edeefc' },
    { icon: Clock, secondaryIcon: Check, secondaryColor: '#4ade80', label: 'Agendamento Ágil', desc: 'Confirmação por WhatsApp', strokeColor: '#c1877f', bgColor: '#faece9' }
  ];

  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState<number | null>(null);

  const galleryFeaturedItems = useMemo(() => {
    const list = dbServices.filter(s => Boolean(s.popular || s.is_popular || s.badge || s.is_featured || s.isFeatured || s.is_combo));
    const services = list.length > 0 ? list : dbServices;
    return services.slice(0, 6).map((service, idx) => ({
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

  const testimonials = [
    {
      name: "Rafael M.",
      initials: "RM",
      since: "Cliente desde 2023",
      service: "Corte Degradê & Barba VIP",
      rating: 5.0,
      text: "Melhor barbearia de São Paulo sem dúvidas! O atendimento é personalizado do início ao fim, o café artesanal é excelente e o acabamento na navalha ficou impecável.",
      gradient: "from-emerald-500 to-teal-600",
      avatarGradient: "from-emerald-500/20 to-amber-500/20",
      borderColor: "border-emerald-500/30",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150"
    },
    {
      name: "João Lucas",
      initials: "JL",
      since: "Cliente desde 2022",
      service: "Corte Social & Barba",
      rating: 5.0,
      text: "Ambiente incrível, música boa e profissionais que realmente entendem do ofício. Sempre saio satisfeito e já indiquei para todos os meus amigos da firma.",
      gradient: "from-amber-500 to-orange-600",
      avatarGradient: "from-amber-500/20 to-orange-500/20",
      borderColor: "border-amber-500/30",
      avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=150"
    },
    {
      name: "Marcos C.",
      initials: "MC",
      since: "Cliente desde 2024",
      service: "Platinado & Design de Barba",
      rating: 5.0,
      text: "Fiz o platinado aqui e o resultado superou todas as expectativas. O cuidado com os detalhes é impressionante. Vale cada centavo investido no visual.",
      gradient: "from-blue-500 to-indigo-600",
      avatarGradient: "from-blue-500/20 to-indigo-500/20",
      borderColor: "border-blue-500/30",
      avatar: "https://images.unsplash.com/photo-1600486913747-55e5470d6f40?auto=format&fit=crop&q=80&w=150"
    },
    {
      name: "André P.",
      initials: "AP",
      since: "Cliente desde 2021",
      service: "Corte Clássico & Hot Towel",
      rating: 4.9,
      text: "Tradição e modernidade no mesmo lugar. O serviço de toalha quente no final é um diferencial que não encontro em lugar nenhum. Recomendo de olhos fechados.",
      gradient: "from-rose-500 to-pink-600",
      avatarGradient: "from-rose-500/20 to-pink-500/20",
      borderColor: "border-rose-500/30",
      avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=150"
    },
    {
      name: "Tiago F.",
      initials: "TF",
      since: "Cliente desde 2023",
      service: "Corte Militar & Sobrancelha",
      rating: 5.0,
      text: "Pontualidade e qualidade definem esse lugar. Nunca precisei esperar e o corte sempre sai exatamente como peço. O atendimento é nota 10.",
      gradient: "from-violet-500 to-purple-600",
      avatarGradient: "from-violet-500/20 to-purple-500/20",
      borderColor: "border-violet-500/30",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150"
    }
  ];

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
    <div ref={containerRef} className="w-full h-full min-h-0 overflow-y-scroll snap-y snap-mandatory bg-white text-neutral-900 font-sans antialiased relative selection:bg-gold-base/20 selection:text-neutral-900 no-scrollbar">
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
      <section className="relative w-full h-full min-h-full max-h-full snap-start snap-always shrink-0 bg-[#0a0a0a] text-[#f5f5f5] overflow-hidden flex flex-col justify-between box-border">
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
            className="text-[clamp(0.95rem,1.7vh,1.15rem)] leading-relaxed text-[#e5e7eb] mb-6 max-w-xs sm:max-w-md font-medium"
          >
            Agende online, evite filas e saia renovado. Rápido, fácil e sem complicação.
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
              className="w-full bg-gold-base hover:bg-gold-deep text-[#0a0a0a] font-bold text-lg py-[1.15rem] px-8 rounded-2xl flex flex-col items-center justify-center gap-0.5 shadow-[0_6px_35px_color-mix(in_srgb,var(--color-gold-base)_40%,transparent)] hover:shadow-[0_8px_45px_color-mix(in_srgb,var(--color-gold-base)_50%,transparent)] transition-all shrink-0 cursor-pointer"
            >
              <span className="flex items-center gap-2 font-extrabold tracking-wide">
                Ver horários disponíveis
                <ArrowRight className="w-[1.35rem] h-[1.35rem] text-[#0a0a0a]" />
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

          <div className="flex justify-around items-center w-full px-2">
            <button onClick={toggleHoursModal} className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform hover:opacity-80">
              <span className="text-[#a0a0a0] text-[0.65rem] font-bold tracking-widest uppercase">STATUS DA LOJA</span>
              <div className="flex items-center gap-1.5">
                <span className={`font-semibold text-sm whitespace-nowrap ${shopStatusInfo.status === 'open' ? 'text-green-500' : shopStatusInfo.status === 'closing_soon' ? 'text-amber-400' : 'text-white'}`}>
                  {shopStatusInfo.status === 'closed' ? (nextAvailableTimeSlot ? `Abre ${nextAvailableTimeSlot.startsWith('0') || nextAvailableTimeSlot.startsWith('1') || nextAvailableTimeSlot.startsWith('2') ? 'hoje às ' + nextAvailableTimeSlot : nextAvailableTimeSlot}` : 'Fechado hoje') : shopStatusInfo.label}
                </span>
              </div>
            </button>

            {shopStatusInfo.status !== 'closed' && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-[#a0a0a0] text-[0.65rem] font-bold tracking-widest uppercase">PRÓXIMO HORÁRIO</span>
                <span className="text-white font-bold text-sm">
                  {nextAvailableTimeSlot ? nextAvailableTimeSlot : <span className="opacity-50">...</span>}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 1: POR QUE A NAVO */}
      <section className="relative w-full h-full min-h-full max-h-full snap-start snap-always shrink-0 flex flex-col justify-between p-[clamp(0.75rem,2vh,2rem)] bg-white overflow-hidden box-border">
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

          <div className="grid grid-cols-2 md:grid-cols-3 grid-rows-3 md:grid-rows-2 gap-[clamp(0.375rem,1vh,1rem)] flex-1 min-h-0 my-auto py-[clamp(0.25rem,0.5vh,0.5rem)] items-stretch">
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
      <section id="galeria" className="relative w-full h-full min-h-full max-h-full snap-start snap-always shrink-0 flex flex-col justify-between p-[clamp(0.75rem,2vh,2rem)] bg-white overflow-hidden box-border">
        <motion.div 
          initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto w-full h-full flex flex-col justify-between items-stretch min-h-0 my-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-end mb-[clamp(0.25rem,0.8vh,0.75rem)] shrink-0">
            <div>
              <span className="text-gold-base text-[clamp(0.6rem,1.1vh,0.8rem)] font-bold tracking-widest uppercase block mb-0.5 flex items-center gap-1">
                <Star className="w-3 h-3 fill-gold-base text-gold-base" />
                <span>GALERIA • DESTAQUES</span>
              </span>
              <h2 className="font-serif text-[clamp(1.25rem,3.2vh,2.5rem)] font-bold text-neutral-900 tracking-tight leading-tight">
                Cortes reais
              </h2>
            </div>
            <button 
              onClick={() => { hapticLight(); onGoToBooking(); }}
              className="text-[clamp(0.7rem,1.4vh,0.875rem)] font-bold text-gold-base border border-gold-base/40 hover:bg-gold-base/10 px-3 md:px-4 py-1.5 md:py-2 rounded-full transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95"
            >
              <span>Todos os serviços</span>
              <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          </div>

          {/* Galeria Bento Grid dos Serviços com Selo de Destaque (no máximo 5 fotos) */}
          <div className="grid grid-cols-2 md:grid-cols-4 grid-rows-4 md:grid-rows-2 gap-[clamp(0.25rem,0.6vh,0.65rem)] flex-1 min-h-0 w-full h-full">
            {galleryFeaturedItems.length === 0 ? (
              <div className="col-span-2 md:col-span-4 row-span-4 md:row-span-2 flex items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-center p-6">
                <p className="text-sm font-medium text-neutral-500">Nenhum serviço cadastrado no banco de dados.</p>
              </div>
            ) : galleryFeaturedItems.slice(0, 5).map((item, index) => {
              const isHero = index === 0;
              let gridClass = 'col-span-1 row-span-1';
              if (isHero) {
                gridClass = 'col-span-2 md:col-span-2 row-span-2 md:row-span-2';
              }

              return (
                <motion.div
                  key={item.id + '_' + index}
                  whileHover={reducedMotion ? {} : { scale: 1.015 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => {
                    hapticLight();
                    setSelectedGalleryIndex(index);
                  }}
                  className={`${gridClass} rounded-[clamp(0.5rem,1vh,0.875rem)] overflow-hidden relative group bg-neutral-900 border border-neutral-200/50 hover:border-gold-base/80 shadow-xs min-h-0 h-full cursor-pointer`}
                >
                  {/* Photo image */}
                  <img
                    loading="lazy"
                    src={item.src}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent flex flex-col justify-end p-[clamp(0.4rem,1vh,0.85rem)] select-none">
                    {/* Bottom Info */}
                    <div className="space-y-1">
                      <h3 className={`text-white font-extrabold ${isHero ? 'text-[clamp(0.9rem,1.8vh,1.3rem)]' : 'text-[clamp(0.65rem,1.25vh,0.85rem)]'} leading-tight line-clamp-2`}>
                        {item.title}
                      </h3>

                      {isHero && (
                        <p className="text-neutral-300 text-[clamp(0.65rem,1vh,0.85rem)] line-clamp-2 max-w-[90%]">
                          {item.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-1 pt-1">
                        <span className="text-gold-base font-black text-[clamp(0.7rem,1.4vh,0.95rem)]">
                          R$ {item.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* SECTION 4: DEPOIMENTOS - VERTICAL LAYOUT */}
      <section className="relative w-full h-full min-h-full max-h-full snap-start snap-always shrink-0 flex flex-col justify-center p-[clamp(0.75rem,2vh,2rem)] bg-neutral-900 overflow-hidden box-border">
        <motion.div 
          initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="max-w-4xl mx-auto w-full h-full flex flex-col justify-center items-stretch min-h-0 my-auto"
        >
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-[clamp(1rem,3vh,2.5rem)] gap-4 shrink-0">
             <div>
                <p className="text-gold-base text-[clamp(0.6rem,1.1vh,0.8rem)] font-bold tracking-widest uppercase mb-2">Depoimentos</p>
                <h2 className="font-serif text-[clamp(1.75rem,4vh,2.5rem)] font-bold text-white tracking-tight leading-tight">
                    Quem usa,<span className="text-gold-base">vira fã</span>
                </h2>
             </div>

          </div>

          {/* Main Testimonial Card */}
          <div className="relative bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-[clamp(1.5rem,3vh,2rem)] overflow-hidden border border-neutral-700/30 shadow-2xl shadow-black/40 flex-1 min-h-0 flex flex-col">
             {/* Decorative Elements */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-gold-base/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
             <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>

             <div className="relative flex flex-col md:flex-row flex-1 min-h-0 h-full">
                {/* Left: Client Photo Area */}
                <div className="md:w-2/5 relative shrink-0 h-[35%] md:h-full">
                   <div className="absolute inset-0 bg-neutral-800 overflow-hidden">
                      <AnimatePresence mode="wait">
                         <motion.img 
                            key={testimonialIndex}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4 }}
                            src={testimonials[testimonialIndex].avatar} 
                            alt={testimonials[testimonialIndex].name}
                            className="absolute inset-0 w-full h-full object-cover"
                         />
                      </AnimatePresence>
                   </div>
                </div>

                {/* Right: Testimonial Content */}
                <div className="md:w-3/5 p-[clamp(1.25rem,2.5vh,2.5rem)] flex flex-col justify-between flex-1 min-h-0 overflow-y-auto no-scrollbar">
                   <div>
                       {/* Stars */}
                       <div className="flex items-center gap-1 mb-[clamp(0.75rem,2vh,1.5rem)]">
                           <div className="flex gap-0.5">
                              {[...Array(Math.floor(testimonials[testimonialIndex].rating))].map((_, i) => (
                                 <svg key={i} className="w-4 h-4 md:w-5 md:h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                              ))}
                           </div>
                           <span className="text-neutral-400 text-sm ml-2">{testimonials[testimonialIndex].rating.toFixed(1)}</span>
                       </div>

                       {/* Quote */}
                       <div className="mb-[clamp(1rem,2.5vh,2rem)] relative">
                          <svg className="w-6 h-6 md:w-8 md:h-8 text-gold-base/30 mb-2 md:mb-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
                          </svg>
                          <AnimatePresence mode="wait">
                            <motion.p
                               key={testimonialIndex}
                               initial={{ opacity: 0, y: 8 }}
                               animate={{ opacity: 1, y: 0 }}
                               exit={{ opacity: 0, y: -8 }}
                               transition={{ duration: 0.3 }}
                               className="text-white text-[clamp(0.9rem,1.8vh,1.25rem)] leading-relaxed font-light"
                            >
                               {testimonials[testimonialIndex].text}
                            </motion.p>
                          </AnimatePresence>
                       </div>
                   </div>

                   <div className="mt-auto">
                       {/* Client Info */}
                       <AnimatePresence mode="wait">
                          <motion.div
                             key={testimonialIndex}
                             initial={{ opacity: 0, x: 8 }}
                             animate={{ opacity: 1, x: 0 }}
                             exit={{ opacity: 0, x: -8 }}
                             transition={{ duration: 0.3 }}
                             className="flex items-center gap-3 md:gap-4 mb-[clamp(1rem,2.5vh,2rem)]"
                          >
                              <img 
                                 src={testimonials[testimonialIndex].avatar} 
                                 alt={testimonials[testimonialIndex].name}
                                 className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover shrink-0 border-2 border-neutral-700/50"
                              />
                              <div>
                                 <div className="text-white font-semibold text-sm md:text-base">{testimonials[testimonialIndex].name}</div>
                                 <div className="text-neutral-400 text-xs md:text-sm">{testimonials[testimonialIndex].since}</div>
                              </div>
                          </motion.div>
                       </AnimatePresence>

                       {/* Navigation */}
                       <div className="flex items-center justify-between pt-[clamp(0.75rem,2vh,1.5rem)] border-t border-neutral-700/50">
                           <div className="flex items-center gap-2 md:gap-3 w-full">
                               <button onClick={() => setTestimonialIndex(prev => prev === 0 ? testimonials.length - 1 : prev - 1)} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-neutral-700/50 hover:bg-neutral-600/50 border border-neutral-600/30 flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0">
                                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                               </button>

                               <div className="flex items-center justify-center gap-2 flex-1">
                                  {testimonials.map((_, idx) => (
                                     <button
                                        key={idx}
                                        onClick={() => setTestimonialIndex(idx)}
                                        className={`transition-all duration-300 rounded-full cursor-pointer shrink-0 ${idx === testimonialIndex ? 'w-6 h-2 md:w-8 md:h-2 bg-gold-base' : 'w-2 h-2 bg-neutral-600 hover:bg-neutral-500'}`}
                                     />
                                  ))}
                               </div>

                               <button onClick={() => setTestimonialIndex(prev => (prev + 1) % testimonials.length)} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-neutral-700/50 hover:bg-neutral-600/50 border border-neutral-600/30 flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0">
                                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                               </button>
                           </div>
                       </div>
                   </div>
                </div>
             </div>
          </div>

          {/* Google Reviews Link */}
          <div className="mt-[clamp(0.75rem,2vh,1.5rem)] flex justify-center shrink-0">
              <button onClick={handleOpenGoogleMaps} className="group inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors text-[clamp(0.75rem,1.5vh,0.875rem)] font-medium">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Ver mais avaliações no Google 
                  <span className="text-neutral-400">(4.9 · 1.2k avaliações)</span>
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
              </button>
          </div>
        </motion.div>
      </section>

      {/* SECTION 5: LOCALIZAÇÃO */}
      <section className="relative w-full h-full min-h-full max-h-full snap-start snap-always shrink-0 flex flex-col justify-between p-[clamp(0.75rem,2vh,2rem)] bg-white overflow-hidden box-border">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-neutral-50 border border-neutral-200/80 p-2 rounded-lg flex items-center gap-2 shadow-2xs">
                    <Clock className={`w-3.5 h-3.5 shrink-0 ${shopStatusInfo.status === 'open' ? 'text-emerald-500' : 'text-gold-base'}`} />
                    <div>
                      <span className="text-[8.5px] text-neutral-500 uppercase tracking-wider block font-bold">Horário Hoje</span>
                      <span className="text-[10.5px] font-bold text-neutral-800">
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
      <section className="relative w-full h-full min-h-full max-h-full snap-start snap-always shrink-0 flex flex-col justify-between bg-[#0a0b0e] text-white overflow-hidden box-border">
        
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
            <span className="flex items-center gap-1.5"><span className="text-[#4ade80] font-bold">✓</span> Confirmação instantânea</span>
            <span className="flex items-center gap-1.5"><span className="text-[#4ade80] font-bold">✓</span> Sem taxa de cancelamento</span>
            <span className="flex items-center gap-1.5"><span className="text-[#4ade80] font-bold">✓</span> Bebida cortesia no local</span>
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
