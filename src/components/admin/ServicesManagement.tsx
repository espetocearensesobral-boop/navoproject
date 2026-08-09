import React, { useState, useEffect } from 'react';
import { ServiceItem } from '../../types';
import { fetchServicesFromSupabase, saveServiceInSupabase, deleteServiceInSupabase, deleteAllServicesInSupabase } from '../../services/supabaseDataService';
import { DEFAULT_CATEGORIES, getCategoryName } from '../../data/categories';
import { AdminPageHeader } from './shared/AdminPageHeader';
import {
  Scissors,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  X,
  Save,
  Search,
  Filter,
  Image as ImageIcon,
  Copy,
  Star,
  Flame,
  LayoutGrid,
  List,
  Eye,
  Check,
  TrendingUp,
  DollarSign,
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';

// Preset photos for quick gallery assignment by the admin
const BARBERSHOP_IMAGE_PRESETS = [
  {
    title: 'Corte Degradê Navalhado',
    category: 'Cortes',
    url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=75&w=800'
  },
  {
    title: 'Barba Terapia com Toalha Quente',
    category: 'Barba',
    url: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&q=75&w=800'
  },
  {
    title: 'Acabamento & Pezinho',
    category: 'Cortes',
    url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=75&w=800'
  },
  {
    title: 'Corte com Tesoura & Estilização',
    category: 'Cortes',
    url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&q=75&w=800'
  },
  {
    title: 'Nevou / Platino Global',
    category: 'Química',
    url: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&q=75&w=800'
  },
  {
    title: 'Corte Infantil Estilizado',
    category: 'Cortes',
    url: 'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&q=75&w=800'
  },
  {
    title: 'Pigmentação & Barba Alinhada',
    category: 'Barba',
    url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=75&w=800'
  },
  {
    title: 'Sobrancelha & Alinhamento',
    category: 'Estética',
    url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=75&w=800'
  }
];

export const ServicesManagement: React.FC = () => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'combos' | 'popular' | 'gallery'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<'general' | 'pricing' | 'gallery'>('general');
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Lightbox State

  // Form State
  const [formData, setFormData] = useState<Partial<ServiceItem>>({
    title: '',
    category_id: 'cat_cortes',
    description: '',
    price: 60,
    original_price: 75,
    duration_minutes: 35,
    is_combo: false,
    popular: false,
    image_url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=75&w=800',
    gallery_urls: []
  });

  const [newGalleryUrlInput, setNewGalleryUrlInput] = useState('');

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    const data = await fetchServicesFromSupabase();
    setServices(data);
    setLoading(false);
  };

  const handleOpenCreate = () => {
    setEditingService(null);
    setFormData({
      title: '',
      category_id: 'cat_cortes',
      description: '',
      price: 60,
      original_price: 75,
      duration_minutes: 35,
      is_combo: false,
      popular: false,
      image_url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=75&w=800',
      gallery_urls: [
        'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=75&w=800',
        'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&q=75&w=800',
        'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=75&w=800'
      ]
    });
    setNewGalleryUrlInput('');
    setActiveFormTab('general');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (service: ServiceItem) => {
    setEditingService(service);
    const existingGallery = Array.isArray(service.gallery_urls) && service.gallery_urls.length > 0
      ? [...service.gallery_urls]
      : service.image_url ? [service.image_url] : [];
      
    setFormData({
      ...service,
      gallery_urls: existingGallery
    });
    setNewGalleryUrlInput('');
    setActiveFormTab('general');
    setIsModalOpen(true);
  };

  const handleDuplicate = (service: ServiceItem) => {
    const duplicated: Partial<ServiceItem> = {
      ...service,
      id: undefined,
      title: `${service.title} (Cópia)`,
    };
    setEditingService(null);
    setFormData(duplicated);
    setNewGalleryUrlInput('');
    setActiveFormTab('general');
    setIsModalOpen(true);
    showNotification('Serviço duplicado! Ajuste os dados e salve.');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este serviço do cardápio?')) {
      const updated = await deleteServiceInSupabase(id);
      setServices(updated);
      showNotification('Serviço removido com sucesso!');
    }
  };

  const handleTogglePopular = async (service: ServiceItem) => {
    const updatedService: ServiceItem = {
      ...service,
      popular: !service.popular
    };
    const updatedList = await saveServiceInSupabase(updatedService, true);
    setServices(updatedList);
    showNotification(updatedService.popular ? 'Serviço destacado no cardápio!' : 'Destaque removido.');
  };

  const handleToggleCombo = async (service: ServiceItem) => {
    const updatedService: ServiceItem = {
      ...service,
      is_combo: !service.is_combo
    };
    const updatedList = await saveServiceInSupabase(updatedService, true);
    setServices(updatedList);
    showNotification(updatedService.is_combo ? 'Serviço marcado como Combo VIP!' : 'Marcado como serviço simples.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.price || !formData.duration_minutes) {
      alert('Por favor, preencha o título, preço e duração do serviço.');
      return;
    }

    // Guarantee gallery has at least main image
    let currentGallery = formData.gallery_urls ? [...formData.gallery_urls] : [];
    if (formData.image_url && !currentGallery.includes(formData.image_url)) {
      currentGallery.unshift(formData.image_url);
    }

    // Calculate discount percentage if original price provided
    let calcDiscount = formData.discount_percentage;
    if (formData.original_price && formData.original_price > formData.price) {
      calcDiscount = Math.round(((formData.original_price - formData.price) / formData.original_price) * 100);
    }

    const itemToSave: ServiceItem = {
      id: editingService?.id || `srv_${Date.now()}`,
      category_id: formData.category_id || 'cat_cortes',
      title: formData.title || '',
      description: formData.description || '',
      price: Number(formData.price),
      duration_minutes: Number(formData.duration_minutes),
      is_combo: Boolean(formData.is_combo),
      original_price: formData.original_price ? Number(formData.original_price) : undefined,
      discount_percentage: calcDiscount,
      popular: Boolean(formData.popular),
      image_url: formData.image_url || (currentGallery.length > 0 ? currentGallery[0] : undefined),
      gallery_urls: currentGallery
    };

    const updatedList = await saveServiceInSupabase(itemToSave, Boolean(editingService));
    setServices(updatedList);
    setIsModalOpen(false);
    showNotification(editingService ? 'Serviço atualizado com sucesso!' : 'Novo serviço cadastrado!');
  };

  // Gallery handlers inside modal
  const handleAddGalleryUrl = () => {
    if (!newGalleryUrlInput.trim()) return;
    const url = newGalleryUrlInput.trim();
    const current = formData.gallery_urls ? [...formData.gallery_urls] : [];
    if (!current.includes(url)) {
      current.push(url);
      setFormData({
        ...formData,
        gallery_urls: current,
        image_url: formData.image_url || url
      });
    }
    setNewGalleryUrlInput('');
  };

  const handleRemoveGalleryImage = (indexToRemove: number) => {
    const current = formData.gallery_urls ? [...formData.gallery_urls] : [];
    const removedUrl = current[indexToRemove];
    current.splice(indexToRemove, 1);

    let newCover = formData.image_url;
    if (newCover === removedUrl) {
      newCover = current.length > 0 ? current[0] : '';
    }

    setFormData({
      ...formData,
      gallery_urls: current,
      image_url: newCover
    });
  };

  const handleSetCoverImage = (url: string) => {
    setFormData({
      ...formData,
      image_url: url
    });
    showNotification('Imagem definida como Capa Principal!');
  };

  const handleAddPresetImage = (url: string) => {
    const current = formData.gallery_urls ? [...formData.gallery_urls] : [];
    if (!current.includes(url)) {
      current.push(url);
    }
    setFormData({
      ...formData,
      gallery_urls: current,
      image_url: formData.image_url || url
    });
  };

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // Filter logic
  const filteredServices = services.filter((srv) => {
    const matchesSearch =
      srv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      srv.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || srv.category_id === selectedCategory;

    let matchesType = true;
    if (filterType === 'combos') matchesType = Boolean(srv.is_combo);
    if (filterType === 'popular') matchesType = Boolean(srv.popular);
    if (filterType === 'gallery') matchesType = Array.isArray(srv.gallery_urls) && srv.gallery_urls.length > 1;

    return matchesSearch && matchesCategory && matchesType;
  });

  // Calculate stats
  const totalServices = services.length;
  const totalCombos = services.filter((s) => s.is_combo).length;
  const avgDuration = totalServices > 0 ? Math.round(services.reduce((acc, s) => acc + s.duration_minutes, 0) / totalServices) : 0;
  const avgPrice = totalServices > 0 ? services.reduce((acc, s) => acc + s.price, 0) / totalServices : 0;

  return (
    <div className="space-y-4">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={Scissors}
        title="Cardápio de Serviços"
        stats={[
          { label: 'serviços', value: totalServices, tone: 'gold' },
          { label: 'VIPs', value: totalCombos, tone: 'success' },
          { label: 'duração méd.', value: `${avgDuration} min`, tone: 'info' },
          { label: 'preço méd.', value: `R$ ${avgPrice.toFixed(2)}`, tone: 'warning' },
        ]}
        action={{ label: 'Cadastrar Novo Serviço', onClick: handleOpenCreate, icon: Plus }}
      />

      {/* Ação (mobile) */}
      <button
        onClick={handleOpenCreate}
        className="md:hidden w-full bg-gold-base text-surface-base px-3.5 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
      >
        <Plus className="w-4 h-4" />
        <span>Cadastrar Novo Serviço</span>
      </button>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="p-3 bg-status-success/15 border border-status-success/30 text-status-success rounded-xl text-xs font-bold flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-xs text-content-muted hover:text-content-base">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* MOBILE SERVICES VIEW (COMPACT, MINIMALIST, SMART) - md:hidden */}
      {/* ========================================================= */}
      <div className="md:hidden space-y-3">
        {/* Compact Top Action Bar */}
        <div className="bg-surface-card p-3 rounded-2xl border border-border-subtle flex items-center justify-between gap-2">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar serviço..."
              className="w-full bg-surface-base border border-border-subtle rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-content-base placeholder-[#666666] outline-none focus:border-gold-base"
            />
          </div>
        </div>

        {/* Repositioned Category & Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => { setSelectedCategory('all'); setFilterType('all'); }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
              selectedCategory === 'all' && filterType === 'all'
                ? 'bg-gold-base text-surface-base border-gold-base'
                : 'bg-surface-card text-content-muted border-border-subtle hover:text-content-base'
            }`}
          >
            Todos ({services.length})
          </button>

          <button
            onClick={() => setFilterType(filterType === 'combos' ? 'all' : 'combos')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
              filterType === 'combos'
                ? 'bg-status-success text-surface-base border-status-success'
                : 'bg-surface-card text-content-muted border-border-subtle hover:text-content-base'
            }`}
          >
            🔥 Combos VIP
          </button>

          <button
            onClick={() => setFilterType(filterType === 'popular' ? 'all' : 'popular')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
              filterType === 'popular'
                ? 'bg-gold-base text-surface-base border-gold-base'
                : 'bg-surface-card text-content-muted border-border-subtle hover:text-content-base'
            }`}
          >
            ⭐ Destaques
          </button>

          {DEFAULT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategory(cat.id); setFilterType('all'); }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                selectedCategory === cat.id && filterType === 'all'
                  ? 'bg-gold-base text-surface-base border-gold-base'
                  : 'bg-surface-card text-content-muted border-border-subtle hover:text-content-base'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Compact Services List Feed */}
        <div className="space-y-2">
          {loading ? (
            <div className="p-8 text-center bg-surface-card rounded-2xl border border-border-subtle text-content-muted text-xs">
              <Scissors className="w-5 h-5 text-gold-hover animate-spin mx-auto mb-2" />
              <span>Carregando serviços...</span>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="p-8 text-center bg-surface-card rounded-2xl border border-border-subtle text-content-muted text-xs">
              Nenhum serviço encontrado.
            </div>
          ) : (
            filteredServices.map((service) => {
              const categoryName = getCategoryName(service.category_id);
              const servicePhotos = Array.isArray(service.gallery_urls) && service.gallery_urls.length > 0
                ? service.gallery_urls
                : service.image_url ? [service.image_url] : [];

              return (
                <div
                  key={service.id}
                  className="bg-surface-card p-3 rounded-2xl border border-border-subtle flex items-center justify-between gap-3"
                >
                  {/* Photo & Main Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="relative w-12 h-12 rounded-xl bg-surface-base border border-border-subtle overflow-hidden shrink-0"
                    >
                      {service.image_url || servicePhotos[0] ? (
                        <img
                          src={service.image_url || servicePhotos[0]}
                          alt={service.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gold-hover">
                          <Scissors className="w-5 h-5" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-content-base text-xs truncate">{service.title}</span>
                        {service.is_combo && (
                          <span className="text-[8px] bg-status-success/20 text-status-success font-black px-1.5 py-0.5 rounded-xl uppercase">Combo</span>
                        )}
                        {service.popular && (
                          <span className="text-[8px] bg-gold-base/20 text-gold-hover font-black px-1.5 py-0.5 rounded-xl uppercase">Destaque</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-content-muted mt-0.5">
                        <span className="text-content-base font-bold">R$ {service.price.toFixed(2)}</span>
                        <span>•</span>
                        <span>{service.duration_minutes} min</span>
                        <span>•</span>
                        <span className="truncate">{categoryName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(service)}
                      className="p-2 rounded-xl bg-surface-card text-gold-hover hover:bg-surface-card border border-border-subtle"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* DESKTOP SERVICES VIEW (FULL RICH MANAGEMENT) - hidden md:block */}
      {/* ========================================================= */}
      <div className="hidden md:block space-y-6">
      {/* Success Notification Banner */}
      {successMsg && (
        <div className="p-3.5 bg-status-success/20 border border-[#00A86B]/40 text-status-success rounded-xl text-xs font-bold flex items-center justify-between shadow-lg animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-status-success hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search, Category & Type Filters */}
      <div className="bg-surface-card p-4 rounded-2xl border border-border-subtle flex flex-col lg:flex-row items-center justify-between gap-4 shadow-lg">
        {/* Search */}
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou descrição..."
            className="w-full bg-surface-card border border-border-subtle rounded-xl pl-9 pr-3 py-2 text-xs text-content-base placeholder-[#8B8B8B] outline-none focus:border-gold-base transition-colors"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {/* Category Dropdown */}
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-gold-base" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-surface-card border border-border-subtle text-xs text-content-base rounded-xl px-3 py-2 outline-none focus:border-gold-base"
            >
              <option value="all">Todas as Categorias</option>
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center bg-surface-card p-1 rounded-xl border border-border-subtle">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                filterType === 'all' ? 'bg-gold-base text-surface-base shadow' : 'text-content-muted hover:text-content-base'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType('combos')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                filterType === 'combos' ? 'bg-status-success text-surface-base shadow' : 'text-content-muted hover:text-content-base'
              }`}
            >
              Combos VIP
            </button>
            <button
              onClick={() => setFilterType('popular')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                filterType === 'popular' ? 'bg-gold-base/30 text-gold-base shadow' : 'text-content-muted hover:text-content-base'
              }`}
            >
              Mais Pedidos
            </button>
            <button
              onClick={() => setFilterType('gallery')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                filterType === 'gallery' ? 'bg-blue-500/30 text-blue-300 shadow' : 'text-content-muted hover:text-content-base'
              }`}
            >
              Com Galeria
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-surface-card p-1 rounded-xl border border-border-subtle">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                viewMode === 'table' ? 'bg-surface-card text-gold-base' : 'text-content-muted hover:text-content-base'
              }`}
              title="Visualização em Tabela"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                viewMode === 'cards' ? 'bg-surface-card text-gold-base' : 'text-content-muted hover:text-content-base'
              }`}
              title="Visualização em Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Table Mode */}
      {viewMode === 'table' ? (
        <div className="w-full overflow-x-auto rounded-2xl border border-border-subtle bg-surface-card shadow-xl">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-surface-card border-b border-border-subtle text-[11px] font-extrabold text-gold-base uppercase tracking-wider whitespace-nowrap">
                <th className="py-3.5 px-4">Foto & Galeria</th>
                <th className="py-3.5 px-4">Serviço / Descrição</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Duração</th>
                <th className="py-3.5 px-4">Preço (R$)</th>
                <th className="py-3.5 px-4 text-center">Badges & Destaque</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-content-muted">
                    <div className="flex items-center justify-center space-x-2">
                      <Scissors className="w-5 h-5 text-gold-base animate-spin" />
                      <span>Carregando cardápio de serviços...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-content-muted">
                    Nenhum serviço encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredServices.map((service) => {
                  const categoryName = getCategoryName(service.category_id);
                  const servicePhotos = Array.isArray(service.gallery_urls) && service.gallery_urls.length > 0
                    ? service.gallery_urls
                    : service.image_url ? [service.image_url] : [];

                  return (
                    <tr key={service.id} className="hover:bg-surface-card transition-colors group">
                      {/* Photo Thumbnail & Lightbox Click */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div
                          className="relative group/img inline-block"
                        >
                          <div className="w-12 h-12 rounded-xl bg-surface-card border-2 border-content-base/60 overflow-hidden shadow-md relative flex items-center justify-center">
                            {service.image_url || servicePhotos[0] ? (
                              <img
                                src={service.image_url || servicePhotos[0]}
                                alt={service.title}
                                className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-300"
                              />
                            ) : (
                              <Scissors className="w-5 h-5 text-gold-base" />
                            )}
                            <div className="absolute inset-0 bg-surface-base/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-4 h-4 text-content-base" />
                            </div>
                          </div>

                          {/* Photos count pill */}
                          {servicePhotos.length > 0 && (
                            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-xl bg-surface-base/90 text-content-base text-[9px] font-extrabold border border-gold-base/40 shadow-sm flex items-center gap-0.5">
                              <ImageIcon className="w-2.5 h-2.5" />
                              <span>{servicePhotos.length}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Title & Description */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="max-w-xs">
                          <span className="font-serif text-content-base font-semibold text-sm block group-hover:text-gold-base transition-colors truncate">
                            {service.title}
                          </span>
                          <span className="text-[11px] text-content-muted block truncate" title={service.description}>
                            {service.description || 'Sem descrição cadastrada'}
                          </span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-surface-card text-gold-base text-[10px] font-bold border border-border-subtle">
                          {categoryName}
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5 text-gold-base font-semibold">
                          <Clock className="w-3.5 h-3.5 text-gold-base" />
                          <span>{service.duration_minutes} min</span>
                        </div>
                      </td>

                      {/* Price & Discounts */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono num-tabular text-content-base font-semibold text-sm text-gold-base">
                              R$ {service.price.toFixed(2)}
                            </span>
                            {service.original_price && service.original_price > service.price && (
                              <span className="text-[10px] text-content-muted line-through">
                                R$ {service.original_price.toFixed(2)}
                              </span>
                            )}
                          </div>
                          {service.discount_percentage && service.discount_percentage > 0 && (
                            <span className="text-[9px] text-status-success font-extrabold">
                              🔥 {service.discount_percentage}% OFF
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Badges / Quick Toggle Switches */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5">
                          {/* Toggle Combo */}
                          <button
                            onClick={() => handleToggleCombo(service)}
                            title="Clique para alterar Combo VIP"
                            className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all border ${
                              service.is_combo
                                ? 'bg-status-success text-surface-base border-[#00A86B] shadow-sm'
                                : 'bg-surface-card text-content-muted border-border-subtle hover:text-content-base'
                            }`}
                          >
                            {service.is_combo ? '🔥 Combo VIP' : '+ Combo'}
                          </button>

                          {/* Toggle Popular */}
                          <button
                            onClick={() => handleTogglePopular(service)}
                            title="Clique para alterar Destaque/Mais Pedido"
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase transition-all border ${
                              service.popular
                                ? 'bg-gold-base/20 text-gold-base border-gold-base/40 shadow-sm'
                                : 'bg-surface-card text-content-muted border-border-subtle hover:text-content-base'
                            }`}
                          >
                            {service.popular ? '⭐ Destaque' : '+ Destaque'}
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Duplicate */}
                          <button
                            onClick={() => handleDuplicate(service)}
                            className="p-1.5 rounded-lg bg-surface-card hover:bg-surface-base text-content-muted hover:text-content-base border border-border-subtle"
                            title="Duplicar / Clonar Serviço"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEdit(service)}
                            className="px-2.5 py-1.5 rounded-lg bg-surface-card hover:bg-surface-base text-content-base text-xs font-bold flex items-center space-x-1 border border-border-subtle"
                            title="Editar Serviço"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-gold-base" />
                            <span>Editar</span>
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(service.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                            title="Excluir Serviço"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid Mode (Compact Blocks) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredServices.map((service) => {
            const categoryName = getCategoryName(service.category_id);
            const servicePhotos = Array.isArray(service.gallery_urls) && service.gallery_urls.length > 0
              ? service.gallery_urls
              : service.image_url ? [service.image_url] : [];

            return (
              <div
                key={service.id}
                className="bg-surface-card rounded-2xl border border-border-subtle p-3 hover:border-gold-base/50 transition-all group flex flex-col justify-between shadow-lg"
              >
                <div className="flex items-center gap-3">
                  {/* Compact Header Image */}
                  <div className="relative w-20 h-20 rounded-xl bg-surface-base overflow-hidden shrink-0 border border-border-subtle flex items-center justify-center">
                    {service.image_url || servicePhotos[0] ? (
                      <img
                        src={service.image_url || servicePhotos[0]}
                        alt={service.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <Scissors className="w-8 h-8 text-gold-base/40" />
                    )}
                    {service.is_combo && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-xl bg-status-success text-surface-base text-[8px] font-black uppercase shadow">
                        Combo
                      </span>
                    )}
                    {service.popular && !service.is_combo && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-xl bg-gold-base text-surface-base text-[8px] font-black uppercase shadow">
                        Destaque
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="px-2 py-0.5 rounded-xl bg-surface-base text-gold-base text-[10px] font-bold border border-border-subtle">
                        {categoryName}
                      </span>
                      <div className="flex items-center space-x-1 text-[11px] text-content-muted font-medium">
                        <Clock className="w-3 h-3 text-gold-base" />
                        <span>{service.duration_minutes} min</span>
                      </div>
                    </div>

                    <h3 className="font-extrabold text-content-base text-sm leading-snug group-hover:text-gold-base transition-colors truncate">
                      {service.title}
                    </h3>

                    <p className="text-xs text-content-muted line-clamp-1 mt-0.5">
                      {service.description || 'Sem descrição cadastrada'}
                    </p>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-2.5 mt-2.5 border-t border-border-subtle/60 flex items-center justify-between">
                  <div>
                    <span className="text-base font-black text-gold-base">
                      R$ {service.price.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleDuplicate(service)}
                      className="p-1.5 rounded-xl bg-surface-base hover:bg-surface-card text-content-base border border-border-subtle"
                      title="Duplicar"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleOpenEdit(service)}
                      className="px-3 py-1.5 rounded-xl bg-gold-base text-surface-base text-xs font-extrabold flex items-center space-x-1 hover:opacity-95 shadow-sm"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Advanced Compact & Modular Create / Edit Service Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-base/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="bg-surface-card border border-border-subtle sm:border-gold-base/40 rounded-2xl w-full max-w-3xl h-[92vh] max-h-[680px] overflow-hidden shadow-2xl flex flex-col animate-fade-in">
            {/* Modal Top Header */}
            <div className="p-3.5 sm:p-4 bg-surface-base border-b border-border-subtle flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gold-base/10 border border-gold-base/30 flex items-center justify-center text-gold-hover">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-content-base truncate max-w-[220px] sm:max-w-md">
                    {editingService ? `Editar: ${editingService.title}` : 'Cadastrar Novo Serviço'}
                  </h2>
                  <p className="text-[10px] text-content-muted hidden sm:block">
                    Preencha informações do serviço, precificação e galeria de fotos.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-xl bg-surface-card text-content-muted hover:text-content-base flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Sidebar Navigation + Form Area */}
            <div className="flex flex-col sm:flex-row flex-1 overflow-hidden min-h-0">
              {/* Sidebar Navigation (Desktop: Left Column, Mobile: Top Horizontal Bar) */}
              <div className="sm:w-48 bg-surface-base border-b sm:border-b-0 sm:border-r border-border-subtle p-2 flex sm:flex-col gap-1 shrink-0 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveFormTab('general')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-left ${
                    activeFormTab === 'general'
                      ? 'bg-gold-base text-surface-base'
                      : 'text-content-muted hover:bg-surface-card hover:text-content-base'
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5 shrink-0" />
                  <span>1. Dados Gerais</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveFormTab('pricing')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-left ${
                    activeFormTab === 'pricing'
                      ? 'bg-gold-base text-surface-base'
                      : 'text-content-muted hover:bg-surface-card hover:text-content-base'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5 shrink-0" />
                  <span>2. Preço & Valores</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveFormTab('gallery')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-left ${
                    activeFormTab === 'gallery'
                      ? 'bg-gold-base text-surface-base'
                      : 'text-content-muted hover:bg-surface-card hover:text-content-base'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>3. Galeria ({formData.gallery_urls?.length || 0})</span>
                </button>
              </div>

              {/* Form Content Area */}
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-hidden">
                <div className="p-4 space-y-3.5 overflow-y-auto flex-1 custom-scrollbar">
                  {/* TAB 1: GENERAL INFO */}
                  {activeFormTab === 'general' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-bold text-gold-hover block mb-1">
                          Título do Serviço *
                        </label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="Ex: Corte Degradê Navalhado + Barba"
                          className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-content-base focus:border-gold-base outline-none"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-gold-hover block mb-1">
                            Categoria *
                          </label>
                          <select
                            value={formData.category_id}
                            onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                            className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-content-base focus:border-gold-base outline-none"
                          >
                            {DEFAULT_CATEGORIES.map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-gold-hover block mb-1">
                            Duração Estimada (Minutos) *
                          </label>
                          <div className="relative">
                            <Clock className="w-3.5 h-3.5 text-gold-hover absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="number"
                              value={formData.duration_minutes}
                              onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                              placeholder="35"
                              className="w-full bg-surface-base border border-border-subtle rounded-xl pl-8 pr-3 py-2.5 text-xs text-content-base focus:border-gold-base outline-none"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-gold-hover block mb-1">
                          Descrição Detalhada do Serviço
                        </label>
                        <textarea
                          rows={2}
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Descreva as etapas, produtos e o resultado..."
                          className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:border-gold-base outline-none resize-none"
                        />
                      </div>

                      {/* Destaques */}
                      <div className="p-3 bg-surface-base rounded-xl border border-border-subtle space-y-2">
                        <p className="text-[10px] font-bold text-gold-hover uppercase tracking-wider">Configuração de Destaque</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 p-2 rounded-xl bg-surface-card border border-border-subtle cursor-pointer hover:border-status-success/40">
                            <input
                              type="checkbox"
                              checked={formData.is_combo}
                              onChange={(e) => setFormData({ ...formData, is_combo: e.target.checked })}
                              className="w-3.5 h-3.5 accent-[#4CAF50]"
                            />
                            <div>
                              <span className="text-xs font-bold text-content-base block">🔥 Combo VIP</span>
                              <span className="text-[9px] text-content-muted">Pacote promocional</span>
                            </div>
                          </label>

                          <label className="flex items-center gap-2 p-2 rounded-xl bg-surface-card border border-border-subtle cursor-pointer hover:border-gold-base/40">
                            <input
                              type="checkbox"
                              checked={formData.popular}
                              onChange={(e) => setFormData({ ...formData, popular: e.target.checked })}
                              className="w-3.5 h-3.5 accent-gold-base"
                            />
                            <div>
                              <span className="text-xs font-bold text-content-base block">⭐ Mais Pedido</span>
                              <span className="text-[9px] text-content-muted">Selo no cardápio</span>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: PRICING */}
                  {activeFormTab === 'pricing' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-gold-hover block mb-1">
                            Preço de Venda (R$) *
                          </label>
                          <div className="relative">
                            <span className="text-xs text-gold-hover font-bold absolute left-3 top-1/2 -translate-y-1/2">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.price}
                              onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                              placeholder="60.00"
                              className="w-full bg-surface-base border border-border-subtle rounded-xl pl-8 pr-3 py-2.5 text-xs font-bold text-content-base focus:border-gold-base outline-none"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-gold-hover block mb-1">
                            Preço De / Sem Desconto (R$)
                          </label>
                          <div className="relative">
                            <span className="text-xs text-content-muted font-bold absolute left-3 top-1/2 -translate-y-1/2">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.original_price || ''}
                              onChange={(e) => setFormData({ ...formData, original_price: e.target.value ? Number(e.target.value) : undefined })}
                              placeholder="75.00"
                              className="w-full bg-surface-base border border-border-subtle rounded-xl pl-8 pr-3 py-2.5 text-xs text-content-base focus:border-gold-base outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {formData.original_price && formData.original_price > (formData.price || 0) && (
                        <div className="p-3 bg-status-success/10 border border-status-success/30 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Flame className="w-4 h-4 text-status-success" />
                            <span className="text-xs font-bold text-status-success">
                              Desconto de R$ {(formData.original_price - (formData.price || 0)).toFixed(2)}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-xl bg-status-success text-surface-base font-black text-[10px] uppercase">
                            {Math.round(((formData.original_price - (formData.price || 0)) / formData.original_price) * 100)}% OFF
                          </span>
                        </div>
                      )}

                      <div className="p-3 bg-surface-base rounded-xl border border-border-subtle text-xs text-content-muted space-y-1">
                        <p className="font-bold text-content-base flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-gold-hover" />
                          <span>Efeito de Preço Riscado</span>
                        </p>
                        <p className="text-[11px]">
                          Preencher o valor original ativa o selo promocional e mostra o preço de/por no agendamento do cliente.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: GALLERY */}
                  {activeFormTab === 'gallery' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-bold text-gold-hover block mb-1">
                          URL Foto de Capa Principal
                        </label>
                        <input
                          type="url"
                          value={formData.image_url || ''}
                          onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                          placeholder="https://..."
                          className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:border-gold-base outline-none"
                        />
                      </div>

                      <div className="p-3 bg-surface-base rounded-xl border border-border-subtle space-y-2">
                        <label className="text-[10px] font-bold text-gold-hover uppercase tracking-wider block">
                          Adicionar Foto por URL
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={newGalleryUrlInput}
                            onChange={(e) => setNewGalleryUrlInput(e.target.value)}
                            placeholder="Cole URL da foto..."
                            className="flex-1 bg-surface-card border border-border-subtle rounded-xl px-2.5 py-1.5 text-xs text-content-base outline-none focus:border-gold-base"
                          />
                          <button
                            type="button"
                            onClick={handleAddGalleryUrl}
                            className="px-3 py-1.5 rounded-xl bg-gold-base text-surface-base font-bold text-xs shrink-0"
                          >
                            Adicionar
                          </button>
                        </div>

                        <div className="pt-1">
                          <p className="text-[9px] text-content-muted font-bold uppercase mb-1.5">Fotos Sugeridas:</p>
                          <div className="grid grid-cols-4 gap-1.5">
                            {BARBERSHOP_IMAGE_PRESETS.slice(0, 4).map((preset, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleAddPresetImage(preset.url)}
                                className="relative rounded-lg overflow-hidden h-12 border border-border-subtle hover:border-gold-base text-left"
                              >
                                <img src={preset.url} alt={preset.title} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-surface-base/40 p-1 flex items-end">
                                  <span className="text-[8px] font-bold text-content-base truncate">{preset.title}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Photo List */}
                      <div>
                        <p className="text-xs font-bold text-content-base mb-2">Fotos Cadastradas ({formData.gallery_urls?.length || 0}):</p>
                        {formData.gallery_urls && formData.gallery_urls.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {formData.gallery_urls.map((imgUrl, index) => {
                              const isCover = formData.image_url === imgUrl;
                              return (
                                <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-surface-base border border-border-subtle">
                                  <img src={imgUrl} alt="Galeria" className="w-full h-full object-cover" />
                                  {isCover && (
                                    <span className="absolute top-1 left-1 bg-gold-base text-surface-base text-[8px] font-black px-1 rounded-xl">Capa</span>
                                  )}
                                  <div className="absolute bottom-1 right-1 flex gap-1">
                                    {!isCover && (
                                      <button
                                        type="button"
                                        onClick={() => handleSetCoverImage(imgUrl)}
                                        className="p-1 rounded-xl bg-surface-base/80 text-gold-hover text-[8px] font-bold"
                                      >
                                        Capa
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveGalleryImage(index)}
                                      className="p-1 rounded-xl bg-red-600 text-content-base"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-content-muted italic">Nenhuma foto adicionada.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Fixed Footer */}
                <div className="p-3 bg-surface-base border-t border-border-subtle flex items-center justify-between shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl bg-surface-card text-content-muted hover:text-content-base text-xs font-bold transition-colors"
                  >
                    Cancelar
                  </button>

                  <div className="flex items-center gap-2">
                    {activeFormTab !== 'gallery' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (activeFormTab === 'general') setActiveFormTab('pricing');
                          else if (activeFormTab === 'pricing') setActiveFormTab('gallery');
                        }}
                        className="px-3 py-2 rounded-xl bg-surface-card text-gold-hover text-xs font-bold flex items-center gap-1 border border-border-subtle"
                      >
                        <span>Avançar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-gold-base text-surface-base text-xs font-extrabold shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Salvar</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
