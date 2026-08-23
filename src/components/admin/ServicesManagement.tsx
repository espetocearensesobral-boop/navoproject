import React, { useState, useEffect } from "react";
import { ServiceItem } from "../../types";
import {
  fetchServicesFromSupabase,
  saveServiceInSupabase,
  deleteServiceInSupabase,
  deleteAllServicesInSupabase,
} from "../../services/supabaseDataService";
import { DEFAULT_CATEGORIES, getCategoryName } from "../../data/categories";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import { AdminEmptyState } from "./shared/AdminEmptyState";
import { Button } from "../ui/Button";
import { AdminLabel } from "../ui/AdminLabel";
import { handleEnterAsTab } from "../../utils/formUtils";
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
  ChevronDown,
  ChevronUp,
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
  Info,
} from "lucide-react";

// Preset photos for quick gallery assignment by the admin
const BARBERSHOP_IMAGE_PRESETS = [
  {
    title: "Corte Degradê Navalhado",
    category: "Cortes",
    url: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=75&w=800",
  },
  {
    title: "Barba Terapia com Toalha Quente",
    category: "Barba",
    url: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&q=75&w=800",
  },
  {
    title: "Acabamento & Pezinho",
    category: "Cortes",
    url: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=75&w=800",
  },
  {
    title: "Corte com Tesoura & Estilização",
    category: "Cortes",
    url: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&q=75&w=800",
  },
  {
    title: "Nevou / Platino Global",
    category: "Química",
    url: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&q=75&w=800",
  },
  {
    title: "Corte Infantil Estilizado",
    category: "Cortes",
    url: "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&q=75&w=800",
  },
  {
    title: "Pigmentação & Barba Alinhada",
    category: "Barba",
    url: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=75&w=800",
  },
  {
    title: "Sobrancelha & Alinhamento",
    category: "Estética",
    url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=75&w=800",
  },
];

