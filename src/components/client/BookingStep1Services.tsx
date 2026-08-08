import React, { useState, useEffect, useMemo } from 'react';
import { ServiceItem } from '../../types';
import { DEFAULT_CATEGORIES, getCategoryName } from '../../data/categories';
import { fetchServicesFromSupabase } from '../../services/supabaseDataService';
import { ServiceImageCarousel } from './ServiceImageCarousel';
import { ImageWithFallback } from '../ui/ImageWithFallback';
import { hapticLight, hapticMedium, hapticSuccess } from '../../lib/haptics';
import { optimizeImageUrl } from '../../lib/imageUtils';
import {
  Sparkles,
  Clock,
  CheckCircle,
  Plus,
  Search,
  X,
  Scissors,
  Flame,
  Star,
  Zap,
  Tag,
  ChevronDown,
  ChevronRight,
  Filter,
  SlidersHorizontal,
  Trash2,
  Info,
  Check,
  ShoppingBag,
  Share2,
  Copy,
  MessageCircle,
  ArrowRight,
  RefreshCw,
  Loader2
} from 'lucide-react';

interface BookingStep1Props {
  selectedServices: ServiceItem[];
  onToggleService: (service: ServiceItem) => void;
  onClearServices?: () => void;
  onNext: () => void;
}

