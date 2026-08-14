import React, { useState, useEffect } from 'react';
import { WaitingQueueItem, Professional, ServiceItem } from '../../types';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { handleEnterAsTab } from '../../utils/formUtils';
import {
  getQueueFromSupabase,
  updateQueueStatusInSupabase,
  addToQueueInSupabase,
  removeFromQueueInSupabase,
  cancelAppointmentInSupabase,
  fetchProfessionalsFromSupabase,
  fetchServicesFromSupabase,
  subscribeToAppointmentsRealtime
} from '../../services/supabaseDataService';
import {
  Clock,
  UserCheck,
  Scissors,
  CheckCircle2,
  Play,
  Send,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  Phone,
  X,
  RotateCcw,
  History,
  Copy,
  Check,
  Zap,
  MessageCircle,
  Users,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export const WaitingQueue: React.FC = () => {
  const [queue, setQueue] = useState<WaitingQueueItem[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [selectedBarberFilter, setSelectedBarberFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'kanban' | 'history' | 'abandoned'>('kanban');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [selectedQueueItemForWa, setSelectedQueueItemForWa] = useState<WaitingQueueItem | null>(null);
  const [customWaMessage, setCustomWaMessage] = useState('');
  const [lastNotification, setLastNotification] = useState<string | null>(null);
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isSavingWalkIn, setIsSavingWalkIn] = useState(false);
  const [expandedQueueItemId, setExpandedQueueItemId] = useState<string | null>(null);

  // Walk-in Form state
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newServiceTitle, setNewServiceTitle] = useState('');
  const [newServicePrice, setNewServicePrice] = useState<number>(85);
  const [newProfessionalId, setNewProfessionalId] = useState('');
  const [newProfessionalName, setNewProfessionalName] = useState('');
  const [newNotes, setNewNotes] = useState('');

  useEffect(() => {
    loadData();

    // Realtime subscription simulation
    const unsubscribe = subscribeToAppointmentsRealtime(() => {
      loadQueueOnly();
    });

    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [qData, profs, svcs] = await Promise.all([
        getQueueFromSupabase(),
        fetchProfessionalsFromSupabase(),
        fetchServicesFromSupabase()
      ]);

      setQueue(qData);
      setProfessionals(profs.filter((p) => p.id !== 'prof_any'));
      setServices(svcs);

      if (profs.length > 0) {
        setNewProfessionalId(profs[0].id);
        setNewProfessionalName(profs[0].name);
      }
      if (svcs.length > 0) {
        setNewServiceTitle(svcs[0].title);
        setNewServicePrice(svcs[0].price);
      }
    } catch (error) {
      setQueue([]);
      showNotification(getActionErrorMessage(error, 'Não foi possível carregar a fila de espera.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadQueueOnly = async () => {
    try {
      const qData = await getQueueFromSupabase();
      setQueue(qData);
    } catch (error) {
      showNotification(getActionErrorMessage(error, 'Não foi possível atualizar a fila.'), 'error');
    }
  };

  // Actions
  const getActionErrorMessage = (error: unknown, fallback: string) => {
    return error instanceof Error && error.message ? error.message : fallback;
  };

  const handleAdvanceToChair = async (id: string) => {
    setActionLoadingId(id);
    try {
      const updated = await updateQueueStatusInSupabase(id, 'in_chair');
      setQueue([...updated]);
      showNotification('Cliente chamado para a cadeira!');
    } catch (error) {
      showNotification(getActionErrorMessage(error, 'Não foi possível chamar o cliente para a cadeira.'), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleFinishService = async (id: string) => {
    setActionLoadingId(id);
    try {
      const updated = await updateQueueStatusInSupabase(id, 'completed');
      setQueue([...updated]);
      showNotification('Atendimento finalizado e marcado como concluído!');
    } catch (error) {
      showNotification(getActionErrorMessage(error, 'Não foi possível finalizar o atendimento.'), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevertToWaiting = async (id: string) => {
    setActionLoadingId(id);
    try {
      const updated = await updateQueueStatusInSupabase(id, 'waiting');
      setQueue([...updated]);
      showNotification('Cliente retornado para a fila da recepção.');
    } catch (error) {
      showNotification(getActionErrorMessage(error, 'Não foi possível retornar o cliente à recepção.'), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveFromQueue = async (id: string, name: string) => {
    if (!window.confirm(`Remover ${name} temporariamente da fila? O agendamento será preservado e poderá retornar depois.`)) return;

    setActionLoadingId(id);
    try {
      const updated = await removeFromQueueInSupabase(id);
      setQueue([...updated]);
      showNotification('Cliente removido da fila e mantido na Agenda.');
    } catch (error) {
      showNotification(getActionErrorMessage(error, 'Não foi possível remover o cliente da fila.'), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReturnToQueue = async (id: string, name: string) => {
    setActionLoadingId(id);
    try {
      const updated = await updateQueueStatusInSupabase(id, 'waiting');
      setQueue([...updated]);
      showNotification(`${name} retornou para a fila da recepção.`);
    } catch (error) {
      showNotification(getActionErrorMessage(error, 'Não foi possível retornar o cliente à fila.'), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelQueuedAppointment = async (item: WaitingQueueItem) => {
    if (!item.appointment_id) {
      showNotification('Este cliente avulso não possui agendamento para cancelar.', 'error');
      return;
    }
    if (!window.confirm(`Cancelar o agendamento de ${item.client_name}? Esta ação remove o compromisso da Agenda e não permite retorno à fila.`)) return;

    setActionLoadingId(item.id);
    try {
      const result = await cancelAppointmentInSupabase(item.appointment_id, undefined, 'Cancelado pela recepção na Fila de Espera');
      if (!result.success) throw new Error(result.error || 'Não foi possível cancelar o agendamento.');
      const updated = await getQueueFromSupabase();
      setQueue([...updated]);
      showNotification('Agendamento cancelado e removido da Agenda.');
    } catch (error) {
      showNotification(getActionErrorMessage(error, 'Não foi possível cancelar o agendamento.'), 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMoveQueueItem = (index: number, direction: 'up' | 'down') => {
    const waitingItems = queue.filter((q) => q.status === 'waiting');
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= waitingItems.length) return;

    const newWaiting = [...waitingItems];
    const temp = newWaiting[index];
    newWaiting[index] = newWaiting[targetIndex];
    newWaiting[targetIndex] = temp;

    const nonWaiting = queue.filter((q) => q.status !== 'waiting');
    setQueue([...nonWaiting, ...newWaiting]);
    showNotification('Ordem da fila de espera atualizada!');
  };

  const handleAddWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      alert('Por favor, informe o nome do cliente.');
      return;
    }

    const newItem: Partial<WaitingQueueItem> = {
      client_name: newClientName,
      client_phone: newClientPhone,
      service_title: newServiceTitle || 'Atendimento Geral',
      service_price: newServicePrice,
      professional_id: newProfessionalId,
      professional_name: newProfessionalName,
      scheduled_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      estimated_wait_minutes: 15,
      status: 'waiting',
      arrived_at: 'Chegou agora',
      notes: newNotes
    };

    setIsSavingWalkIn(true);
    try {
      const updated = await addToQueueInSupabase(newItem);
      setQueue([...updated]);
      setIsAddModalOpen(false);
      setNewClientName('');
      setNewClientPhone('');
      setNewNotes('');
      showNotification(`${newClientName} adicionado à recepção!`);
    } catch (error) {
      showNotification(getActionErrorMessage(error, 'Não foi possível adicionar o cliente à fila.'), 'error');
    } finally {
      setIsSavingWalkIn(false);
    }
  };

  // WhatsApp Alert Modal Trigger
  const handleOpenWhatsAppModal = (item: WaitingQueueItem) => {
    setSelectedQueueItemForWa(item);
    setCustomWaMessage(
      `💈 *BARBERX PREMIUM*\n\nOlá, *${item.client_name}*!\n\nSua cadeira já está pronta com o barbeiro *${item.professional_name}*.\n\n📍 *Pode vir até a recepção para iniciar seu atendimento!* ✂️`
    );
    setIsWhatsAppModalOpen(true);
  };

  const handleSendWhatsAppDirect = () => {
    if (!selectedQueueItemForWa) return;
    const phoneClean = selectedQueueItemForWa.client_phone?.replace(/\D/g, '') || '';
    const encodedText = encodeURIComponent(customWaMessage);

    if (phoneClean) {
      window.open(`https://wa.me/55${phoneClean}?text=${encodedText}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    }

    setIsWhatsAppModalOpen(false);
    showNotification(`Notificação via WhatsApp enviada para ${selectedQueueItemForWa.client_name}!`);
  };

  const handleCopyWaMessage = () => {
    navigator.clipboard.writeText(customWaMessage);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
  };

  const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotificationType(type);
    setLastNotification(`${type === 'error' ? 'Erro: ' : ''}${msg}`);
    setTimeout(() => setLastNotification(null), 3500);
  };

  // Filtering
  const filteredQueue = queue.filter((item) => {
    const matchesBarber =
      selectedBarberFilter === 'all' ||
      item.professional_id === selectedBarberFilter ||
      item.professional_name.toLowerCase().includes(selectedBarberFilter.toLowerCase());

    const matchesSearch =
      item.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.service_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.professional_name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesBarber && matchesSearch;
  });

  const inChairList = filteredQueue.filter((q) => q.status === 'in_chair');
  const waitingList = filteredQueue.filter((q) => q.status === 'waiting');
  const completedList = filteredQueue.filter((q) => q.status === 'completed');
  const cancelledList = filteredQueue.filter((q) => q.status === 'cancelled');
  const historyList = [...completedList, ...cancelledList];
  const abandonedList = filteredQueue.filter((q) => q.status === 'abandoned');

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={Users}
        title="Fila de Espera Digital"
        stats={[
          { label: 'ao vivo', value: '', tone: 'gold' },
          { label: 'whatsapp ativo', value: '', tone: 'success' },
        ]}
        action={{ label: 'Adicionar Encaixe (Walk-In)', onClick: () => setIsAddModalOpen(true), icon: Plus }}
      />

      {/* Ação (mobile) */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="md:hidden w-full bg-gold-base text-surface-base px-3.5 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
      >
        <Plus className="w-4 h-4" />
        <span>Adicionar Encaixe (Walk-In)</span>
      </button>

      {/* TOAST MESSAGE */}
      {lastNotification && (
        <div className={`${notificationType === 'error' ? 'bg-status-error/10 border-status-error/30 text-status-error' : 'bg-status-success/10 border-status-success/30 text-status-success'} p-3 rounded-xl flex items-center gap-2 text-xs font-bold animate-fade-in`}>
          {notificationType === 'error' ? <X className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{lastNotification}</span>
        </div>
      )}

      {/* FILTER & TABS BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-surface-card p-2.5 rounded-xl border border-border-subtle">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar cliente, serviço ou barbeiro..."
            className="w-full bg-surface-card border border-border-subtle rounded-xl pl-8 pr-3 py-1.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
          />
        </div>

        <div className="flex items-center gap-2 justify-between sm:justify-end">
          {/* BARBER FILTER SELECT */}
          <div className="flex items-center gap-1.5 bg-surface-card px-2.5 py-1 rounded-xl border border-border-subtle shrink-0">
            <Filter className="w-3 h-3 text-gold-hover" />
            <select
              value={selectedBarberFilter}
              onChange={(e) => setSelectedBarberFilter(e.target.value)}
              className="bg-transparent text-[11px] text-content-base font-semibold outline-none cursor-pointer"
            >
              <option value="all" className="bg-surface-card text-content-base">
                Todos Barbeiros
              </option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id} className="bg-surface-card text-content-base">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* TAB SWITCHER */}
          <div className="flex items-center bg-surface-card p-0.5 rounded-xl border border-border-subtle shrink-0">
            <button
              onClick={() => setActiveTab('kanban')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                activeTab === 'kanban' ? 'bg-gold-base text-surface-base' : 'text-content-muted hover:text-content-base'
              }`}
            >
              Painel
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                activeTab === 'history' ? 'bg-gold-base text-surface-base' : 'text-content-muted hover:text-content-base'
              }`}
            >
              Histórico ({historyList.length})
            </button>
            <button
              onClick={() => setActiveTab('abandoned')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                activeTab === 'abandoned' ? 'bg-gold-base text-surface-base' : 'text-content-muted hover:text-content-base'
              }`}
            >
              Removidos ({abandonedList.length})
            </button>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      {activeTab === 'kanban' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(19rem,0.95fr)_minmax(0,2.05fr)] gap-4 items-start">
          {/* PRIORIDADE OPERACIONAL: ATENDIMENTOS EM ANDAMENTO */}
          <section className="space-y-3 bg-status-success/[0.035] border border-status-success/20 rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-status-success animate-ping" />
                <span className="text-xs font-bold text-status-success uppercase tracking-wider">
                  Em atendimento
                </span>
              </div>
              <span className="text-[10px] bg-status-success/15 text-status-success px-2.5 py-1 rounded-full font-black border border-status-success/30 whitespace-nowrap">
                {inChairList.length} AO VIVO
              </span>
            </div>
            <p className="text-[11px] text-content-muted -mt-1">Ações em curso: finalize somente após concluir o serviço.</p>

            {loading ? (
              <div className="p-6 text-center text-xs text-content-muted bg-surface-card rounded-2xl border border-border-subtle">
                Carregando cadeiras...
              </div>
            ) : inChairList.length === 0 ? (
              <div className="p-5 text-center text-xs text-content-muted bg-surface-card rounded-xl border border-status-success/20 border-dashed space-y-1.5">
                <Scissors className="w-6 h-6 text-status-success/60 mx-auto" />
                <p className="font-semibold text-content-base">Nenhum atendimento em andamento</p>
                <p className="text-[10px] text-content-muted">Chame o próximo cliente na recepção quando uma cadeira estiver livre.</p>
              </div>
            ) : (
              inChairList.map((item) => (
                <div
                  key={item.id}
                  className="bg-surface-card p-3.5 rounded-xl border border-status-success/45 shadow-sm space-y-3 relative"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-content-base text-xs">{item.client_name}</h3>
                      <p className="text-[11px] text-gold-hover font-semibold">{item.service_title}</p>
                    </div>
                    {item.service_price && (
                      <span className="text-xs font-black finance-positive">
                        R$ {item.service_price.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div className="p-2 bg-surface-card rounded-xl border border-border-subtle space-y-1 text-[10px]">
                    <div className="flex justify-between text-content-muted">
                      <span>Barbeiro:</span>
                      <strong className="text-content-base">{item.professional_name}</strong>
                    </div>
                    <div className="flex justify-between text-content-muted">
                      <span>Início:</span>
                      <strong className="text-status-success">{item.started_at || item.scheduled_time || 'Agora'}</strong>
                    </div>
                    {item.notes && (
                      <div className="pt-1 text-content-muted border-t border-border-subtle">
                        <span className="text-gold-hover font-semibold">Obs:</span> {item.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-border-subtle/70">
                    <button
                      type="button"
                      disabled={actionLoadingId === item.id}
                      onClick={() => handleRevertToWaiting(item.id)}
                      className="p-1.5 rounded-lg bg-surface-card text-content-muted hover:text-content-base border border-border-subtle disabled:opacity-50 disabled:cursor-wait"
                      title="Retornar para Recepção"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === item.id}
                      onClick={() => handleFinishService(item.id)}
                      className="flex-1 py-1.5 rounded-xl bg-status-success text-surface-base font-extrabold text-xs flex items-center justify-center gap-1 shadow hover:bg-status-success active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{actionLoadingId === item.id ? 'Processando…' : 'Finalizar Corte'}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>

          {/* RECEPÇÃO: FILA DE PRÓXIMAS AÇÕES */}
          <section className="space-y-3 bg-surface-card border border-border-subtle rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-border-subtle">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gold-hover" />
                <span className="text-xs font-bold text-gold-hover uppercase tracking-wider">
                  Recepção & fila
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-content-muted font-medium hidden sm:inline">Est. ~{waitingList.length * 15} min</span>
                <span className="text-[10px] bg-gold-base/15 text-gold-hover px-2.5 py-1 rounded-full font-black border border-gold-base/20 whitespace-nowrap">{waitingList.length} aguardando</span>
              </div>
            </div>

            {loading ? (
              <div className="p-6 text-center text-xs text-content-muted bg-surface-card rounded-2xl border border-border-subtle">
                Carregando fila...
              </div>
            ) : waitingList.length === 0 ? (
              <div className="p-8 text-center text-xs text-content-muted bg-surface-card rounded-2xl border border-border-subtle space-y-2">
                <UserCheck className="w-8 h-8 text-content-muted mx-auto" />
                <p className="font-bold text-content-base">Nenhum cliente na recepção</p>
                <p className="text-[10px] text-content-muted max-w-xs mx-auto">
                  A recepção está limpa. Adicione um cliente avulso se houver um walk-in.
                </p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-gold-base text-surface-base px-3 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Cliente</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {waitingList.map((item, index) => {
                  const isExpanded = expandedQueueItemId === item.id;

                  return (
                    <article
                      key={item.id}
                      className={`overflow-hidden rounded-xl border transition-colors ${isExpanded ? 'border-gold-base/45 bg-surface-base' : 'border-border-subtle bg-surface-base/45 hover:border-gold-base/35'}`}
                    >
                      <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-gold-base text-surface-base font-black text-xs flex items-center justify-center shrink-0">
                            #{index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <h4 className="font-bold text-content-base text-xs truncate">{item.client_name}</h4>
                              {item.notes && (
                                <span className="shrink-0 px-1.5 py-0.5 bg-gold-base/10 text-gold-hover text-[9px] font-bold rounded-xl border border-gold-base/20">
                                  Encaixe
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gold-hover font-semibold truncate">{item.service_title}</p>
                            <p className="text-[10px] text-content-muted truncate">
                              {item.professional_name || 'Profissional a definir'} · {item.scheduled_time || 'Agora'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2 sm:shrink-0">
                          <button
                            type="button"
                            disabled={actionLoadingId === item.id}
                            onClick={() => handleAdvanceToChair(item.id)}
                            className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-gold-base text-surface-base font-extrabold text-xs flex items-center justify-center gap-1 hover:bg-gold-base/80 active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                          >
                            <Play className="w-3 h-3 fill-surface-base" />
                            <span>{actionLoadingId === item.id ? 'Chamando…' : 'Chamar Cadeira'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedQueueItemId(isExpanded ? null : item.id)}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? `Recolher ${item.client_name}` : `Expandir ${item.client_name}`}
                            className="w-9 h-9 rounded-lg border border-border-subtle bg-surface-card text-content-muted hover:text-gold-hover hover:border-gold-base/35 flex items-center justify-center shrink-0 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border-subtle bg-surface-card/60 p-3 sm:p-3.5 space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                            <div className="rounded-lg bg-surface-base p-2.5">
                              <span className="block text-content-muted uppercase font-bold tracking-wide">Tempo estimado</span>
                              <strong className="block mt-0.5 text-gold-hover text-xs">~{index * 15 + 5} min</strong>
                            </div>
                            <div className="rounded-lg bg-surface-base p-2.5">
                              <span className="block text-content-muted uppercase font-bold tracking-wide">Barbeiro</span>
                              <strong className="block mt-0.5 text-content-base text-xs truncate">{item.professional_name || 'A definir'}</strong>
                            </div>
                            <div className="rounded-lg bg-surface-base p-2.5 col-span-2 sm:col-span-1">
                              <span className="block text-content-muted uppercase font-bold tracking-wide">Horário</span>
                              <strong className="block mt-0.5 text-content-base text-xs">{item.scheduled_time || 'Agora'}</strong>
                            </div>
                          </div>
                          {item.notes && <p className="text-[11px] text-content-muted border-t border-border-subtle pt-2"><span className="text-gold-hover font-semibold">Observação:</span> {item.notes}</p>}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border-subtle">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveQueueItem(index, 'up')}
                                className="w-9 h-9 rounded-lg border border-border-subtle bg-surface-base text-content-muted hover:text-gold-hover disabled:opacity-25"
                                title="Subir na fila"
                                aria-label="Subir na fila"
                              >
                                <ArrowUp className="w-3.5 h-3.5 mx-auto" />
                              </button>
                              <button
                                type="button"
                                disabled={index === waitingList.length - 1}
                                onClick={() => handleMoveQueueItem(index, 'down')}
                                className="w-9 h-9 rounded-lg border border-border-subtle bg-surface-base text-content-muted hover:text-gold-hover disabled:opacity-25"
                                title="Descer na fila"
                                aria-label="Descer na fila"
                              >
                                <ArrowDown className="w-3.5 h-3.5 mx-auto" />
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={actionLoadingId === item.id}
                                onClick={() => handleOpenWhatsAppModal(item)}
                                className="w-9 h-9 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border border-[#25D366]/30 disabled:opacity-50"
                                title="Avisar WhatsApp"
                                aria-label="Avisar WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5 mx-auto" />
                              </button>
                              <button
                                type="button"
                                disabled={actionLoadingId === item.id}
                                onClick={() => handleRemoveFromQueue(item.id, item.client_name)}
                                className="w-9 h-9 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-wait"
                                title="Remover da fila"
                                aria-label="Remover da fila"
                              >
                                <Trash2 className="w-3.5 h-3.5 mx-auto" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : activeTab === 'history' ? (
        /* HISTORY TAB */
        <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden p-3 space-y-3">
          <h2 className="text-xs font-bold text-content-base flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-status-success" />
            <span>Histórico operacional ({historyList.length})</span>
          </h2>

          {historyList.length === 0 ? (
            <div className="py-8 text-center text-xs text-content-muted">
              Nenhum atendimento finalizado ou cancelado ainda hoje.
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-surface-base text-content-muted border-b border-border-subtle">
                  <tr>
                    <th className="p-3 font-bold uppercase text-[10px]">Cliente</th>
                    <th className="p-3 font-bold uppercase text-[10px]">Serviço</th>
                    <th className="p-3 font-bold uppercase text-[10px]">Barbeiro</th>
                    <th className="p-3 font-bold uppercase text-[10px]">Encerramento</th>
                    <th className="p-3 font-bold uppercase text-[10px] text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {historyList.map((item) => {
                    const isCancelled = item.status === 'cancelled';
                    return (
                      <tr key={item.id} className="hover:bg-surface-card transition-colors">
                        <td className="p-3 font-bold text-content-base">{item.client_name}</td>
                        <td className="p-3 text-gold-hover">{item.service_title}</td>
                        <td className="p-3 text-content-base">{item.professional_name}</td>
                        <td className={`p-3 font-bold ${isCancelled ? 'text-status-error' : 'text-status-success'}`}>
                          {isCancelled ? 'Cancelado' : item.completed_at || 'Concluído'}
                        </td>
                        <td className="p-3 text-right">
                          <span className={`px-2 py-0.5 rounded-xl text-[10px] font-bold ${isCancelled ? 'bg-status-error/15 text-status-error' : 'bg-status-success/15 text-status-success'}`}>
                            {isCancelled ? '× Cancelado' : '✓ Concluído'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ABANDONED ITEMS TAB */
        <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold text-content-base flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-gold-hover" />
                <span>Removidos da fila ({abandonedList.length})</span>
              </h2>
              <p className="text-[10px] text-content-muted mt-1">Agendamentos preservados podem retornar à fila ou ser cancelados.</p>
            </div>
          </div>

          {abandonedList.length === 0 ? (
            <div className="py-8 text-center text-xs text-content-muted">
              Nenhum cliente removido recentemente.
            </div>
          ) : (
            <div className="space-y-2">
              {abandonedList.map((item) => (
                <article key={item.id} className="rounded-xl border border-border-subtle bg-surface-base p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-content-base text-xs truncate">{item.client_name}</h3>
                      <span className="px-1.5 py-0.5 rounded-full bg-status-warning/10 text-status-warning text-[9px] font-bold border border-status-warning/20">Removido</span>
                    </div>
                    <p className="text-[10px] text-gold-hover font-semibold truncate">{item.service_title}</p>
                    <p className="text-[10px] text-content-muted truncate">
                      {item.professional_name || 'Profissional a definir'} · {item.scheduled_time || 'Horário não informado'}
                      {item.appointment_id ? ' · Agendamento preservado' : ' · Cliente avulso'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={actionLoadingId === item.id}
                      onClick={() => handleReturnToQueue(item.id, item.client_name)}
                      className="px-3 py-2 rounded-lg bg-gold-base text-surface-base font-extrabold text-[11px] flex items-center gap-1.5 hover:bg-gold-base/80 disabled:opacity-60"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Retornar à fila
                    </button>
                    {item.appointment_id && (
                      <button
                        type="button"
                        disabled={actionLoadingId === item.id}
                        onClick={() => handleCancelQueuedAppointment(item)}
                        className="px-3 py-2 rounded-lg bg-status-error/10 text-status-error border border-status-error/20 font-extrabold text-[11px] flex items-center gap-1.5 hover:bg-status-error/20 disabled:opacity-60"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancelar atendimento
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD WALK-IN */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-base/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
          <div className="bg-surface-card border border-border-subtle sm:border-gold-base/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-fade-in">
            <div className="p-3.5 bg-surface-base border-b border-border-subtle flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gold-base/10 text-gold-hover flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-bold text-content-base">Adicionar Encaixe (Walk-In)</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-surface-card text-content-muted hover:text-content-base flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onKeyDown={handleEnterAsTab} onSubmit={handleAddWalkInSubmit} className="p-4 space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">
                  Nome do Cliente *
                </label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ex: Gabriel Santos"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="(11) 99887-1122"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">
                    Serviço
                  </label>
                  <select
                    value={newServiceTitle}
                    onChange={(e) => {
                      const title = e.target.value;
                      setNewServiceTitle(title);
                      const found = services.find((s) => s.title === title);
                      if (found) setNewServicePrice(found.price);
                    }}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base cursor-pointer"
                  >
                    {services.map((svc) => (
                      <option key={svc.id} value={svc.title} className="bg-surface-card">
                        {svc.title} (R$ {svc.price})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">
                    Barbeiro
                  </label>
                  <select
                    value={newProfessionalId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setNewProfessionalId(id);
                      const found = professionals.find((p) => p.id === id);
                      if (found) setNewProfessionalName(found.name);
                    }}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base cursor-pointer"
                  >
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id} className="bg-surface-card">
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">
                  Observações
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ex: Aceitou aguardar 15 min"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-surface-card text-content-muted hover:text-content-base font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingWalkIn}
                  className="px-4 py-1.5 rounded-xl bg-gold-base text-surface-base font-black shadow disabled:opacity-60 disabled:cursor-wait"
                >
                  {isSavingWalkIn ? 'Inserindo…' : 'Inserir na Fila'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: WHATSAPP ALERT */}
      {isWhatsAppModalOpen && selectedQueueItemForWa && (
        <div className="fixed inset-0 z-50 bg-surface-base/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
          <div className="bg-surface-card border border-[#25D366]/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-fade-in">
            <div className="p-3.5 bg-surface-base border-b border-border-subtle flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#25D366]/10 text-[#25D366] flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-content-base">Aviso WhatsApp</h2>
                  <p className="text-[10px] text-content-muted">{selectedQueueItemForWa.client_name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsWhatsAppModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-surface-card text-content-muted hover:text-content-base flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="p-2.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 text-[11px] text-[#25D366] flex items-center gap-2">
                <Zap className="w-4 h-4 shrink-0" />
                <span>Integração de Notificação WhatsApp via API Web/wa.me ativa. O cliente receberá a mensagem diretamente.</span>
              </div>

              <textarea
                rows={4}
                value={customWaMessage}
                onChange={(e) => setCustomWaMessage(e.target.value)}
                className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-[#25D366] resize-none"
              />

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={handleCopyWaMessage}
                  className="px-3 py-1.5 bg-surface-card text-content-base rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  {copiedNotice ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedNotice ? 'Copiado!' : 'Copiar Texto'}</span>
                </button>

                <button
                  onClick={handleSendWhatsAppDirect}
                  className="px-4 py-1.5 bg-[#25D366] text-surface-base rounded-xl text-xs font-black flex items-center gap-1 shadow"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar no WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
