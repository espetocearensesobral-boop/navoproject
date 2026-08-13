import React, { useState, useEffect } from 'react';
import { Professional } from '../../types';
import { fetchProfessionalsFromSupabase, saveProfessionalInSupabase, deleteProfessionalInSupabase } from '../../services/supabaseDataService';
import { AdminPageHeader } from './shared/AdminPageHeader';
import {
  Users,
  Plus,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Star,
  Clock,
  CheckCircle2,
  X,
  Save,
  Search,
  Copy,
  Award,
  DollarSign,
  TrendingUp,
  LayoutGrid,
  List,
  Phone,
  QrCode,
  Power,
  Sparkles,
  Scissors,
  Check,
  UserCheck,
  MessageCircle
} from 'lucide-react';

// Preset avatar photos for quick professional selection
const PRESET_BARBER_AVATARS = [
  {
    name: 'Carlos - Master Fade',
    role: 'Master Barber',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=75&w=300'
  },
  {
    name: 'Matheus - Groomer Visagista',
    role: 'Visagista',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=75&w=300'
  },
  {
    name: 'Lucas - Freestyle & Arte',
    role: 'Especialista Freestyle',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=75&w=300'
  },
  {
    name: 'Rafael - Barba & Toalha Quente',
    role: 'Barbeiro Sênior',
    url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=75&w=300'
  },
  {
    name: 'Gabriel - Química & Platino',
    role: 'Colorista Masculino',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=75&w=300'
  },
  {
    name: 'Bruno - Corte Clássico',
    role: 'Barbeiro Tradicional',
    url: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&q=75&w=300'
  }
];

const SUGGESTED_SPECIALTIES = [
  'Degradê / Fade',
  'Skin Fade Navalhado',
  'Barboterapia Imperial',
  'Freestyle Hair Art',
  'Visagismo Masculino',
  'Nevou / Platino Global',
  'Pigmentação de Barba',
  'Corte Infantil Estilizado',
  'Tratamento Anti-Queda',
  'Alinhamento com Toalha Quente'
];

