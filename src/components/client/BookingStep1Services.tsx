import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { ServiceItem } from '../../types';
import { DEFAULT_CATEGORIES, getCategoryName } from '../../data/categories';
import { fetchServicesFromSupabase } from '../../services/supabaseDataService';
import { ServiceImageCarousel } from './ServiceImageCarousel';
import { BookingActionDock } from './BookingActionDock';
import { ImageWithFallback } from '../ui/ImageWithFallback';
import { hapticLight, hapticMedium, hapticSuccess } from '../../lib/haptics';
import { optimizeImageUrl } from '../../lib/imageUtils';
import { useDialogFocus } from '../../hooks/useDialogFocus';
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
  Loader2,
  AlertCircle
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
  const { theme } = useTheme();
  const [activeCategory, setActiveCategory] = useState<string>('cat_all');
  const [isCategoryOpen, setIsCategoryOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalService, setModalService] = useState<ServiceItem | null>(null);
  const serviceModalRef = useRef<HTMLDivElement>(null);

  useDialogFocus(!!modalService, serviceModalRef);

  useEffect(() => {
    if (!modalService) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModalService(null);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [modalService]);

  const getServiceImages = (s: ServiceItem): string[] => {
    if (s.gallery_urls && s.gallery_urls.length > 0) {
      return s.gallery_urls.map((url) => optimizeImageUrl(url, 600));
    }
    if (s.image_url) {
      return [optimizeImageUrl(s.image_url, 600)];
    }
    return [];
  };

  async function loadData() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchServicesFromSupabase();
      setServices(data);
      setLoading(false);
    } catch (err: any) {
      console.error('Erro ao carregar serviços:', err);
      setServices([]);
      setLoading(false);
      setErrorMessage(err?.message || 'Sem conexão com o banco de dados. O agendamento está suspenso no momento.');
    }
  }

  useEffect(() => {
    loadData();
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
    // 1. Busca ativa
    if (searchQuery.trim() !== '') {
      return [
        {
          id: 'filtered',
          categoryId: activeCategory,
          title: 'Resultados da busca',
          icon: <Filter className="w-4 h-4 text-gold-base" />,
          services: filteredServices,
        },
      ];
    }

    const rows: { id: string; categoryId?: string; title: string; icon: React.ReactNode; services: ServiceItem[] }[] = [];

    // Destaques (se em cat_all ou na página inicial)
    const popularServices = services.filter((s) => s.popular || s.is_combo).slice(0, 6);
    if (popularServices.length > 0 && activeCategory === 'cat_all') {
      rows.push({
        id: 'row_popular',
        categoryId: 'cat_all',
        title: 'Mais Vendidos & Destaques',
        icon: <Flame className="w-4 h-4 text-amber-500" />,
        services: popularServices,
      });
    }

    // Categoria ativa (ou Todos)
    if (activeCategory === 'cat_all') {
      // Avoid duplicate rendering by filtering out popular ones from 'Todos'
      const remainingServices = services.filter(s => !(s.popular || s.is_combo));
      if (remainingServices.length > 0) {
        rows.push({
          id: 'row_all',
          categoryId: 'cat_all',
          title: 'Todos os Serviços',
          icon: <Scissors className="w-4 h-4 text-gold-base" />,
          services: remainingServices,
        });
      }
    } else {
      const activeCatData = DEFAULT_CATEGORIES.find(c => c.id === activeCategory);
      const catName = activeCatData ? activeCatData.name : 'Categoria';
      rows.push({
        id: `row_${activeCategory}`,
        categoryId: activeCategory,
        title: catName,
        icon: <Filter className="w-4 h-4 text-gold-base" />,
        services: filteredServices,
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
          <div data-gesture-scroll="horizontal" className="gesture-scroll-x flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-1">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveCategory('cat_all');
              }}
              className={`shrink-0 min-h-10 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
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
                  className={`shrink-0 min-h-10 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
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
      {errorMessage ? (
        <div className="py-10 px-6 my-6 mx-auto max-w-md flex flex-col items-center justify-center text-center space-y-3 bg-status-error/10 border border-status-error/30 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-status-error/20 text-status-error flex items-center justify-center">
            <AlertCircle className="w-7 h-7 stroke-[2]" />
          </div>
          <p className="text-content-base font-extrabold text-base">Sistema Indisponível</p>
          <p className="text-xs text-content-muted leading-relaxed">
            {errorMessage}
          </p>
          <button
            onClick={() => loadData()}
            className="mt-2 px-5 py-2.5 rounded-xl bg-status-error/20 hover:bg-status-error/30 text-status-error text-xs font-extrabold border border-status-error/30 transition-all active:scale-95 flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar Novamente</span>
          </button>
        </div>
      ) : loading ? (
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
          <p className="text-content-base font-extrabold text-base">
            {services.length === 0 ? 'Catálogo sem serviços disponíveis' : 'Nenhum serviço encontrado'}
          </p>
          <p className="text-xs text-content-muted max-w-xs leading-relaxed">
            {services.length === 0
              ? 'A equipe ainda não publicou serviços para agendamento. Tente atualizar novamente em instantes.'
              : 'Não encontramos resultados para sua busca ou filtros ativos. Tente buscar por outros termos ou selecione outra categoria.'}
          </p>
          <button
            onClick={() => {
              if (services.length === 0) {
                loadData();
                return;
              }
              setActiveCategory('cat_all');
              setSearchQuery('');
            }}
            className="mt-3 px-5 py-2.5 rounded-xl bg-gold-base/20 hover:bg-gold-base/30 text-gold-hover text-xs font-extrabold border border-gold-base/30 transition-all active:scale-95 flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{services.length === 0 ? 'Atualizar catálogo' : 'Limpar Filtros de Busca'}</span>
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
                  <div data-gesture-scroll="horizontal" className="gesture-scroll-x flex items-stretch overflow-x-auto no-scrollbar gap-3.5 sm:gap-4 pb-2 pt-0.5 -mx-4 px-4 scroll-smooth">
                    {row.services.map((service) => {
                      const isSelected = selectedServices.some((s) => s.id === service.id);
                      const images = getServiceImages(service);
                      const rawThumb = service.image_url || (images.length > 0 ? images[0] : null);
                      const thumbUrl = rawThumb ? optimizeImageUrl(rawThumb, 450) : null;

                      return (
                        <div
                          key={service.id}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          aria-label={`Ver detalhes de ${service.title}`}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              hapticLight();
                              setModalService(service);
                            }
                          }}
                          onClick={() => {
                            hapticLight();
                            setModalService(service);
                          }}
                          className={`w-48 sm:w-60 shrink-0 rounded-2xl border cursor-pointer relative overflow-hidden transition-all duration-300 group focus-visible:ring-2 focus-visible:ring-gold-base focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base flex flex-col justify-between shadow-xl hover:scale-[1.02] ${
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
                                  R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          aria-label={`Ver detalhes de ${service.title}`}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              hapticLight();
                              setModalService(service);
                            }
                          }}
                          onClick={() => {
                            hapticLight();
                            setModalService(service);
                          }}
                          className={`w-full rounded-2xl border cursor-pointer relative overflow-hidden transition-all duration-300 group focus-visible:ring-2 focus-visible:ring-gold-base focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base flex flex-col justify-between shadow-md hover:shadow-xl hover:scale-[1.02] ${
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
                                  R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {selectedServices.length > 0 && !modalService && (
        <BookingActionDock
          summaryLabel={`${selectedServices.length} ${selectedServices.length === 1 ? 'serviço selecionado' : 'serviços selecionados'}`}
          summaryValue={<span className="font-mono num-tabular">{totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
          clearAction={onClearServices ? {
            onClick: () => {
              hapticMedium();
              onClearServices();
            }
          } : undefined}
          primaryAction={{
            label: 'Continuar',
            onClick: () => {
              if (!isAdvancing) {
                hapticSuccess();
                setIsAdvancing(true);
                onNext();
              }
            },
            disabled: isAdvancing,
            loading: isAdvancing,
            title: 'Continuar para escolha de profissional'
          }}
        />
      )}

      {/* Service Detail Bottom Sheet Modal */}
      {modalService && (
        <div
          className="fixed inset-0 bg-surface-base/80 backdrop-blur-[2px] z-[150] flex items-end sm:items-center justify-center animate-fade-in p-0 sm:p-4"
          ref={serviceModalRef}
          tabIndex={-1}
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
                    R$ {modalService.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