export const BookingStep1Services: React.FC<BookingStep1Props> = ({
  selectedServices,
  onToggleService,
  onClearServices,
  onNext
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('cat_all');
  const [isCategoryOpen, setIsCategoryOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [modalService, setModalService] = useState<ServiceItem | null>(null);

  const getServiceImages = (s: ServiceItem): string[] => {
    if (s.gallery_urls && s.gallery_urls.length > 0) {
      return s.gallery_urls.map((url) => optimizeImageUrl(url, 600));
    }
    if (s.image_url) {
      return [optimizeImageUrl(s.image_url, 600)];
    }
    return [];
  };

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const data = await fetchServicesFromSupabase();
        if (isMounted) {
          setServices(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Erro ao carregar serviços:', err);
        if (isMounted) {
          setServices([]);
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter Services by Category and Search Query (Memoized)
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      // 1. Category filter
      if (activeCategory !== 'cat_all' && service.category_id !== activeCategory) {
        return false;
      }

      // 2. Search query filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchTitle = service.title.toLowerCase().includes(q);
        const matchDesc = service.description.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }

      return true;
    });
  }, [services, activeCategory, searchQuery]);

  // Group services into Netflix style horizontal rows (Memoized)
  const netflixRows = useMemo(() => {
    // If active search query or filtered category is set (other than cat_all), show unified section
    if (searchQuery.trim() !== '' || activeCategory !== 'cat_all') {
      return [
        {
          id: 'filtered',
          categoryId: activeCategory,
          title: activeCategory !== 'cat_all' ? `Catálogo: ${getCategoryName(activeCategory)}` : 'Resultados da busca',
          icon: <Filter className="w-4 h-4 text-gold-base" />,
          services: filteredServices,
        },
      ];
    }

    const rows: { id: string; categoryId?: string; title: string; icon: React.ReactNode; services: ServiceItem[] }[] = [];

    // 1. Mais Vendidos & Combos
    const popularServices = services.filter((s) => s.popular || s.is_combo);
    if (popularServices.length > 0) {
      rows.push({
        id: 'row_popular',
        categoryId: 'cat_all',
        title: 'Mais Vendidos & Destaques',
        icon: <Flame className="w-4 h-4 text-amber-500" />,
        services: popularServices,
      });
    }

    // 2. Cortes & Cabelo
    const cortesServices = services.filter(
      (s) =>
        s.category_id === 'cat_cabelo' ||
        s.category_id === 'cabelo' ||
        s.title.toLowerCase().includes('corte') ||
        s.title.toLowerCase().includes('degrade') ||
        s.title.toLowerCase().includes('cabelo')
    );
    if (cortesServices.length > 0) {
      rows.push({
        id: 'row_cortes',
        categoryId: 'cat_cabelo',
        title: 'Cortes & Cabelo',
        icon: <Scissors className="w-4 h-4 text-gold-base" />,
        services: cortesServices,
      });
    }

    // 3. Barba & Cuidados
    const barbaServices = services.filter(
      (s) =>
        s.category_id === 'cat_barba' ||
        s.category_id === 'barba' ||
        s.title.toLowerCase().includes('barba') ||
        s.title.toLowerCase().includes('toalha')
    );
    if (barbaServices.length > 0) {
      rows.push({
        id: 'row_barba',
        categoryId: 'cat_barba',
        title: 'Barba & Barbaterapia',
        icon: <Sparkles className="w-4 h-4 text-amber-400" />,
        services: barbaServices,
      });
    }

    // 4. Combos VIP
    const comboServices = services.filter((s) => s.is_combo || s.category_id === 'cat_combos');
    if (comboServices.length > 0) {
      rows.push({
        id: 'row_combos',
        categoryId: 'cat_combos',
        title: 'Combos VIP',
        icon: <Tag className="w-4 h-4 text-emerald-400" />,
        services: comboServices,
      });
    }

    // 5. Additional Categories
    DEFAULT_CATEGORIES.forEach((cat) => {
      if (['cat_cabelo', 'cat_barba', 'cat_combos'].includes(cat.id)) return;
      const catServices = services.filter((s) => s.category_id === cat.id);
      if (catServices.length > 0) {
        rows.push({
          id: `row_${cat.id}`,
          categoryId: cat.id,
          title: cat.name,
          icon: <Star className="w-4 h-4 text-gold-base" />,
          services: catServices,
        });
      }
    });

    // Fallback if no matching rows
    if (rows.length === 0) {
      rows.push({
        id: 'all',
        categoryId: 'cat_all',
        title: 'Todos os Serviços',
        icon: <Scissors className="w-4 h-4 text-gold-base" />,
        services: services,
      });
    }

    return rows;
  }, [services, activeCategory, searchQuery, filteredServices]);

  const totalDuration = selectedServices.reduce((acc, curr) => acc + curr.duration_minutes, 0);
  const totalPrice = selectedServices.reduce((acc, curr) => acc + curr.price, 0);

  return (
    <div className={`space-y-4 px-4 ${selectedServices.length > 0 ? 'pb-28' : 'pb-6'}`}>
      {/* Sticky Header, Search and Filters Container */}
      <div className="sticky top-0 z-40 bg-surface-base -mx-4 px-4 pt-3 pb-3 mb-4 border-b border-border-subtle shadow-md space-y-2.5">
        {/* Step 1 Title & Progress Indicator */}
        <div>
          <div className="flex justify-between items-end mb-1.5">
            <h1 className="text-lg font-extrabold text-content-base">
              Escolha o Serviço
            </h1>
            <span className="text-[10px] text-content-muted font-medium">
              PASSO 1 DE 4
            </span>
          </div>
          <div className="w-full h-1 bg-surface-card rounded-full overflow-hidden">
            <div className="h-full bg-gold-base text-surface-base w-1/4"></div>
          </div>
        </div>

        <div className="space-y-2">
          {/* Search Input Container */}
          <div className="relative">
            <Search className="w-4 h-4 text-content-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar serviço, corte, combo..."
              className="w-full bg-border-subtle backdrop-blur-[10px] text-content-base text-xs pl-9 pr-9 py-2 rounded-xl border border-border-subtle focus:border-gold-base focus:outline-none transition-colors placeholder-content-muted"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setSearchQuery('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-content-muted hover:text-content-base transition-colors"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Horizontal Scrollable Categories Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 pt-0.5">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveCategory('cat_all');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                activeCategory === 'cat_all'
                  ? 'bg-gold-base text-surface-base shadow-sm'
                  : 'bg-surface-card text-content-muted hover:text-content-base border border-border-subtle'
              }`}
            >
              Todos
            </button>
            {DEFAULT_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setActiveCategory(cat.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                    isActive
                      ? 'bg-gold-base text-surface-base shadow-sm'
                      : 'bg-surface-card text-content-muted hover:text-content-base border border-border-subtle'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Services Content - Netflix Style Horizontal Rows */}
      {loading ? (
        <div className="space-y-6">
          {[1, 2].map((row) => (
            <div key={row} className="space-y-3">
              <div className="h-5 w-40 rounded-lg animate-shimmer" />
              <div className="flex gap-3 overflow-hidden">
                {[1, 2, 3].map((card) => (
                  <div
                    key={card}
                    className="w-36 h-52 shrink-0 rounded-2xl animate-shimmer"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="py-10 px-6 my-6 mx-auto max-w-md flex flex-col items-center justify-center text-center space-y-3 bg-transparent">
          <div className="w-16 h-16 rounded-2xl bg-gold-base/10 border border-gold-base/30 text-gold-base flex items-center justify-center">
            <Search className="w-8 h-8 stroke-[2]" />
          </div>
          <p className="text-content-base font-extrabold text-base">Nenhum serviço encontrado</p>
          <p className="text-xs text-content-muted max-w-xs leading-relaxed">
            Não encontramos resultados para sua busca ou filtros ativos. Tente buscar por outros termos ou selecione outra categoria.
          </p>
          <button
            onClick={() => {
              setActiveCategory('cat_all');
              setSearchQuery('');
            }}
            className="mt-3 px-5 py-2.5 rounded-xl bg-gold-base/20 hover:bg-gold-base/30 text-gold-hover text-xs font-extrabold border border-gold-base/30 transition-all active:scale-95 flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Limpar Filtros de Busca</span>
          </button>
        </div>
      ) : (
        <div className={`space-y-7 ${selectedServices.length > 0 ? 'pb-28' : 'pb-4'}`}>
          {netflixRows.map((row) => {
            const isFeaturedCarousel = row.id === 'row_popular';

            return (
              <div key={row.id} className="space-y-3">
                {/* Row Header */}
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center space-x-2">
                    {row.icon}
                    <h2 className="text-base sm:text-lg font-black text-content-base tracking-tight">
                      {row.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      if (row.id === 'filtered') {
                        setActiveCategory('cat_all');
                        setSearchQuery('');
                      } else if (row.categoryId) {
                        setActiveCategory(row.categoryId);
                      }
                    }}
                    className="text-xs text-gold-base hover:text-gold-hover font-extrabold transition-colors flex items-center gap-0.5"
                  >
                    <span>{row.id === 'filtered' ? 'Ver categorias' : 'Ver todos'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Destaque (Mais Vendidos) em Carrossel Horizontal com cards mais largos */}
                {isFeaturedCarousel ? (
                  <div className="flex items-stretch overflow-x-auto no-scrollbar gap-3.5 sm:gap-4 pb-2 pt-0.5 -mx-4 px-4 scroll-smooth">
                    {row.services.map((service) => {
                      const isSelected = selectedServices.some((s) => s.id === service.id);
                      const images = getServiceImages(service);
                      const rawThumb = service.image_url || (images.length > 0 ? images[0] : null);
                      const thumbUrl = rawThumb ? optimizeImageUrl(rawThumb, 450) : null;

                      return (
                        <div
                          key={service.id}
                          onClick={() => {
                            hapticLight();
                            setModalService(service);
                          }}
                          className={`w-48 sm:w-60 shrink-0 rounded-2xl border cursor-pointer relative overflow-hidden transition-all duration-300 group flex flex-col justify-between shadow-xl hover:scale-[1.02] ${
                            isSelected
                              ? 'bg-surface-card border-gold-base ring-2 ring-gold-base shadow-gold-base/20'
                              : 'bg-surface-card border-border-subtle hover:border-gold-base/60'
                          }`}
                        >
                          {/* Image Container with Strong Black Bottom Gradient Overlay */}
                          <div className="h-52 sm:h-64 w-full relative bg-surface-base overflow-hidden flex items-center justify-center">
                            {thumbUrl ? (
                              <ImageWithFallback
                                src={thumbUrl}
                                alt={service.title}
                                decoding="async"
                                loading="eager"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full bg-surface-base flex items-center justify-center text-gold-base/40">
                                <Scissors className="w-12 h-12" />
                              </div>
                            )}

                            {/* Black Gradient Overlay concentrated where title and price sit at the bottom */}
                            <div className="absolute bottom-0 inset-x-0 h-3/5 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                            {/* Selection Badge */}
                            {isSelected && (
                              <div className="absolute top-2.5 right-2.5 z-20 w-7 h-7 rounded-full bg-gold-base text-surface-base flex items-center justify-center shadow-lg">
                                <Check className="w-4 h-4 stroke-[3]" />
                              </div>
                            )}

                            {/* Content Overlaid on Gradient at Bottom */}
                            <div className="absolute bottom-0 inset-x-0 p-3 flex flex-col justify-end space-y-1 z-10 pointer-events-none">
                              <h3 className="font-extrabold text-white text-sm sm:text-base leading-snug line-clamp-2 drop-shadow-md">
                                {service.title}
                              </h3>

                              <div className="flex items-center justify-between pt-1">
                                <span className="text-lg sm:text-xl font-black text-gold-base tracking-tight drop-shadow-md">
                                  R$ {service.price.toFixed(2)}
                                </span>
                                <span className="text-[10px] text-white/90 font-bold backdrop-blur-md bg-black/70 px-2 py-0.5 rounded-full border border-white/20">
                                  {service.duration_minutes} min
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Restante das Categorias em Grade Respondiva */
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {row.services.map((service) => {
                      const isSelected = selectedServices.some((s) => s.id === service.id);
                      const images = getServiceImages(service);
                      const rawThumb = service.image_url || (images.length > 0 ? images[0] : null);
                      const thumbUrl = rawThumb ? optimizeImageUrl(rawThumb, 400) : null;

                      return (
                        <div
                          key={service.id}
                          onClick={() => {
                            hapticLight();
                            setModalService(service);
                          }}
                          className={`w-full rounded-2xl border cursor-pointer relative overflow-hidden transition-all duration-300 group flex flex-col justify-between shadow-md hover:shadow-xl hover:scale-[1.02] ${
                            isSelected
                              ? 'bg-surface-card border-gold-base ring-2 ring-gold-base shadow-gold-base/20'
                              : 'bg-surface-card border-border-subtle hover:border-gold-base/60'
                          }`}
                        >
                          {/* Card Image Container with Black Gradient */}
                          <div className="h-56 sm:h-64 w-full relative bg-surface-base overflow-hidden flex items-center justify-center">
                            {thumbUrl ? (
                              <ImageWithFallback
                                src={thumbUrl}
                                alt={service.title}
                                decoding="async"
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full bg-surface-base flex items-center justify-center text-gold-base/40">
                                <Scissors className="w-10 h-10" />
                              </div>
                            )}

                            {/* Black Gradient Overlay concentrated at bottom for text legibility */}
                            <div className="absolute bottom-0 inset-x-0 h-3/5 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                            {/* Selection Checkmark */}
                            {isSelected && (
                              <div className="absolute top-2.5 right-2.5 z-20 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gold-base text-surface-base flex items-center justify-center shadow-lg">
                                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                              </div>
                            )}

                            {/* Content Overlaid at the Bottom of Card */}
                            <div className="absolute bottom-0 inset-x-0 p-2.5 sm:p-3 flex flex-col justify-end space-y-1 z-10 pointer-events-none">
                              <h3 className="font-extrabold text-white text-xs sm:text-sm leading-snug line-clamp-2 drop-shadow-md">
                                {service.title}
                              </h3>

                              <div className="flex items-center justify-between pt-0.5">
                                <span className="text-base sm:text-lg font-black text-gold-base tracking-tight drop-shadow-md">
                                  R$ {service.price.toFixed(2)}
                                </span>
                                <span className="text-[10px] text-white/90 font-bold backdrop-blur-md bg-black/70 px-2 py-0.5 rounded-full border border-white/20">
                                  {service.duration_minutes}m
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Bottom Tray with Clear ("Limpar") button */}
      {selectedServices.length > 0 && (
        <div className="sticky bottom-2 z-40 px-4 my-2 flex justify-center pointer-events-none animate-fade-in">
          <div className="pointer-events-auto w-full max-w-[440px] bg-surface-base/95 backdrop-blur-xl border border-border-subtle p-3.5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex items-center justify-between">
            <div className="flex flex-col pl-2">
              <div className="flex items-center space-x-1.5 mb-0.5">
                <span className="w-5 h-5 rounded-full bg-gold-base/20 flex items-center justify-center text-gold-base font-black text-[10px]">
                  {selectedServices.length}
                </span>
                <span className="text-[10px] text-content-muted font-bold uppercase tracking-wider">
                  {selectedServices.length === 1 ? 'Serviço' : 'Serviços'}
                </span>
              </div>
              <div className="text-xl font-serif text-content-base font-semibold leading-tight">
                R$ {totalPrice.toFixed(2)}
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
              {onClearServices && (
                <button
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    onClearServices();
                  }}
                  className="w-10 h-10 flex-shrink-0 rounded-full bg-border-subtle hover:bg-surface-card border border-border-subtle flex items-center justify-center text-content-base transition-all active:scale-95"
                  title="Limpar seleção"
                >
                  <Trash2 className="w-4 h-4 text-content-muted hover:text-red-400 transition-colors" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!isAdvancing) {
                    hapticSuccess();
                    setIsAdvancing(true);
                    onNext();
                  }
                }}
                disabled={isAdvancing}
                className={`px-5 py-2.5 rounded-full bg-gold-base text-surface-base font-bold text-xs sm:text-sm flex flex-shrink-0 items-center justify-center space-x-1.5 hover:opacity-95 transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-gold-base focus:ring-offset-2 focus:ring-offset-surface-base ${
                  isAdvancing ? 'opacity-80 cursor-wait' : 'active:scale-95'
                }`}
                title="Avançar para escolha de profissional"
              >
                <span>{isAdvancing ? 'Avançando...' : 'Avançar'}</span>
                {isAdvancing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Detail Bottom Sheet Modal */}
      {modalService && (
        <div
          className="fixed inset-0 bg-surface-base/80 backdrop-blur-[2px] z-50 flex items-end sm:items-center justify-center animate-fade-in p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-modal-title"
          onClick={() => {
            hapticLight();
            setModalService(null);
          }}
        >
          <div
            className="bg-surface-card border-t sm:border border-border-subtle rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header / Banner Image Carousel filling top edge */}
            <div className="relative h-72 sm:h-84 w-full bg-surface-base overflow-hidden rounded-t-3xl sm:rounded-t-2xl">
              {/* Bottom Sheet Handle Bar floating over image */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 w-12 h-1.5 bg-white/40 backdrop-blur-md rounded-full sm:hidden pointer-events-none" />

              <ServiceImageCarousel
                images={getServiceImages(modalService)}
                fallbackUrl={modalService.image_url}
                title={modalService.title}
                heightClass="h-72 sm:h-84"
              />
              {/* Soft Black Gradient Overlay at Bottom */}
              <div className="absolute bottom-0 inset-x-0 h-2/5 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

              {/* Share Button */}
              <button
                type="button"
                onClick={async () => {
                  hapticLight();
                  const currentUrl = window.location.origin;
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: modalService.title,
                        text: `Confira ${modalService.title} na Navo Premium!`,
                        url: currentUrl,
                      });
                    } catch (e) {}
                  } else {
                    navigator.clipboard.writeText(currentUrl);
                  }
                }}
                aria-label="Compartilhar serviço"
                className="absolute top-3 right-13 z-20 w-8 h-8 rounded-full bg-surface-card/80 text-content-base flex items-center justify-center border border-border-subtle hover:bg-surface-card transition-colors backdrop-blur-md"
              >
                <Share2 className="w-4 h-4" />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setModalService(null);
                }}
                aria-label="Fechar detalhes do serviço"
                className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-surface-card/80 text-content-base flex items-center justify-center border border-border-subtle hover:bg-surface-card transition-colors backdrop-blur-md"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Close & Share buttons overlay */}
            </div>

            {/* Modal Content Body */}
            <div className="p-5 space-y-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gold-base">
                  {getCategoryName(modalService.category_id)}
                </span>
                <h2 id="service-modal-title" className="text-xl sm:text-2xl font-extrabold text-content-base leading-tight mt-0.5">
                  {modalService.title}
                </h2>
                <div className="flex items-center space-x-2 text-xs text-content-muted mt-2">
                  <Clock className="w-4 h-4 text-gold-base" />
                  <span>Duração estimada: <strong className="text-content-base">{modalService.duration_minutes} minutos</strong></span>
                </div>
              </div>

              <div className="bg-surface-base p-4 rounded-xl border border-border-subtle/80 space-y-1">
                <span className="text-[10px] text-content-muted font-extrabold uppercase tracking-wider block">Sobre este serviço</span>
                <p className="text-xs sm:text-sm text-content-muted leading-relaxed">
                  {modalService.description || 'Atendimento profissional completo com produtos de primeira linha.'}
                </p>
              </div>

              {/* Bottom Sheet Action Bar */}
              <div className="pt-3 flex items-center justify-between border-t border-border-subtle gap-3">
                <div>
                  <span className="text-[10px] text-content-muted font-bold uppercase tracking-wider block">Valor</span>
                  <span className="text-2xl font-black text-gold-base">
                    R$ {modalService.price.toFixed(2)}
                  </span>
                </div>

                {(() => {
                  const isSelectedInModal = selectedServices.some((s) => s.id === modalService.id);

                  return (
                    <button
                      type="button"
                      onClick={() => {
                        hapticMedium();
                        onToggleService(modalService);
                        setModalService(null);
                      }}
                      className={`flex-1 max-w-[200px] py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${
                        isSelectedInModal
                          ? 'bg-surface-card text-content-base border border-border-subtle'
                          : 'bg-gold-base text-surface-base hover:opacity-95'
                      }`}
                    >
                      {isSelectedInModal ? (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Remover</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 stroke-[3]" />
                          <span>Adicionar</span>
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