export const ServicesManagement: React.FC = () => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<
    "all" | "combos" | "popular" | "gallery"
  >("all");
  const [viewMode, setViewMode] = useState<"table" | "list">("list");
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(
    null,
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<
    "general" | "pricing" | "gallery"
  >("general");
  const [editingService, setEditingService] = useState<ServiceItem | null>(
    null,
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Lightbox State

  // Form State
  const [formData, setFormData] = useState<Partial<ServiceItem>>({
    title: "",
    category_id: "cat_cortes",
    description: "",
    price: 60,
    original_price: 75,
    duration_minutes: 35,
    is_combo: false,
    popular: false,
    image_url:
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=75&w=800",
    gallery_urls: [],
  });

  const [newGalleryUrlInput, setNewGalleryUrlInput] = useState("");

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
      title: "",
      category_id: "cat_cortes",
      description: "",
      price: 60,
      original_price: 75,
      duration_minutes: 35,
      is_combo: false,
      popular: false,
      image_url:
        "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=75&w=800",
      gallery_urls: [
        "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=75&w=800",
        "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&q=75&w=800",
        "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=75&w=800",
      ],
    });
    setNewGalleryUrlInput("");
    setActiveFormTab("general");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (service: ServiceItem) => {
    setEditingService(service);
    const existingGallery =
      Array.isArray(service.gallery_urls) && service.gallery_urls.length > 0
        ? [...service.gallery_urls]
        : service.image_url
          ? [service.image_url]
          : [];

    setFormData({
      ...service,
      gallery_urls: existingGallery,
    });
    setNewGalleryUrlInput("");
    setActiveFormTab("general");
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este serviço do cardápio?")) {
      const updated = await deleteServiceInSupabase(id);
      setServices(updated);
      showNotification("Serviço removido com sucesso!");
    }
  };

  const handleTogglePopular = async (service: ServiceItem) => {
    const updatedService: ServiceItem = {
      ...service,
      popular: !service.popular,
    };
    const updatedList = await saveServiceInSupabase(updatedService, true);
    setServices(updatedList);
    showNotification(
      updatedService.popular
        ? "Serviço destacado no cardápio!"
        : "Destaque removido.",
    );
  };

  const handleToggleCombo = async (service: ServiceItem) => {
    const updatedService: ServiceItem = {
      ...service,
      is_combo: !service.is_combo,
    };
    const updatedList = await saveServiceInSupabase(updatedService, true);
    setServices(updatedList);
    showNotification(
      updatedService.is_combo
        ? "Serviço marcado como Combo VIP!"
        : "Marcado como serviço simples.",
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.price || !formData.duration_minutes) {
      alert("Por favor, preencha o título, preço e duração do serviço.");
      return;
    }

    // Guarantee gallery has at least main image
    let currentGallery = formData.gallery_urls
      ? [...formData.gallery_urls]
      : [];
    if (formData.image_url && !currentGallery.includes(formData.image_url)) {
      currentGallery.unshift(formData.image_url);
    }

    // Calculate discount percentage if original price provided
    let calcDiscount = formData.discount_percentage;
    if (formData.original_price && formData.original_price > formData.price) {
      calcDiscount = Math.round(
        ((formData.original_price - formData.price) / formData.original_price) *
          100,
      );
    }

    const itemToSave: ServiceItem = {
      id: editingService?.id || `srv_${Date.now()}`,
      category_id: formData.category_id || "cat_cortes",
      title: formData.title || "",
      description: formData.description || "",
      price: Number(formData.price),
      duration_minutes: Number(formData.duration_minutes),
      is_combo: Boolean(formData.is_combo),
      original_price: formData.original_price
        ? Number(formData.original_price)
        : undefined,
      discount_percentage: calcDiscount,
      popular: Boolean(formData.popular),
      image_url:
        formData.image_url ||
        (currentGallery.length > 0 ? currentGallery[0] : undefined),
      gallery_urls: currentGallery,
    };

    const updatedList = await saveServiceInSupabase(
      itemToSave,
      Boolean(editingService),
    );
    setServices(updatedList);
    setIsModalOpen(false);
    showNotification(
      editingService
        ? "Serviço atualizado com sucesso!"
        : "Novo serviço cadastrado!",
    );
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
        image_url: formData.image_url || url,
      });
    }
    setNewGalleryUrlInput("");
  };

  const handleRemoveGalleryImage = (indexToRemove: number) => {
    const current = formData.gallery_urls ? [...formData.gallery_urls] : [];
    const removedUrl = current[indexToRemove];
    current.splice(indexToRemove, 1);

    let newCover = formData.image_url;
    if (newCover === removedUrl) {
      newCover = current.length > 0 ? current[0] : "";
    }

    setFormData({
      ...formData,
      gallery_urls: current,
      image_url: newCover,
    });
  };

  const handleSetCoverImage = (url: string) => {
    setFormData({
      ...formData,
      image_url: url,
    });
    showNotification("Imagem definida como Capa Principal!");
  };

  const handleAddPresetImage = (url: string) => {
    const current = formData.gallery_urls ? [...formData.gallery_urls] : [];
    if (!current.includes(url)) {
      current.push(url);
    }
    setFormData({
      ...formData,
      gallery_urls: current,
      image_url: formData.image_url || url,
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
    const matchesCategory =
      selectedCategory === "all" || srv.category_id === selectedCategory;

    let matchesType = true;
    if (filterType === "combos") matchesType = Boolean(srv.is_combo);
    if (filterType === "popular") matchesType = Boolean(srv.popular);
    if (filterType === "gallery")
      matchesType =
        Array.isArray(srv.gallery_urls) && srv.gallery_urls.length > 1;

    return matchesSearch && matchesCategory && matchesType;
  });

  // Calculate stats
  const totalServices = services.length;
  const totalCombos = services.filter((s) => s.is_combo).length;
  const avgDuration =
    totalServices > 0
      ? Math.round(
          services.reduce((acc, s) => acc + s.duration_minutes, 0) /
            totalServices,
        )
      : 0;
  const avgPrice =
    totalServices > 0
      ? services.reduce((acc, s) => acc + s.price, 0) / totalServices
      : 0;

  return (
    <div className="space-y-4">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={Scissors}
        title="Serviços"
        stats={[
          { label: "serviços", value: totalServices, tone: "gold" },
          { label: "VIPs", value: totalCombos, tone: "success" },
          { label: "duração méd.", value: `${avgDuration} min`, tone: "info" },
          {
            label: "preço méd.",
            value: `R$ ${avgPrice.toFixed(2)}`,
            tone: "finance-positive",
          },
        ]}
        action={{
          label: "Novo serviço",
          onClick: handleOpenCreate,
          icon: Plus,
        }}
      />

      {/* Ação mobile: mesmo padrão de Produtos & Estoque */}
      <button
        onClick={handleOpenCreate}
        title="Novo serviço"
        aria-label="Novo serviço"
        className="md:hidden w-full h-10 rounded-xl bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold text-xs flex items-center justify-center gap-2 active:scale-95 shadow-md"
      >
        <Plus className="w-4 h-4" />
        <span>Novo serviço</span>
      </button>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="p-3 bg-status-success/15 border border-status-success/30 text-status-success rounded-xl text-xs font-bold flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-xs text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8B8B]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou descrição..."
            className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl pl-9 pr-3 py-2 text-xs text-[var(--admin-text-main)] placeholder-[#8B8B8B] outline-none focus:border-[var(--admin-accent)] transition-colors"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {/* Category Dropdown */}
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-[var(--admin-accent)]" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[var(--admin-surface)] border border-[var(--admin-border)] text-xs text-[var(--admin-text-main)] rounded-xl px-3 py-2 outline-none focus:border-[var(--admin-accent)]"
            >
              <option value="all">Todas</option>
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center bg-[var(--admin-surface)] p-1 rounded-xl border border-[var(--admin-border)]">
            <button
              onClick={() => setFilterType("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                filterType === "all"
                  ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)] shadow"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType("combos")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                filterType === "combos"
                  ? "bg-status-success text-white shadow"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
              }`}
            >
              Combos VIP
            </button>
            <button
              onClick={() => setFilterType("popular")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                filterType === "popular"
                  ? "bg-[var(--admin-accent)]/30 text-[var(--admin-accent)] shadow"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
              }`}
            >
              Mais Pedidos
            </button>
            <button
              onClick={() => setFilterType("gallery")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                filterType === "gallery"
                  ? "bg-blue-500/30 text-blue-300 shadow"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
              }`}
            >
              Com Galeria
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[var(--admin-surface)] p-1 rounded-xl border border-[var(--admin-border)]">
            <button
              onClick={() => setViewMode("table")}
              className={`min-h-10 px-2 rounded-lg text-xs transition-all ${
                viewMode === "table"
                  ? "bg-[var(--admin-accent)]/15 text-[var(--admin-accent)]"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
              }`}
              title="Visualização em Tabela"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`min-h-10 px-2 rounded-lg text-xs transition-all ${
                viewMode === "list"
                  ? "bg-[var(--admin-accent)]/15 text-[var(--admin-accent)]"
                  : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
              }`}
              title="Visualização em Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="admin-table-container">
        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="w-12">Foto</th>
                <th>Serviço / Descrição</th>
                <th>Categoria</th>
                <th>Duração</th>
                <th>Preço</th>
                <th className="text-center">Tags</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--admin-text-muted)]">
                    <div className="flex items-center justify-center space-x-2">
                      <Scissors className="w-5 h-5 text-[var(--admin-accent)] animate-spin" />
                      <span>Carregando serviços...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--admin-text-muted)]">
                    Nenhum serviço encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredServices.map((service) => {
                  const categoryName = getCategoryName(service.category_id);
                  const servicePhotos =
                    Array.isArray(service.gallery_urls) && service.gallery_urls.length > 0
                      ? service.gallery_urls
                      : service.image_url
                        ? [service.image_url]
                        : [];

                  return (
                    <tr key={service.id}>
                      <td>
                        <div className="w-10 h-10 rounded border border-[var(--admin-border)] bg-[var(--admin-bg)] flex items-center justify-center overflow-hidden relative">
                          {service.image_url || servicePhotos[0] ? (
                            <img src={service.image_url || servicePhotos[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Scissors className="w-5 h-5 text-[var(--admin-text-muted)]" />
                          )}
                          {servicePhotos.length > 0 && (
                            <span className="absolute bottom-0 right-0 px-1 py-0.5 text-[9px] font-bold bg-[var(--admin-bg)]/80 rounded-tl-sm text-[var(--admin-text-main)]">
                              {servicePhotos.length}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="font-bold text-[var(--admin-text-main)] admin-clamp-1">{service.title}</div>
                        <div className="text-xs text-[var(--admin-text-muted)] admin-clamp-1" title={service.description}>
                          {service.description || "Sem descrição"}
                        </div>
                      </td>
                      <td className="text-[var(--admin-text-muted)]">
                        <span className="text-xs font-bold text-[var(--admin-accent)] uppercase tracking-wider">
                          {categoryName}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center space-x-1.5 text-[var(--admin-text-main)] font-semibold">
                          <Clock className="w-3.5 h-3.5 text-[var(--admin-text-muted)]" />
                          <span>{service.duration_minutes} min</span>
                        </div>
                      </td>
                      <td>
                        <div className="font-mono font-bold text-[var(--admin-text-main)]">R$ {service.price.toFixed(2)}</div>
                        {service.original_price && service.original_price > service.price && (
                          <div className="font-mono text-xs text-[var(--admin-text-muted)] line-through">
                            R$ {service.original_price.toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                           <button
                             type="button"
                             onClick={() => handleToggleCombo(service)}
                             className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                               service.is_combo
                                 ? "bg-status-success/10 text-status-success border border-status-success/20"
                                 : "bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border border-[var(--admin-border)] hover:bg-[var(--admin-surface)]"
                             }`}
                             title="Alternar Combo VIP"
                           >
                             Combo
                           </button>
                           <button
                             type="button"
                             onClick={() => handleTogglePopular(service)}
                             className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                               service.popular
                                 ? "bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] border border-[var(--admin-accent)]/20"
                                 : "bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border border-[var(--admin-border)] hover:bg-[var(--admin-surface)]"
                             }`}
                             title="Alternar Destaque"
                           >
                             Destaq.
                           </button>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(service)}
                            className="admin-btn-icon-sm rounded text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-surface)]"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(service.id)}
                            className="admin-btn-icon-sm rounded text-[var(--admin-text-muted)] hover:text-status-error hover:bg-status-error/10"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* MOBILE LIST VIEW */}
        <div className="md:hidden divide-y divide-[var(--admin-border)]">
          {loading ? (
             <div className="p-8 text-center bg-[var(--admin-surface)] text-sm text-[var(--admin-text-muted)]">
               <Scissors className="w-5 h-5 text-[var(--admin-accent)] animate-spin mx-auto mb-2" />
               Carregando serviços...
             </div>
          ) : filteredServices.length === 0 ? (
            <AdminEmptyState
              icon={Scissors}
              title={
                searchQuery || selectedCategory !== "all" || filterType !== "all"
                  ? "Nenhum serviço encontrado"
                  : "Nenhum serviço cadastrado"
              }
              description="Ajuste a busca ou cadastre o primeiro serviço."
              actionLabel="Novo serviço"
              onAction={handleOpenCreate}
            />
          ) : (
            filteredServices.map((service) => {
              const categoryName = getCategoryName(service.category_id);
              const servicePhotos = Array.isArray(service.gallery_urls) && service.gallery_urls.length > 0
                ? service.gallery_urls
                : service.image_url
                  ? [service.image_url]
                  : [];
              const isExpanded = expandedServiceId === service.id;

              return (
                <article key={service.id} className="bg-[var(--admin-surface)] overflow-hidden transition-colors">
                  <button
                    type="button"
                    onClick={() => setExpandedServiceId(isExpanded ? null : service.id)}
                    aria-expanded={isExpanded}
                    className="w-full min-h-[76px] p-3.5 text-left flex items-center gap-3 hover:bg-[var(--admin-bg)]/40"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] overflow-hidden flex items-center justify-center shrink-0 relative">
                      {service.image_url || servicePhotos[0] ? (
                        <img src={service.image_url || servicePhotos[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Scissors className="w-5 h-5 text-[var(--admin-accent)]/70" />
                      )}
                      {servicePhotos.length > 0 && (
                        <span className="absolute bottom-0 right-0 px-1 text-[9px] font-bold bg-[var(--admin-bg)]/90 text-[var(--admin-text-main)] rounded-tl-md">
                          {servicePhotos.length}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-accent)] admin-clamp-2">
                          {categoryName}
                        </p>
                        {service.is_combo && (
                          <span className="shrink-0 rounded px-1.5 py-0.5 bg-status-success/10 text-status-success border border-status-success/20 text-[10px] font-bold uppercase tracking-wider">
                            Combo
                          </span>
                        )}
                      </div>
                      <h2 className="mt-0.5 text-sm font-bold text-[var(--admin-text-main)] admin-clamp-2">
                        {service.title}
                      </h2>
                    </div>
                    <div className="text-right shrink-0 min-w-[58px]">
                       <p className="text-xs font-bold finance-positive font-mono">
                         R$ {service.price.toFixed(2)}
                       </p>
                       <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)] mt-0.5">
                         {service.duration_minutes} min
                       </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[var(--admin-accent)] shrink-0 ml-1" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--admin-text-muted)] shrink-0 ml-1" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="border-t border-[var(--admin-border)] bg-[var(--admin-bg)]/35 p-3.5 space-y-3">
                      {service.description && (
                        <p className="text-xs text-[var(--admin-text-muted)] mb-3">{service.description}</p>
                      )}
                      <div className="flex gap-2 border-t border-[var(--admin-border)] pt-2">
                        <button
                          type="button"
                          onClick={() => handleToggleCombo(service)}
                          className={`flex-1 min-h-10 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                            service.is_combo
                              ? "bg-status-success/10 text-status-success border-status-success/20"
                              : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border-[var(--admin-border)] hover:bg-[var(--admin-bg)]"
                          }`}
                        >
                           <Flame className="w-3.5 h-3.5" /> Combo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePopular(service)}
                          className={`flex-1 min-h-10 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                            service.popular
                              ? "bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] border-[var(--admin-accent)]/20"
                              : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border-[var(--admin-border)] hover:bg-[var(--admin-bg)]"
                          }`}
                        >
                           <Star className="w-3.5 h-3.5" /> Destaque
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(service)}
                          className="flex-1 min-h-10 rounded-lg border border-[var(--admin-border)] text-[var(--admin-text-main)] hover:bg-[var(--admin-surface)] text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Edit2 className="w-4 h-4" /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(service.id)}
                          className="w-10 h-10 shrink-0 rounded-lg border border-status-error/25 text-status-error hover:bg-status-error/10 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>

      {/* Advanced Compact & Modular Create / Edit Service Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[var(--admin-bg)]/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] sm:border-[var(--admin-accent)]/40 rounded-2xl w-full max-w-3xl h-[92vh] max-h-[680px] overflow-hidden shadow-2xl flex flex-col animate-fade-in">
            {/* Modal Top Header */}
            <div className="p-3.5 sm:p-4 bg-[var(--admin-bg)] border-b border-[var(--admin-border)] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[var(--admin-accent)]/10 border border-[var(--admin-accent)]/30 flex items-center justify-center text-[var(--admin-accent)]">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[var(--admin-text-main)] truncate max-w-[220px] sm:max-w-md">
                    {editingService
                      ? `Editar: ${editingService.title}`
                      : "Novo serviço"}
                  </h2>
                  <p className="text-xs text-[var(--admin-text-muted)] hidden sm:block">
                    Preencha informações do serviço, precificação e galeria de
                    fotos.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-xl bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Sidebar Navigation + Form Area */}
            <div className="flex flex-col sm:flex-row flex-1 overflow-hidden min-h-0">
              {/* Sidebar Navigation (Desktop: Left Column, Mobile: Top Horizontal Bar) */}
              <div className="sm:w-48 bg-[var(--admin-bg)] border-b sm:border-b-0 sm:border-r border-[var(--admin-border)] p-2 flex sm:flex-col gap-1 shrink-0 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveFormTab("general")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-left ${
                    activeFormTab === "general"
                      ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)]"
                      : "text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface)] hover:text-[var(--admin-text-main)]"
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5 shrink-0" />
                  <span>1. Dados Gerais</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveFormTab("pricing")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-left ${
                    activeFormTab === "pricing"
                      ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)]"
                      : "text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface)] hover:text-[var(--admin-text-main)]"
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5 shrink-0" />
                  <span>2. Preço & Valores</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveFormTab("gallery")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-left ${
                    activeFormTab === "gallery"
                      ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)]"
                      : "text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface)] hover:text-[var(--admin-text-main)]"
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>3. Galeria ({formData.gallery_urls?.length || 0})</span>
                </button>
              </div>

              {/* Form Content Area */}
              <form
                onKeyDown={handleEnterAsTab}
                onSubmit={handleSubmit}
                className="flex-1 flex flex-col justify-between overflow-hidden"
              >
                <div className="p-4 space-y-3.5 overflow-y-auto flex-1 custom-scrollbar">
                  {/* TAB 1: GENERAL INFO */}
                  {activeFormTab === "general" && (
                    <div className="space-y-3">
                      <div>
                        <AdminLabel tone="accent">
                          Título do Serviço *
                        </AdminLabel>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) =>
                            setFormData({ ...formData, title: e.target.value })
                          }
                          placeholder="Ex: Corte Degradê Navalhado + Barba"
                          className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2.5 text-xs text-[var(--admin-text-main)] focus:border-[var(--admin-accent)] outline-none"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <AdminLabel tone="accent">Categoria *</AdminLabel>
                          <select
                            value={formData.category_id}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                category_id: e.target.value,
                              })
                            }
                            className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2.5 text-xs text-[var(--admin-text-main)] focus:border-[var(--admin-accent)] outline-none"
                          >
                            {DEFAULT_CATEGORIES.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <AdminLabel tone="accent">
                            Duração Estimada (Minutos) *
                          </AdminLabel>
                          <div className="relative">
                            <Clock className="w-3.5 h-3.5 text-[var(--admin-accent)] absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="number"
                              value={formData.duration_minutes}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  duration_minutes: Number(e.target.value),
                                })
                              }
                              placeholder="35"
                              className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl pl-8 pr-3 py-2.5 text-xs finance-positive focus:border-[var(--admin-accent)] outline-none"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <AdminLabel tone="accent">
                          Descrição Detalhada do Serviço
                        </AdminLabel>
                        <textarea
                          rows={2}
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              description: e.target.value,
                            })
                          }
                          placeholder="Descreva as etapas, produtos e o resultado..."
                          className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-xs text-[var(--admin-text-main)] focus:border-[var(--admin-accent)] outline-none resize-none"
                        />
                      </div>

                      {/* Destaques */}
                      <div className="p-3 bg-[var(--admin-bg)] rounded-xl border border-[var(--admin-border)] space-y-2">
                        <p className="text-xs font-bold text-[var(--admin-accent)] uppercase tracking-wider">
                          Configuração de Destaque
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 p-2 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] cursor-pointer hover:border-status-success/40">
                            <input
                              type="checkbox"
                              checked={formData.is_combo}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  is_combo: e.target.checked,
                                })
                              }
                              className="w-3.5 h-3.5 accent-[#4CAF50]"
                            />
                            <div>
                              <span className="text-xs font-bold text-[var(--admin-text-main)] block">
                                Combo VIP
                              </span>
                              <span className="text-xs text-[var(--admin-text-muted)]">
                                Pacote promocional
                              </span>
                            </div>
                          </label>

                          <label className="flex items-center gap-2 p-2 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] cursor-pointer hover:border-[var(--admin-accent)]/40">
                            <input
                              type="checkbox"
                              checked={formData.popular}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  popular: e.target.checked,
                                })
                              }
                              className="w-3.5 h-3.5 accent-gold-base"
                            />
                            <div>
                              <span className="text-xs font-bold text-[var(--admin-text-main)] block">
                                Mais pedido
                              </span>
                              <span className="text-xs text-[var(--admin-text-muted)]">
                                Selo no cardápio
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: PRICING */}
                  {activeFormTab === "pricing" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <AdminLabel
                            tone="default"
                            className="finance-positive"
                          >
                            Preço de Venda (R$) *
                          </AdminLabel>
                          <div className="relative">
                            <span className="text-xs finance-positive font-bold absolute left-3 top-1/2 -translate-y-1/2">
                              R$
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.price}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  price: Number(e.target.value),
                                })
                              }
                              placeholder="60.00"
                              className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl pl-8 pr-3 py-2.5 text-xs font-bold finance-positive focus:border-[var(--admin-accent)] outline-none"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <AdminLabel
                            tone="default"
                            className="finance-positive"
                          >
                            Preço De / Sem Desconto (R$)
                          </AdminLabel>
                          <div className="relative">
                            <span className="text-xs finance-positive font-bold absolute left-3 top-1/2 -translate-y-1/2">
                              R$
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.original_price || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  original_price: e.target.value
                                    ? Number(e.target.value)
                                    : undefined,
                                })
                              }
                              placeholder="75.00"
                              className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl pl-8 pr-3 py-2.5 text-xs finance-positive focus:border-[var(--admin-accent)] outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {formData.original_price &&
                        formData.original_price > (formData.price || 0) && (
                          <div className="p-3 finance-negative-soft finance-negative-border rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Flame className="w-4 h-4 finance-negative" />
                              <span className="text-xs font-bold finance-negative">
                                Desconto de R${" "}
                                {(
                                  formData.original_price -
                                  (formData.price || 0)
                                ).toFixed(2)}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-xl finance-negative-soft finance-negative font-black text-xs uppercase">
                              {Math.round(
                                ((formData.original_price -
                                  (formData.price || 0)) /
                                  formData.original_price) *
                                  100,
                              )}
                              % OFF
                            </span>
                          </div>
                        )}

                      <div className="p-3 bg-[var(--admin-bg)] rounded-xl border border-[var(--admin-border)] text-xs text-[var(--admin-text-muted)] space-y-1">
                        <p className="font-bold text-[var(--admin-text-main)] flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-[var(--admin-accent)]" />
                          <span>Efeito de Preço Riscado</span>
                        </p>
                        <p className="text-xs">
                          Preencher o valor original ativa o selo promocional e
                          mostra o preço de/por no agendamento do cliente.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: GALLERY */}
                  {activeFormTab === "gallery" && (
                    <div className="space-y-3">
                      <div>
                        <AdminLabel tone="accent">
                          URL Foto de Capa Principal
                        </AdminLabel>
                        <input
                          type="url"
                          value={formData.image_url || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              image_url: e.target.value,
                            })
                          }
                          placeholder="https://..."
                          className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-xs text-[var(--admin-text-main)] focus:border-[var(--admin-accent)] outline-none"
                        />
                      </div>

                      <div className="p-3 bg-[var(--admin-bg)] rounded-xl border border-[var(--admin-border)] space-y-2">
                        <AdminLabel tone="accent" uppercase>
                          Adicionar Foto por URL
                        </AdminLabel>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={newGalleryUrlInput}
                            onChange={(e) =>
                              setNewGalleryUrlInput(e.target.value)
                            }
                            placeholder="Cole URL da foto..."
                            className="flex-1 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)]"
                          />
                          <button
                            type="button"
                            onClick={handleAddGalleryUrl}
                            className="px-3 py-1.5 rounded-xl bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold text-xs shrink-0"
                          >
                            Adicionar
                          </button>
                        </div>

                        <div className="pt-1">
                          <p className="text-xs text-[var(--admin-text-muted)] font-bold uppercase mb-1.5">
                            Fotos Sugeridas:
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {BARBERSHOP_IMAGE_PRESETS.slice(0, 4).map(
                              (preset, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() =>
                                    handleAddPresetImage(preset.url)
                                  }
                                  className="relative rounded-lg overflow-hidden h-12 border border-[var(--admin-border)] hover:border-[var(--admin-accent)] text-left"
                                >
                                  <img
                                    src={preset.url}
                                    alt={preset.title}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-[var(--admin-bg)]/40 p-1 flex items-end">
                                    <span className="text-xs font-bold text-[var(--admin-text-main)] admin-clamp-2">
                                      {preset.title}
                                    </span>
                                  </div>
                                </button>
                              ),
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Photo List */}
                      <div>
                        <p className="text-xs font-bold text-[var(--admin-text-main)] mb-2">
                          Fotos Cadastradas (
                          {formData.gallery_urls?.length || 0}):
                        </p>
                        {formData.gallery_urls &&
                        formData.gallery_urls.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {formData.gallery_urls.map((imgUrl, index) => {
                              const isCover = formData.image_url === imgUrl;
                              return (
                                <div
                                  key={index}
                                  className="relative aspect-square rounded-xl overflow-hidden bg-[var(--admin-bg)] border border-[var(--admin-border)]"
                                >
                                  <img
                                    src={imgUrl}
                                    alt="Galeria"
                                    className="w-full h-full object-cover"
                                  />
                                  {isCover && (
                                    <span className="absolute top-1 left-1 bg-[var(--admin-accent)] text-[var(--admin-accent-text)] text-xs font-black px-1 rounded-xl">
                                      Capa
                                    </span>
                                  )}
                                  <div className="absolute bottom-1 right-1 flex gap-1">
                                    {!isCover && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSetCoverImage(imgUrl)
                                        }
                                        className="p-1 rounded-xl bg-[var(--admin-bg)]/80 text-[var(--admin-accent)] text-xs font-bold"
                                      >
                                        Capa
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveGalleryImage(index)
                                      }
                                      className="p-1 rounded-xl bg-red-600 text-white"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-[var(--admin-text-muted)] italic">
                            Nenhuma foto adicionada.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Fixed Footer */}
                <div className="p-3 bg-[var(--admin-bg)] border-t border-[var(--admin-border)] flex items-center justify-between shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancelar
                  </Button>

                  <div className="flex items-center gap-2">
                    {activeFormTab !== "gallery" && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          if (activeFormTab === "general")
                            setActiveFormTab("pricing");
                          else if (activeFormTab === "pricing")
                            setActiveFormTab("gallery");
                        }}
                      >
                        <span>Avançar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    <Button type="submit" variant="primary" size="sm">
                      <Save className="w-3.5 h-3.5" />
                      <span>Salvar</span>
                    </Button>
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