export const ProfessionalsManagement: React.FC = () => {
  const [barbers, setBarbers] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'table'>('list');
  const [expandedBarberId, setExpandedBarberId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<'profile' | 'specialties' | 'commission' | 'schedule'>('profile');
  const [editingBarber, setEditingBarber] = useState<Professional | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Professional>>({
    name: '',
    nickname: '',
    role: 'Master Barber',
    commission_rate: 0.45,
    photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=75&w=250',
    specialties: ['Degradê / Fade', 'Barboterapia Imperial'],
    working_hours: {
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      start: '08:00',
      end: '19:00',
      lunch_break: { start: '12:00', end: '13:00' }
    },
    is_active: true,
    bio: '',
    phone: '',
    pix_key: ''
  });

  const [specialtiesText, setSpecialtiesText] = useState('Degradê / Fade, Barboterapia Imperial');

  useEffect(() => {
    loadBarbers();
  }, []);

  const loadBarbers = async () => {
    setLoading(true);
    const data = await fetchProfessionalsFromSupabase();
    // Exclude prof_any for staff management view
    setBarbers(data.filter((b) => b.id !== 'prof_any'));
    setLoading(false);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleOpenCreate = () => {
    setEditingBarber(null);
    setFormData({
      name: '',
      nickname: '',
      role: 'Master Barber',
      commission_rate: 0.45,
      photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=75&w=250',
      specialties: ['Degradê / Fade', 'Barboterapia Imperial'],
      working_hours: {
        days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        start: '08:00',
        end: '19:00',
        lunch_break: { start: '12:00', end: '13:00' }
      },
      is_active: true,
      bio: 'Especialista em cortes modernos e alinhamento de barba de alta precisão.',
      phone: '(11) 99887-6655',
      pix_key: 'carlos.silva@pix.com'
    });
    setSpecialtiesText('Degradê / Fade, Barboterapia Imperial');
    setActiveFormTab('profile');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (barber: Professional) => {
    setEditingBarber(barber);
    setFormData({ ...barber });
    setSpecialtiesText(barber.specialties ? barber.specialties.join(', ') : '');
    setActiveFormTab('profile');
    setIsModalOpen(true);
  };

  const handleDuplicate = (barber: Professional) => {
    const duplicated: Partial<Professional> = {
      ...barber,
      id: undefined,
      name: `${barber.name} (Cópia)`,
      nickname: `${barber.nickname || barber.name} - Novo`
    };
    setEditingBarber(null);
    setFormData(duplicated);
    setSpecialtiesText(barber.specialties ? barber.specialties.join(', ') : '');
    setActiveFormTab('profile');
    setIsModalOpen(true);
    showToast('Profissional duplicado! Ajuste os dados e salve.');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este barbeiro da equipe?')) {
      const updated = await deleteProfessionalInSupabase(id);
      setBarbers(updated.filter((b) => b.id !== 'prof_any'));
      showToast('Profissional removido com sucesso!');
    }
  };

  const handleToggleStatus = async (barber: Professional) => {
    const updatedStatus = !(barber.is_active ?? true);
    const updatedBarber: Professional = {
      ...barber,
      is_active: updatedStatus
    };

    const updatedList = await saveProfessionalInSupabase(updatedBarber, true);
    setBarbers(updatedList.filter((b) => b.id !== 'prof_any'));
    showToast(updatedStatus ? `${barber.name} ativado na agenda!` : `${barber.name} pausado temporariamente.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Por favor, informe o nome do profissional.');
      return;
    }

    const specs = specialtiesText.split(',').map((s) => s.trim()).filter(Boolean);

    const itemToSave: Professional = {
      id: editingBarber?.id || `prof_${Date.now()}`,
      name: formData.name || '',
      nickname: formData.nickname || formData.name || '',
      role: formData.role || 'Barbeiro Sênior',
      rating: editingBarber?.rating || 5.0,
      reviews_count: editingBarber?.reviews_count || 12,
      photo_url: formData.photo_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=75&w=250',
      specialties: specs.length > 0 ? specs : ['Degradê / Fade', 'Barba Imperial'],
      commission_rate: Number(formData.commission_rate || 0.45),
      working_hours: formData.working_hours || {
        days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        start: '08:00',
        end: '19:00',
        lunch_break: { start: '12:00', end: '13:00' }
      },
      is_active: formData.is_active ?? true,
      bio: formData.bio || '',
      phone: formData.phone || '',
      pix_key: formData.pix_key || ''
    };

    const updatedList = await saveProfessionalInSupabase(itemToSave, Boolean(editingBarber));
    setBarbers(updatedList.filter((b) => b.id !== 'prof_any'));
    setIsModalOpen(false);
    showToast(editingBarber ? 'Cadastro do profissional atualizado!' : 'Novo profissional cadastrado!');
  };

  const handleAddSpecialtyTag = (tag: string) => {
    const currentSpecs = specialtiesText.split(',').map((s) => s.trim()).filter(Boolean);
    if (!currentSpecs.includes(tag)) {
      currentSpecs.push(tag);
      setSpecialtiesText(currentSpecs.join(', '));
    }
  };

  const toggleDay = (day: string) => {
    const currentDays = formData.working_hours?.days || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day];

    setFormData({
      ...formData,
      working_hours: {
        ...(formData.working_hours || { start: '08:00', end: '19:00' }),
        days: newDays
      }
    });
  };

  const dayLabels: { [key: string]: string } = {
    mon: 'Seg',
    tue: 'Ter',
    wed: 'Qua',
    thu: 'Qui',
    fri: 'Sex',
    sat: 'Sáb',
    sun: 'Dom'
  };

  // Filtered list
  const filteredBarbers = barbers.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.nickname && b.nickname.toLowerCase().includes(searchQuery.toLowerCase())) ||
      b.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.specialties && b.specialties.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase())));

    let matchesStatus = true;
    if (statusFilter === 'active') matchesStatus = b.is_active ?? true;
    if (statusFilter === 'inactive') matchesStatus = (b.is_active ?? true) === false;

    return matchesSearch && matchesStatus;
  });

  // Stats calculation
  const totalBarbers = barbers.length;
  const activeBarbers = barbers.filter((b) => (b.is_active ?? true)).length;
  const avgRating = totalBarbers > 0 ? (barbers.reduce((acc, b) => acc + (b.rating || 5.0), 0) / totalBarbers).toFixed(1) : '5.0';
  const avgCommission = totalBarbers > 0 ? Math.round((barbers.reduce((acc, b) => acc + (b.commission_rate || 0.45), 0) / totalBarbers) * 100) : 45;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={Users}
        title="Barbeiros & Equipe"
        stats={[{ label: 'ativos', value: activeBarbers, tone: 'gold' }]}
        action={{ label: 'Cadastrar Barbeiro', onClick: handleOpenCreate, icon: Plus }}
      />

      {/* Ação (mobile) */}
      <button
        onClick={handleOpenCreate}
        className="md:hidden w-full bg-gold-base text-surface-base px-3.5 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
      >
        <Plus className="w-4 h-4" />
        <span>Cadastrar Barbeiro</span>
      </button>

      {/* TOAST MESSAGE */}
      {toastMsg && (
        <div className="bg-status-success/10 border border-status-success/30 text-status-success p-3 rounded-xl flex items-center gap-2 text-xs font-bold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* COMPACT KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Equipe</span>
            <div className="w-6 h-6 rounded-lg bg-gold-base/10 text-gold-hover flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-mono num-tabular text-content-base font-semibold">{totalBarbers}</p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">Profissionais cadastrados</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Ativos na Agenda</span>
            <div className="w-6 h-6 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-mono num-tabular font-bold text-status-success">{activeBarbers}</p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">Cadeiras disponíveis</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Média Avaliação</span>
            <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
            </div>
          </div>
          <p className="text-lg font-mono num-tabular font-bold text-amber-400">{avgRating} ⭐</p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">Sua equipe em destaque</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Comissão Média</span>
            <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-mono num-tabular text-content-base font-semibold">{avgCommission}%</p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">Por serviço prestado</p>
        </div>
      </div>

      {/* SEARCH AND FILTERS BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-surface-card p-2.5 rounded-xl border border-border-subtle">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, apelido, cargo ou especialidade..."
            className="w-full bg-surface-card border border-border-subtle rounded-xl pl-8 pr-3 py-1.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
          />
        </div>

          <div className="flex items-center gap-2 justify-between sm:justify-end min-w-0">
            <div data-gesture-scroll="horizontal" className="admin-category-scroll flex items-center gap-2 overflow-x-auto no-scrollbar min-w-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`shrink-0 min-h-11 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'all'
                  ? 'bg-gold-base text-surface-base'
                  : 'bg-surface-card text-content-muted hover:text-content-base border border-border-subtle'
              }`}
            >
              Todos ({totalBarbers})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`shrink-0 min-h-11 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'active'
                  ? 'bg-gold-base text-surface-base'
                  : 'bg-surface-card text-content-muted hover:text-content-base border border-border-subtle'
              }`}
            >
              Ativos ({activeBarbers})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`shrink-0 min-h-11 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'inactive'
                  ? 'bg-gold-base text-surface-base'
                  : 'bg-surface-card text-content-muted hover:text-content-base border border-border-subtle'
              }`}
            >
              Pausados ({totalBarbers - activeBarbers})
            </button>
          </div>

          <div className="flex items-center bg-surface-card p-0.5 rounded-lg border border-border-subtle shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`min-h-9 px-2 rounded-lg text-xs transition-colors ${
                viewMode === 'list' ? 'bg-gold-base/15 text-gold-hover' : 'text-content-muted'
              }`}
              title="Lista"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`min-h-9 px-2 rounded-lg text-xs transition-colors ${
                viewMode === 'table' ? 'bg-gold-base/15 text-gold-hover' : 'text-content-muted'
              }`}
              title="Tabela"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CARDS VIEW */}
      {viewMode === 'list' ? (
        <div className="space-y-2">
          {loading ? (
            <div className="py-8 text-center text-sm text-content-muted bg-surface-card rounded-2xl border border-border-subtle">
              Carregando barbeiros...
            </div>
          ) : filteredBarbers.length === 0 ? (
            <div className="py-8 text-center text-sm text-content-muted bg-surface-card rounded-2xl border border-border-subtle">
              Nenhum profissional encontrado.
            </div>
          ) : (
            filteredBarbers.map((barber) => {
              const isActive = barber.is_active ?? true;
              const isExpanded = expandedBarberId === barber.id;
              const commissionPercent = Math.round((barber.commission_rate || 0.45) * 100);

              return (
                <article
                  key={barber.id}
                  className={`overflow-hidden rounded-2xl border bg-surface-card transition-colors ${
                    isExpanded ? 'border-gold-base/50' : isActive ? 'border-border-subtle' : 'border-red-500/25 opacity-75'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedBarberId(isExpanded ? null : barber.id)}
                    aria-expanded={isExpanded}
                    className="w-full min-h-[82px] p-3.5 sm:p-4 text-left flex items-center gap-3 sm:gap-4 hover:bg-surface-base/40"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={barber.photo_url}
                        alt={barber.name}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-gold-base/40"
                      />
                      <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-surface-card ${isActive ? 'bg-status-success' : 'bg-red-500'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-bold text-content-base text-sm sm:text-base truncate">{barber.name}</h3>
                        <span className={`shrink-0 px-2 py-1 rounded-md text-[10px] font-bold ${isActive ? 'bg-status-success/15 text-status-success' : 'bg-red-500/15 text-red-300'}`}>
                          {isActive ? 'Ativo' : 'Pausado'}
                        </span>
                      </div>
                      <p className="text-xs text-gold-hover font-semibold truncate">{barber.role}</p>
                      <div className="flex items-center gap-1 text-xs text-amber-400 font-bold mt-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{(barber.rating || 5.0).toFixed(1)}</span>
                        <span className="text-content-muted font-normal">({barber.reviews_count || 10})</span>
                      </div>
                    </div>
                    <div className="hidden md:block text-right shrink-0">
                      <p className="text-xs text-content-muted">Comissão</p>
                      <p className="text-sm font-bold text-content-base">{commissionPercent}%</p>
                    </div>
                    <div className="hidden sm:block text-right shrink-0 min-w-[104px]">
                      <p className="text-xs text-content-muted">Turno</p>
                      <p className="text-xs font-semibold text-content-base">{barber.working_hours?.start || '08:00'}–{barber.working_hours?.end || '19:00'}</p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gold-base shrink-0" /> : <ChevronDown className="w-5 h-5 text-content-muted shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border-subtle bg-surface-base/35 p-3.5 sm:p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="rounded-xl bg-surface-base p-3">
                          <p className="text-[10px] text-content-muted uppercase tracking-wider">Especialidades</p>
                          <p className="mt-1 text-content-base font-semibold leading-relaxed">{barber.specialties?.join(', ') || 'Geral'}</p>
                        </div>
                        <div className="rounded-xl bg-surface-base p-3">
                          <p className="text-[10px] text-content-muted uppercase tracking-wider">Horários semanais</p>
                          <p className="mt-1 text-content-base font-semibold">{barber.working_hours?.days?.map((day) => dayLabels[day] || day).join(', ') || 'Seg-Sáb'}</p>
                          <p className="text-content-muted">{barber.working_hours?.start || '08:00'}–{barber.working_hours?.end || '19:00'}</p>
                        </div>
                        <div className="rounded-xl bg-surface-base p-3">
                          <p className="text-[10px] text-content-muted uppercase tracking-wider">Contato</p>
                          <p className="mt-1 text-content-base font-semibold truncate">{barber.phone || 'Não informado'}</p>
                          <p className="text-content-muted truncate">{barber.pix_key || 'PIX não informado'}</p>
                        </div>
                      </div>
                      {barber.bio && <p className="text-sm text-content-muted leading-relaxed">{barber.bio}</p>}
                      <div className="admin-action-group pt-1">
                        <button type="button" onClick={() => handleToggleStatus(barber)} title={isActive ? 'Pausar agenda' : 'Ativar agenda'} aria-label={isActive ? 'Pausar agenda' : 'Ativar agenda'} className={`admin-action-icon min-h-10 min-w-10 px-2 sm:px-4 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 ${isActive ? 'border-status-success/30 text-status-success' : 'border-red-500/30 text-red-300'}`}>
                          <Power className="w-4 h-4" /><span className="hidden sm:inline">{isActive ? 'Pausar agenda' : 'Ativar agenda'}</span>
                        </button>
                        {barber.phone && <a href={`https://wa.me/55${barber.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" title="Abrir WhatsApp" aria-label="Abrir WhatsApp" className="admin-action-icon min-h-10 min-w-10 px-2 sm:px-4 rounded-xl border border-status-success/30 text-status-success text-sm font-semibold flex items-center justify-center gap-1.5"><MessageCircle className="w-4 h-4" /><span className="hidden sm:inline">WhatsApp</span></a>}
                        <button type="button" onClick={() => handleDuplicate(barber)} title="Duplicar profissional" aria-label="Duplicar profissional" className="admin-action-icon min-h-10 min-w-10 px-2 sm:px-4 rounded-xl border border-border-subtle text-content-muted text-sm font-semibold flex items-center justify-center gap-1.5"><Copy className="w-4 h-4" /><span className="hidden sm:inline">Duplicar</span></button>
                        <button type="button" onClick={() => handleOpenEdit(barber)} title="Editar profissional" aria-label="Editar profissional" className="admin-action-icon min-h-10 min-w-10 px-2 sm:px-4 rounded-xl bg-gold-base text-surface-base text-sm font-bold flex items-center justify-center gap-1.5"><Edit2 className="w-4 h-4" /><span className="hidden sm:inline">Editar</span></button>
                        <button type="button" onClick={() => handleDelete(barber.id)} title="Excluir profissional" aria-label="Excluir profissional" className="admin-action-icon min-h-10 min-w-10 px-2 sm:px-4 rounded-xl border border-status-error/25 text-status-error text-sm font-semibold flex items-center justify-center gap-1.5"><Trash2 className="w-4 h-4" /><span className="hidden sm:inline">Excluir</span></button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-surface-base text-content-muted border-b border-border-subtle">
                <tr>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Profissional</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Avaliação</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Comissão</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Especialidades</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Turno & Dias</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px] text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredBarbers.map((barber) => {
                  const isActive = barber.is_active ?? true;
                  const commissionPercent = Math.round((barber.commission_rate || 0.45) * 100);

                  return (
                    <tr key={barber.id} className="hover:bg-surface-card transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={barber.photo_url}
                            alt={barber.name}
                            className="w-8 h-8 rounded-lg object-cover border border-gold-base/40"
                          />
                          <div>
                            <p className="font-bold text-content-base text-xs">{barber.name}</p>
                            <p className="text-[10px] text-gold-hover">{barber.role}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 text-amber-400 font-bold">
                        ⭐ {(barber.rating || 5.0).toFixed(1)}
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-xl bg-surface-card border border-border-subtle text-gold-hover font-bold text-[10px]">
                          {commissionPercent}%
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="text-[10px] text-content-muted">
                          {barber.specialties?.slice(0, 2).join(', ') || 'Geral'}
                        </span>
                      </td>

                      <td className="p-3.5 text-content-muted">
                        {barber.working_hours?.start || '08:00'} - {barber.working_hours?.end || '19:00'}
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleStatus(barber)}
                            className={`p-1.5 rounded-xl ${isActive ? 'text-status-success' : 'text-red-400'}`}
                            title="Toggle Status"
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(barber)}
                            className="px-2 py-1 bg-gold-base text-surface-base font-bold rounded-xl text-[10px]"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(barber.id)}
                            className="p-1.5 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-base/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="bg-surface-card border border-border-subtle sm:border-gold-base/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-fade-in">
            {/* Header */}
            <div className="p-3.5 bg-surface-base border-b border-border-subtle flex justify-between items-center gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gold-base/10 border border-gold-base/30 flex items-center justify-center text-gold-hover shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-content-base truncate">
                    {editingBarber ? `Editar Barbeiro: ${editingBarber.name}` : 'Novo Barbeiro'}
                  </h2>
                  <p className="text-[10px] text-content-muted truncate">Configuração de perfil, comissões e horários</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-xl bg-surface-card text-content-muted hover:text-content-base flex items-center justify-center transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs Header */}
            <div className="flex border-b border-border-subtle bg-surface-base px-2 pt-1.5 gap-1 shrink-0 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveFormTab('profile')}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap ${
                  activeFormTab === 'profile'
                    ? 'bg-surface-card text-gold-hover border-t-2 border-x border-border-subtle border-t-[#FFFFFF]'
                    : 'text-content-muted hover:text-content-base'
                }`}
              >
                1. Perfil
              </button>

              <button
                type="button"
                onClick={() => setActiveFormTab('specialties')}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap ${
                  activeFormTab === 'specialties'
                    ? 'bg-surface-card text-gold-hover border-t-2 border-x border-border-subtle border-t-[#FFFFFF]'
                    : 'text-content-muted hover:text-content-base'
                }`}
              >
                2. Especialidades
              </button>

              <button
                type="button"
                onClick={() => setActiveFormTab('commission')}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap ${
                  activeFormTab === 'commission'
                    ? 'bg-surface-card text-gold-hover border-t-2 border-x border-border-subtle border-t-[#FFFFFF]'
                    : 'text-content-muted hover:text-content-base'
                }`}
              >
                3. Comissão & PIX
              </button>

              <button
                type="button"
                onClick={() => setActiveFormTab('schedule')}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap ${
                  activeFormTab === 'schedule'
                    ? 'bg-surface-card text-gold-hover border-t-2 border-x border-border-subtle border-t-[#FFFFFF]'
                    : 'text-content-muted hover:text-content-base'
                }`}
              >
                4. Horários
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-3 custom-scrollbar flex-1">
              {/* TAB 1: PROFILE */}
              {activeFormTab === 'profile' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-gold-hover block mb-1">
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: Carlos Eduardo Silva"
                        className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-gold-base"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gold-hover block mb-1">
                        Apelido / Cadeira
                      </label>
                      <input
                        type="text"
                        value={formData.nickname}
                        onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                        placeholder="Ex: Carlão Fade"
                        className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-gold-base"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-gold-hover block mb-1">
                        Cargo / Título
                      </label>
                      <input
                        type="text"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        placeholder="Master Barber"
                        className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-gold-base"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gold-hover block mb-1">
                        WhatsApp / Contato
                      </label>
                      <input
                        type="text"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(11) 99887-6655"
                        className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-gold-base"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gold-hover block mb-1">
                      Biografia / Descrição
                    </label>
                    <textarea
                      rows={2}
                      value={formData.bio || ''}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      placeholder="Descreva a experiência do profissional..."
                      className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base resize-none"
                    />
                  </div>

                  {/* Photo selection */}
                  <div className="p-3 bg-surface-base rounded-xl border border-border-subtle space-y-2">
                    <label className="text-[10px] font-bold text-gold-hover block uppercase">
                      Foto de Perfil
                    </label>

                    <div className="flex items-center gap-2.5">
                      <img
                        src={formData.photo_url}
                        alt="Preview"
                        className="w-10 h-10 rounded-xl object-cover border border-gold-base"
                      />
                      <input
                        type="url"
                        value={formData.photo_url || ''}
                        onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                        placeholder="URL da imagem..."
                        className="flex-1 bg-surface-card border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
                      />
                    </div>

                    <div className="grid grid-cols-6 gap-1.5 pt-1">
                      {PRESET_BARBER_AVATARS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFormData({ ...formData, photo_url: preset.url })}
                          className={`rounded-lg overflow-hidden border transition-all ${
                            formData.photo_url === preset.url ? 'border-gold-base ring-1 ring-gold-base' : 'border-border-subtle opacity-70'
                          }`}
                        >
                          <img src={preset.url} alt={preset.name} className="w-full h-8 object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SPECIALTIES */}
              {activeFormTab === 'specialties' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-gold-hover block mb-1">
                      Especialidades (separadas por vírgula)
                    </label>
                    <input
                      type="text"
                      value={specialtiesText}
                      onChange={(e) => setSpecialtiesText(e.target.value)}
                      placeholder="Degradê / Fade, Barboterapia Imperial"
                      className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-gold-base"
                    />
                  </div>

                  <div className="p-3 bg-surface-base rounded-xl border border-border-subtle space-y-2">
                    <p className="text-[10px] font-bold text-gold-hover flex items-center gap-1 uppercase">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Especialidades populares:</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_SPECIALTIES.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleAddSpecialtyTag(tag)}
                          className="px-2 py-1 rounded-lg bg-surface-card text-content-muted hover:text-content-base border border-border-subtle text-[10px] font-bold"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: COMMISSION & PIX */}
              {activeFormTab === 'commission' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-gold-hover block mb-1">
                        Taxa de Comissão (Ex: 0.45 = 45%) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        required
                        value={formData.commission_rate}
                        onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
                        className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-content-base focus:outline-none focus:border-gold-base"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gold-hover block mb-1">
                        Chave PIX Repasse
                      </label>
                      <input
                        type="text"
                        value={formData.pix_key || ''}
                        onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
                        placeholder="CPF, e-mail ou telefone"
                        className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-gold-base"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-surface-base rounded-xl border border-border-subtle space-y-1 text-xs">
                    <p className="text-[10px] text-content-muted font-bold uppercase">Simulador de Divisão</p>
                    <p className="font-extrabold text-status-success">
                      Em R$ 100,00 → Barbeiro recebe R$ {((formData.commission_rate || 0.45) * 100).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 4: SCHEDULE */}
              {activeFormTab === 'schedule' && (
                <div className="space-y-3">
                  <div className="p-3 bg-surface-base border border-border-subtle rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-content-base">Disponível na Agenda</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_active: !(formData.is_active ?? true) })}
                      className={`px-3 py-1 rounded-xl text-xs font-bold ${
                        (formData.is_active ?? true) ? 'bg-status-success text-surface-base' : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {(formData.is_active ?? true) ? 'Ativo' : 'Pausado'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-content-muted font-bold block mb-1">Início Expediente</label>
                      <input
                        type="time"
                        value={formData.working_hours?.start || '08:00'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            working_hours: {
                              ...(formData.working_hours || { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], end: '19:00' }),
                              start: e.target.value
                            }
                          })
                        }
                        className="w-full bg-surface-base border border-border-subtle rounded-xl p-2 text-xs text-content-base"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-content-muted font-bold block mb-1">Fim Expediente</label>
                      <input
                        type="time"
                        value={formData.working_hours?.end || '19:00'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            working_hours: {
                              ...(formData.working_hours || { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], start: '08:00' }),
                              end: e.target.value
                            }
                          })
                        }
                        className="w-full bg-surface-base border border-border-subtle rounded-xl p-2 text-xs text-content-base"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-content-muted font-bold block mb-1">Dias da Semana</label>
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(dayLabels).map((day) => {
                        const isActive = formData.working_hours?.days.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              isActive ? 'bg-gold-base text-surface-base' : 'bg-surface-base text-content-muted border border-border-subtle'
                            }`}
                          >
                            {dayLabels[day]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-3 border-t border-border-subtle flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-surface-card text-content-muted hover:text-content-base text-xs font-bold"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="bg-gold-base text-surface-base px-4 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 hover:bg-gold-base/80 transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Barbeiro</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

