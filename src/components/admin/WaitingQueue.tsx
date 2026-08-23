import React, { useState, useEffect } from "react";
import { WaitingQueueItem, Professional, ServiceItem } from "../../types";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import { AdminTabs } from "./shared/AdminTabs";
import { AdminListSkeleton } from "./shared/AdminSkeleton";
import { AdminEmptyState } from "./shared/AdminEmptyState";
import { ReceiptCheckoutModal } from "./ReceiptCheckoutModal";
import { AdminModalV2 } from "./shared/AdminModalV2";
import { handleEnterAsTab } from "../../utils/formUtils";
import {
  getQueueFromSupabase,
  updateQueueStatusInSupabase,
  addToQueueInSupabase,
  removeFromQueueInSupabase,
  deleteQueueItemInSupabase,
  reorderQueueInSupabase,
  cancelAppointmentInSupabase,
  fetchProfessionalsFromSupabase,
  fetchServicesFromSupabase,
  subscribeToAppointmentsRealtime,
} from "../../services/supabaseDataService";
import {
  defaultOperationSettings,
  fetchOperationSettings,
  type OperationSettings,
} from "../../services/operationSettingsService";
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
  ChevronUp,
} from "lucide-react";

export const WaitingQueue: React.FC = () => {
  const [queue, setQueue] = useState<WaitingQueueItem[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [operationSettings, setOperationSettings] = useState<OperationSettings>(
    defaultOperationSettings,
  );
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [selectedBarberFilter, setSelectedBarberFilter] =
    useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<
    "kanban" | "history" | "abandoned"
  >("kanban");

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isServicePickerOpen, setIsServicePickerOpen] = useState(false);
  const clientNameInputRef = React.useRef<HTMLInputElement>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [selectedQueueItemForWa, setSelectedQueueItemForWa] =
    useState<WaitingQueueItem | null>(null);
  const [customWaMessage, setCustomWaMessage] = useState("");
  const [lastNotification, setLastNotification] = useState<string | null>(null);
  const [notificationType, setNotificationType] = useState<"success" | "error">(
    "success",
  );
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isSavingWalkIn, setIsSavingWalkIn] = useState(false);
  const [expandedQueueItemId, setExpandedQueueItemId] = useState<string | null>(
    null,
  );
  const [receiptCheckoutItem, setReceiptCheckoutItem] =
    useState<WaitingQueueItem | null>(null);

  // Walk-in Form state
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newServiceTitle, setNewServiceTitle] = useState("");
  const [newServicePrice, setNewServicePrice] = useState<number>(85);
  const [newProfessionalId, setNewProfessionalId] = useState("");
  const [newProfessionalName, setNewProfessionalName] = useState("");
  const [newNotes, setNewNotes] = useState("");

  useEffect(() => {
    loadData();

    // Realtime subscription simulation
    const unsubscribe = subscribeToAppointmentsRealtime(() => {
      loadQueueOnly();
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const refreshInterval = window.setInterval(() => {
      loadQueueOnly();
    }, operationSettings.queueRefreshSeconds * 1000);
    return () => window.clearInterval(refreshInterval);
  }, [operationSettings.queueRefreshSeconds]);

  useEffect(() => {
    if (!isAddModalOpen) return;
    const frame = window.requestAnimationFrame(() =>
      clientNameInputRef.current?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [isAddModalOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [qData, profs, svcs, settings] = await Promise.all([
        getQueueFromSupabase(),
        fetchProfessionalsFromSupabase(),
        fetchServicesFromSupabase(),
        fetchOperationSettings(),
      ]);

      setQueue(qData);
      setProfessionals(profs.filter((p) => p.id !== "prof_any"));
      setOperationSettings(settings);
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
      showNotification(
        getActionErrorMessage(error, "Não foi possível carregar a fila."),
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadQueueOnly = async () => {
    try {
      const qData = await getQueueFromSupabase();
      setQueue(qData);
    } catch (error) {
      showNotification(
        getActionErrorMessage(error, "Não foi possível atualizar a fila."),
        "error",
      );
    }
  };

  // Actions
  const getActionErrorMessage = (error: unknown, fallback: string) => {
    return error instanceof Error && error.message ? error.message : fallback;
  };

  const handleAdvanceToChair = async (id: string) => {
    setActionLoadingId(id);
    try {
      const updated = await updateQueueStatusInSupabase(id, "in_chair");
      setQueue([...updated]);
      showNotification("Cliente chamado para a cadeira!");
    } catch (error) {
      showNotification(
        getActionErrorMessage(error, "Não foi possível chamar o cliente."),
        "error",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleFinishService = async (item: WaitingQueueItem) => {
    setActionLoadingId(item.id);
    try {
      const updated = await updateQueueStatusInSupabase(item.id, "completed");
      setQueue([...updated]);
      setReceiptCheckoutItem(item);
      showNotification(
        "Atendimento concluído. Escolha se deseja registrar o recebimento agora.",
      );
    } catch (error) {
      showNotification(
        getActionErrorMessage(error, "Não foi possível finalizar."),
        "error",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevertToWaiting = async (id: string) => {
    setActionLoadingId(id);
    try {
      const updated = await updateQueueStatusInSupabase(id, "waiting");
      setQueue([...updated]);
      showNotification("Cliente retornado para a fila da recepção.");
    } catch (error) {
      showNotification(
        getActionErrorMessage(error, "Não foi possível retornar à recepção."),
        "error",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveFromQueue = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Remover ${name} temporariamente da fila? O agendamento será preservado e poderá retornar depois.`,
      )
    )
      return;

    setActionLoadingId(id);
    try {
      const updated = await removeFromQueueInSupabase(id);
      setQueue([...updated]);
      showNotification("Cliente removido da fila e mantido na Agenda.");
    } catch (error) {
      showNotification(
        getActionErrorMessage(error, "Não foi possível remover da fila."),
        "error",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReturnToQueue = async (id: string, name: string) => {
    setActionLoadingId(id);
    try {
      const updated = await updateQueueStatusInSupabase(id, "waiting");
      setQueue([...updated]);
      showNotification(`${name} retornou para a fila da recepção.`);
    } catch (error) {
      showNotification(
        getActionErrorMessage(error, "Não foi possível retornar à fila."),
        "error",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteAbandonedWalkIn = async (item: WaitingQueueItem) => {
    if (item.appointment_id) {
      showNotification(
        "Agendamentos vinculados não podem ser excluídos.",
        "error",
      );
      return;
    }
    if (
      !window.confirm(
        `Excluir definitivamente o registro avulso de ${item.client_name}? Esta ação não pode ser desfeita.`,
      )
    )
      return;

    setActionLoadingId(item.id);
    try {
      const updated = await deleteQueueItemInSupabase(item.id);
      setQueue([...updated]);
      showNotification("Registro avulso excluído definitivamente.");
    } catch (error) {
      showNotification(
        getActionErrorMessage(error, "Não foi possível excluir o registro."),
        "error",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelQueuedAppointment = async (item: WaitingQueueItem) => {
    if (!item.appointment_id) {
      showNotification(
        "Este cliente avulso não possui agendamento para cancelar.",
        "error",
      );
      return;
    }
    if (
      !window.confirm(
        `Cancelar o agendamento de ${item.client_name}? Esta ação remove o compromisso da Agenda e não permite retorno à fila.`,
      )
    )
      return;

    setActionLoadingId(item.id);
    try {
      const result = await cancelAppointmentInSupabase(
        item.appointment_id,
        undefined,
        "Cancelado pela recepção na Fila de Espera",
      );
      if (!result.success)
        throw new Error(
          result.error || "Não foi possível cancelar o agendamento.",
        );
      const updated = await getQueueFromSupabase();
      setQueue([...updated]);
      showNotification("Agendamento cancelado e removido da Agenda.");
    } catch (error) {
      showNotification(
        getActionErrorMessage(
          error,
          "Não foi possível cancelar o agendamento.",
        ),
        "error",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMoveQueueItem = async (
    item: WaitingQueueItem,
    direction: "up" | "down",
  ) => {
    const waitingItems = queue
      .filter((q) => q.status === "waiting")
      .sort((a, b) => (a.queue_position || 0) - (b.queue_position || 0));
    const currentIndex = waitingItems.findIndex(
      (queueItem) => queueItem.id === item.id,
    );
    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= waitingItems.length
    )
      return;

    const reordered = [...waitingItems];
    [reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[currentIndex],
    ];
    setActionLoadingId(item.id);
    try {
      const updated = await reorderQueueInSupabase(
        reordered.map((queueItem) => queueItem.id),
      );
      setQueue(updated);
      showNotification("Ordem da fila de espera atualizada!");
    } catch (error) {
      showNotification(
        getActionErrorMessage(error, "Não foi possível reordenar a fila."),
        "error",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSelectWalkInService = (service: ServiceItem) => {
    setNewServiceTitle(service.title);
    setNewServicePrice(service.price);
    setIsServicePickerOpen(false);
    window.requestAnimationFrame(() =>
      document.getElementById("walk-in-professional")?.focus(),
    );
  };

  const handleAddWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operationSettings.allowWalkIn) {
      showNotification(
        "Encaixes para clientes avulsos estão desativados nas configurações de Operação.",
        "error",
      );
      return;
    }
    if (operationSettings.requireProfessionalForWalkIn && !newProfessionalId) {
      showNotification(
        "Selecione um profissional para adicionar o cliente avulso.",
        "error",
      );
      return;
    }
    if (!newClientName.trim()) {
      alert("Por favor, informe o nome do cliente.");
      return;
    }

    const newItem: Partial<WaitingQueueItem> = {
      client_name: newClientName,
      client_phone: newClientPhone,
      service_title: newServiceTitle || "Atendimento Geral",
      service_price: newServicePrice,
      professional_id: newProfessionalId,
      professional_name: newProfessionalName,
      scheduled_time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      estimated_wait_minutes: operationSettings.queueBaseWaitMinutes,
      status: "waiting",
      arrived_at: "Chegou agora",
      notes: newNotes,
    };

    setIsSavingWalkIn(true);
    try {
      const updated = await addToQueueInSupabase(newItem);
      setQueue([...updated]);
      setIsAddModalOpen(false);
      setNewClientName("");
      setNewClientPhone("");
      setNewNotes("");
      showNotification(`${newClientName} adicionado à recepção!`);
    } catch (error) {
      showNotification(
        getActionErrorMessage(error, "Não foi possível adicionar à fila."),
        "error",
      );
    } finally {
      setIsSavingWalkIn(false);
    }
  };

  // WhatsApp Alert Modal Trigger
  const handleOpenWhatsAppModal = (item: WaitingQueueItem) => {
    setSelectedQueueItemForWa(item);
    setCustomWaMessage(
      `💈 *BARBERX PREMIUM*\n\nOlá, *${item.client_name}*!\n\nSua cadeira já está pronta com o barbeiro *${item.professional_name}*.\n\n📍 *Pode vir até a recepção para iniciar seu atendimento!* ✂️`,
    );
    setIsWhatsAppModalOpen(true);
  };

  const handleSendWhatsAppDirect = () => {
    if (!selectedQueueItemForWa) return;
    const phoneClean =
      selectedQueueItemForWa.client_phone?.replace(/\D/g, "") || "";
    const encodedText = encodeURIComponent(customWaMessage);

    if (phoneClean) {
      window.open(
        `https://wa.me/55${phoneClean}?text=${encodedText}`,
        "_blank",
      );
    } else {
      window.open(`https://wa.me/?text=${encodedText}`, "_blank");
    }

    setIsWhatsAppModalOpen(false);
    showNotification(
      `Notificação via WhatsApp enviada para ${selectedQueueItemForWa.client_name}!`,
    );
  };

  const handleCopyWaMessage = () => {
    navigator.clipboard.writeText(customWaMessage);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
  };

  const showNotification = (
    msg: string,
    type: "success" | "error" = "success",
  ) => {
    setNotificationType(type);
    setLastNotification(`${type === "error" ? "Erro: " : ""}${msg}`);
    setTimeout(() => setLastNotification(null), 3500);
  };

  // Filtering
  const filteredQueue = queue.filter((item) => {
    const matchesBarber =
      selectedBarberFilter === "all" ||
      item.professional_id === selectedBarberFilter ||
      item.professional_name
        .toLowerCase()
        .includes(selectedBarberFilter.toLowerCase());

    const matchesSearch =
      item.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.service_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.professional_name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesBarber && matchesSearch;
  });

  const inChairList = filteredQueue.filter((q) => q.status === "in_chair");
  const waitingList = filteredQueue.filter((q) => q.status === "waiting");
  const completedList = filteredQueue.filter((q) => q.status === "completed");
  const cancelledList = filteredQueue.filter((q) => q.status === "cancelled");
  const historyList = [...completedList, ...cancelledList];
  const abandonedList = filteredQueue.filter((q) => q.status === "abandoned");

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={Users}
        title="Fila de Espera"
        action={
          operationSettings.allowWalkIn
            ? {
                label: "Adicionar Encaixe",
                onClick: () => {
                  setIsServicePickerOpen(false);
                  setIsAddModalOpen(true);
                },
                icon: Plus,
              }
            : undefined
        }
      />

      {/* Ação (mobile) */}
      {operationSettings.allowWalkIn && (
        <button
          onClick={() => {
            setIsServicePickerOpen(false);
            setIsAddModalOpen(true);
          }}
          className="md:hidden w-full min-h-11 bg-[var(--admin-accent)] text-[var(--admin-accent-text)] px-4 py-2.5 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 transition-[transform,background-color] duration-150 shadow-md active:scale-[0.97] shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Novo encaixe</span>
        </button>
      )}

      {/* TOAST MESSAGE */}
      {lastNotification && (
        <div
          className={`${notificationType === "error" ? "bg-status-error/10 border-status-error/30 text-status-error" : "bg-status-success/10 border-status-success/30 text-status-success"} p-3 rounded-xl flex items-center gap-2 text-xs font-bold animate-fade-in`}
        >
          {notificationType === "error" ? (
            <X className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{lastNotification}</span>
        </div>
      )}

      {/* BUSCA, FILTROS E ABAS */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar cliente, serviço ou barbeiro..."
            className="w-full min-h-11 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl pl-10 pr-3.5 py-2 text-sm text-[var(--admin-text-main)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors"
          />
        </div>

        <div className="admin-card p-2.5 space-y-2 rounded-xl">
          <AdminTabs
            tabs={[
              { id: "kanban", label: "Painel" },
              { id: "history", label: "Histórico" },
              { id: "abandoned", label: "Removidos" },
            ]}
            activeId={activeTab}
            onChange={(id) =>
              setActiveTab(id as "kanban" | "history" | "abandoned")
            }
            className="pb-0"
          />
          <div className="flex items-center gap-2 min-w-0">
            <Filter
              className="w-3.5 h-3.5 text-[var(--admin-text-muted)] shrink-0"
              aria-hidden="true"
            />
            <select
              value={selectedBarberFilter}
              onChange={(e) => setSelectedBarberFilter(e.target.value)}
              className="min-h-10 flex-1 min-w-0 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-lg px-3 text-xs text-[var(--admin-text-main)] font-semibold outline-none cursor-pointer transition-colors focus:border-[var(--admin-accent)]"
              aria-label="Filtrar por barbeiro"
            >
              <option value="all">Todos os barbeiros</option>
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      {activeTab === "kanban" ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.85fr)] gap-4 items-stretch">
          {/* EM ATENDIMENTO: ações em curso */}
          <section className="order-2 flex min-h-0 h-[26rem] xl:h-[30rem] flex-col space-y-3 bg-status-success/[0.035] border border-status-success/20 rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-status-success" />
                <span className="text-xs font-bold text-status-success uppercase tracking-wider">
                  Em atendimento
                </span>
              </div>
              <span className="text-xs bg-status-success/10 text-status-success px-2.5 py-1 rounded-full font-black border border-status-success/20 whitespace-nowrap">
                {inChairList.length} na cadeira
              </span>
            </div>
            <p className="text-xs text-[var(--admin-text-muted)] -mt-1 shrink-0">
              Finalize após o serviço.
            </p>

            {loading ? (
              <AdminListSkeleton
                rows={3}
                className="overflow-y-auto overscroll-contain pr-1"
              />
            ) : inChairList.length === 0 ? (
              <AdminEmptyState
                icon={Scissors}
                title="Nenhum atendimento ativo"
                description="Chame o próximo quando a cadeira liberar."
              />
            ) : (
              <div
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar pr-1 space-y-3"
                style={{
                  maxHeight: `${Math.max(180, operationSettings.queueVisibleLimit * 86)}px`,
                }}
              >
                {inChairList.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[var(--admin-surface)] p-3.5 rounded-xl border border-status-success/45 shadow-sm space-y-3 relative"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-[var(--admin-text-main)] text-xs">
                          {item.client_name}
                        </h3>
                        <p className="text-xs text-[var(--admin-accent)] font-semibold">
                          {item.service_title}
                        </p>
                      </div>
                      {item.service_price && (
                        <span className="text-xs font-black finance-positive">
                          R$ {item.service_price.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <div className="p-2 bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] space-y-1 text-xs">
                      <div className="flex justify-between text-[var(--admin-text-muted)]">
                        <span>Barbeiro:</span>
                        <strong className="text-[var(--admin-text-main)]">
                          {item.professional_name}
                        </strong>
                      </div>
                      <div className="flex justify-between text-[var(--admin-text-muted)]">
                        <span>Início:</span>
                        <strong className="text-status-success">
                          {item.started_at || item.scheduled_time || "Agora"}
                        </strong>
                      </div>
                      {item.notes && (
                        <div className="pt-1 text-[var(--admin-text-muted)] border-t border-[var(--admin-border)]">
                          <span className="text-[var(--admin-accent)] font-semibold">
                            Obs:
                          </span>{" "}
                          {item.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-[var(--admin-border)]/70">
                      <button
                        type="button"
                        disabled={actionLoadingId === item.id}
                        onClick={() => handleRevertToWaiting(item.id)}
                        className="p-1.5 rounded-lg bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] border border-[var(--admin-border)] disabled:opacity-50 disabled:cursor-wait transition-colors"
                        title="Retornar para Recepção"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={actionLoadingId === item.id}
                        onClick={() => handleFinishService(item)}
                        className="flex-1 py-1.5 rounded-xl bg-status-success text-white font-extrabold text-xs flex items-center justify-center gap-1 shadow hover:bg-status-success active:scale-[0.97] transition-[transform,background-color] duration-150 disabled:opacity-60 disabled:cursor-wait"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {actionLoadingId === item.id
                            ? "Processando…"
                            : "Finalizar"}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* RECEPÇÃO: FILA DE PRÓXIMAS AÇÕES */}
          <section className="order-1 flex min-h-0 h-[26rem] xl:h-[30rem] flex-col space-y-3 admin-card p-3 sm:p-4 rounded-xl">
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-[var(--admin-border)] shrink-0">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[var(--admin-accent)]" />
                <span className="text-xs font-bold text-[var(--admin-accent)] uppercase tracking-wider">
                  Recepção & fila
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-[var(--admin-text-muted)] font-medium hidden sm:inline">
                  Est. ~
                  {waitingList.reduce(
                    (total, item) =>
                      total +
                      (item.estimated_wait_minutes ||
                        operationSettings.queueBaseWaitMinutes),
                    0,
                  )}{" "}
                  min
                </span>
                <span className="text-xs bg-[var(--admin-accent)]/15 text-[var(--admin-accent)] px-2.5 py-1 rounded-full font-black border border-[var(--admin-accent)]/20 whitespace-nowrap">
                  {waitingList.length} aguardando
                </span>
              </div>
            </div>

            {loading ? (
              <AdminListSkeleton
                rows={4}
                className="overflow-y-auto overscroll-contain pr-1"
              />
            ) : waitingList.length === 0 ? (
              <AdminEmptyState
                icon={UserCheck}
                title="Nenhum cliente na recepção"
                description="Adicione um cliente avulso se houver um walk-in."
                actionLabel={
                  operationSettings.allowWalkIn ? "Adicionar" : undefined
                }
                onAction={
                  operationSettings.allowWalkIn
                    ? () => setIsAddModalOpen(true)
                    : undefined
                }
              />
            ) : (
              <div
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar pr-1"
                style={{
                  maxHeight: `${Math.max(180, operationSettings.queueVisibleLimit * 76)}px`,
                }}
              >
                <div className="space-y-2">
                  {waitingList.map((item, index) => {
                    const isExpanded = expandedQueueItemId === item.id;

                    return (
                      <article
                        key={item.id}
                        className={`overflow-hidden rounded-xl border transition-colors ${isExpanded ? "border-[var(--admin-accent)]/45 bg-[var(--admin-bg)]" : "border-[var(--admin-border)] bg-[var(--admin-bg)]/45 hover:border-[var(--admin-accent)]/35"}`}
                      >
                        <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-black text-xs flex items-center justify-center shrink-0">
                              #{index + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <h4 className="font-bold text-[var(--admin-text-main)] text-xs admin-clamp-2">
                                  {item.client_name}
                                </h4>
                                {item.notes && (
                                  <span className="shrink-0 px-1.5 py-0.5 bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] text-xs font-bold rounded-xl border border-[var(--admin-accent)]/20">
                                    Encaixe
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[var(--admin-accent)] font-semibold admin-clamp-2">
                                {item.service_title}
                              </p>
                              <p className="text-xs text-[var(--admin-text-muted)] admin-safe-wrap">
                                {item.professional_name ||
                                  "Profissional a definir"}{" "}
                                · {item.scheduled_time || "Agora"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2 sm:shrink-0">
                            <button
                              type="button"
                              disabled={actionLoadingId === item.id}
                              onClick={() => handleAdvanceToChair(item.id)}
                              className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-extrabold text-xs flex items-center justify-center gap-1 hover:bg-[var(--admin-accent)]/80 active:scale-95 disabled:opacity-60 disabled:cursor-wait transition-colors"
                            >
                              <Play className="w-3 h-3 fill-[var(--admin-bg)]" />
                              <span>
                                {actionLoadingId === item.id
                                  ? "Chamando…"
                                  : "Chamar Cadeira"}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedQueueItemId(
                                  isExpanded ? null : item.id,
                                )
                              }
                              aria-expanded={isExpanded}
                              aria-label={
                                isExpanded
                                  ? `Recolher ${item.client_name}`
                                  : `Expandir ${item.client_name}`
                              }
                              className="w-9 h-9 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-accent)] hover:border-[var(--admin-accent)]/35 flex items-center justify-center shrink-0 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface)]/60 p-3 sm:p-3.5 space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                              <div className="rounded-lg bg-[var(--admin-bg)] p-2.5">
                                <span className="block text-[var(--admin-text-muted)] uppercase font-bold tracking-wide">
                                  Tempo estimado
                                </span>
                                <strong className="block mt-0.5 text-[var(--admin-accent)] text-xs">
                                  ~
                                  {item.estimated_wait_minutes ||
                                    index *
                                      operationSettings.queueBaseWaitMinutes +
                                      operationSettings.queueBaseWaitMinutes}{" "}
                                  min
                                </strong>
                              </div>
                              <div className="rounded-lg bg-[var(--admin-bg)] p-2.5">
                                <span className="block text-[var(--admin-text-muted)] uppercase font-bold tracking-wide">
                                  Barbeiro
                                </span>
                                <strong className="block mt-0.5 text-[var(--admin-text-main)] text-xs admin-clamp-2">
                                  {item.professional_name || "A definir"}
                                </strong>
                              </div>
                              <div className="rounded-lg bg-[var(--admin-bg)] p-2.5 col-span-2 sm:col-span-1">
                                <span className="block text-[var(--admin-text-muted)] uppercase font-bold tracking-wide">
                                  Horário
                                </span>
                                <strong className="block mt-0.5 text-[var(--admin-text-main)] text-xs">
                                  {item.scheduled_time || "Agora"}
                                </strong>
                              </div>
                            </div>
                            {item.notes && (
                              <p className="text-xs text-[var(--admin-text-muted)] border-t border-[var(--admin-border)] pt-2">
                                <span className="text-[var(--admin-accent)] font-semibold">
                                  Observação:
                                </span>{" "}
                                {item.notes}
                              </p>
                            )}
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--admin-border)]">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() =>
                                    handleMoveQueueItem(item, "up")
                                  }
                                  className="w-9 h-9 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-[var(--admin-text-muted)] hover:text-[var(--admin-accent)] disabled:opacity-25 transition-colors"
                                  aria-busy={actionLoadingId === item.id}
                                  title="Subir na fila"
                                  aria-label="Subir na fila"
                                >
                                  <ArrowUp className="w-3.5 h-3.5 mx-auto" />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === waitingList.length - 1}
                                  onClick={() =>
                                    handleMoveQueueItem(item, "down")
                                  }
                                  className="w-9 h-9 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-[var(--admin-text-muted)] hover:text-[var(--admin-accent)] disabled:opacity-25 transition-colors"
                                  aria-busy={actionLoadingId === item.id}
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
                                  className="w-9 h-9 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border border-[#25D366]/30 disabled:opacity-50 transition-colors"
                                  title="Avisar WhatsApp"
                                  aria-label="Avisar WhatsApp"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 mx-auto" />
                                </button>
                                <button
                                  type="button"
                                  disabled={actionLoadingId === item.id}
                                  onClick={() =>
                                    handleRemoveFromQueue(
                                      item.id,
                                      item.client_name,
                                    )
                                  }
                                  className="w-9 h-9 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-wait transition-colors"
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
              </div>
            )}
          </section>
        </div>
      ) : activeTab === "history" ? (
        /* HISTORY TAB */
        <div className="admin-card overflow-hidden p-3 space-y-3 rounded-2xl">
          <h2 className="text-xs font-bold text-[var(--admin-text-main)] flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-status-success" />
            <span>Histórico operacional ({historyList.length})</span>
          </h2>

          {historyList.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--admin-text-muted)]">
              Nenhum atendimento finalizado ou cancelado ainda hoje.
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto custom-scrollbar admin-table-wrap">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border-b border-[var(--admin-border)]">
                    <tr>
                      <th className="p-3 font-bold uppercase text-xs">
                        Cliente
                      </th>
                      <th className="p-3 font-bold uppercase text-xs">
                        Serviço
                      </th>
                      <th className="p-3 font-bold uppercase text-xs">
                        Barbeiro
                      </th>
                      <th className="p-3 font-bold uppercase text-xs">
                        Encerramento
                      </th>
                      <th className="p-3 font-bold uppercase text-xs text-right">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]">
                    {historyList.map((item) => {
                      const isCancelled = item.status === "cancelled";
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-[var(--admin-surface)] transition-colors"
                        >
                          <td className="p-3 font-bold text-[var(--admin-text-main)]">
                            {item.client_name}
                          </td>
                          <td className="p-3 text-[var(--admin-accent)]">
                            {item.service_title}
                          </td>
                          <td className="p-3 text-[var(--admin-text-main)]">
                            {item.professional_name}
                          </td>
                          <td
                            className={`p-3 font-bold ${isCancelled ? "text-status-error" : "text-status-success"}`}
                          >
                            {isCancelled
                              ? "Cancelado"
                              : item.completed_at || "Concluído"}
                          </td>
                          <td className="p-3 text-right">
                            <span
                              className={`px-2 py-0.5 rounded-xl text-xs font-bold ${isCancelled ? "bg-status-error/15 text-status-error" : "bg-status-success/15 text-status-success"}`}
                            >
                              {isCancelled ? "× Cancelado" : "✓ Concluído"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-[var(--admin-border)]">
                {historyList.map((item) => {
                  const isCancelled = item.status === "cancelled";
                  return (
                    <article
                      key={item.id}
                      className="py-3.5 space-y-2.5 border-b border-[var(--admin-border)] last:border-b-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-[var(--admin-text-main)] truncate">
                            {item.client_name}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--admin-accent)] truncate">
                            {item.service_title}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 px-2 py-1 rounded-full text-[11px] font-bold ${isCancelled ? "bg-status-error/15 text-status-error" : "bg-status-success/15 text-status-success"}`}
                        >
                          {isCancelled ? "Cancelado" : "Concluído"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="block text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)]">
                            Barbeiro
                          </span>
                          <strong className="block mt-0.5 text-[var(--admin-text-main)] truncate">
                            {item.professional_name}
                          </strong>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)]">
                            Encerramento
                          </span>
                          <strong
                            className={`block mt-0.5 truncate ${isCancelled ? "text-status-error" : "text-status-success"}`}
                          >
                            {isCancelled
                              ? "Cancelado"
                              : item.completed_at || "Concluído"}
                          </strong>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        /* ABANDONED ITEMS TAB */
        <div className="admin-card overflow-hidden p-3 space-y-3 rounded-2xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold text-[var(--admin-text-main)] flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-[var(--admin-accent)]" />
                <span>Removidos da fila ({abandonedList.length})</span>
              </h2>
              <p className="text-xs text-[var(--admin-text-muted)] mt-1">
                Podem voltar à fila ou ser cancelados.
              </p>
            </div>
          </div>

          {abandonedList.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--admin-text-muted)]">
              Nenhum removido recentemente.
            </div>
          ) : (
            <div className="space-y-2">
              {abandonedList.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[var(--admin-text-main)] text-xs admin-clamp-2">
                        {item.client_name}
                      </h3>
                      <span className="px-1.5 py-0.5 rounded-full bg-status-warning/10 text-status-warning text-xs font-bold border border-status-warning/20">
                        Removido
                      </span>
                    </div>
                    <p className="text-xs text-[var(--admin-accent)] font-semibold admin-clamp-2">
                      {item.service_title}
                    </p>
                    <p className="text-xs text-[var(--admin-text-muted)] admin-safe-wrap">
                      {item.professional_name || "Profissional a definir"} ·{" "}
                      {item.scheduled_time || "Horário não informado"}
                      {item.appointment_id
                        ? " · Agendamento preservado"
                        : " · Cliente avulso"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={actionLoadingId === item.id}
                      onClick={() =>
                        handleReturnToQueue(item.id, item.client_name)
                      }
                      className="px-3 py-2 rounded-lg bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-extrabold text-xs flex items-center gap-1.5 hover:bg-[var(--admin-accent)]/80 disabled:opacity-60 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Retornar à fila
                    </button>
                    {item.appointment_id ? (
                      <button
                        type="button"
                        disabled={actionLoadingId === item.id}
                        onClick={() => handleCancelQueuedAppointment(item)}
                        className="px-3 py-2 rounded-lg bg-status-error/10 text-status-error border border-status-error/20 font-extrabold text-xs flex items-center gap-1.5 hover:bg-status-error/20 disabled:opacity-60 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancelar atendimento
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={actionLoadingId === item.id}
                        onClick={() => handleDeleteAbandonedWalkIn(item)}
                        className="px-3 py-2 rounded-lg bg-status-error/10 text-status-error border border-status-error/20 font-extrabold text-xs flex items-center gap-1.5 hover:bg-status-error/20 disabled:opacity-60 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir registro
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
        <AdminModalV2
          icon={Plus}
          eyebrow="Recepção"
          title="Novo encaixe"
          subtitle="Adicione um cliente à recepção em poucos passos"
          onClose={() => {
            setIsServicePickerOpen(false);
            setIsAddModalOpen(false);
          }}
          size="md"
          footer={
            <div className="receipt-v2-actions">
              <button
                type="button"
                onClick={() => {
                  setIsServicePickerOpen(false);
                  setIsAddModalOpen(false);
                }}
                className="receipt-v2-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="walk-in-form"
                disabled={isSavingWalkIn}
                className="receipt-v2-primary"
              >
                {isSavingWalkIn ? "Inserindo…" : "Inserir na fila"}
              </button>
            </div>
          }
        >
          <form
            id="walk-in-form"
            onKeyDown={handleEnterAsTab}
            onSubmit={handleAddWalkInSubmit}
            className="admin-modal-v2-form-grid"
          >
            <div className="admin-modal-v2-field">
              <label
                className="admin-modal-v2-field-label"
                htmlFor="walk-in-client-name"
              >
                Nome do cliente *
              </label>
              <input
                id="walk-in-client-name"
                ref={clientNameInputRef}
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Ex: Gabriel Santos"
                className="admin-modal-v2-input"
                required
              />
            </div>

            <div className="admin-modal-v2-field">
              <label
                className="admin-modal-v2-field-label"
                htmlFor="walk-in-client-phone"
              >
                Telefone / WhatsApp
              </label>
              <input
                id="walk-in-client-phone"
                type="text"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                placeholder="(11) 99887-1122"
                className="admin-modal-v2-input"
              />
            </div>

            <div className="admin-modal-v2-form-grid admin-modal-v2-form-grid--2">
              <div className="admin-modal-v2-field">
                <label className="admin-modal-v2-field-label">Serviço *</label>
                <button
                  type="button"
                  data-enter-action="true"
                  onClick={() => setIsServicePickerOpen(true)}
                  className="admin-modal-v2-picker"
                  aria-haspopup="dialog"
                  aria-expanded={isServicePickerOpen}
                >
                  <span
                    className={`admin-clamp-2 ${!newServiceTitle ? "admin-modal-v2-picker-placeholder" : ""}`}
                  >
                    {newServiceTitle || "Selecionar serviço"}
                  </span>
                  <span className="admin-modal-v2-picker-price">
                    R$ {newServicePrice.toFixed(2)}
                  </span>
                </button>
              </div>

              <div className="admin-modal-v2-field">
                <label
                  className="admin-modal-v2-field-label"
                  htmlFor="walk-in-professional"
                >
                  Barbeiro *
                </label>
                <select
                  id="walk-in-professional"
                  value={newProfessionalId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setNewProfessionalId(id);
                    const found = professionals.find((p) => p.id === id);
                    if (found) setNewProfessionalName(found.name);
                  }}
                  className="admin-modal-v2-select"
                >
                  {professionals.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      className="bg-[var(--admin-surface)]"
                    >
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-modal-v2-field">
              <label
                className="admin-modal-v2-field-label"
                htmlFor="walk-in-notes"
              >
                Observações
              </label>
              <input
                id="walk-in-notes"
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Ex: Aceitou aguardar 15 min"
                className="admin-modal-v2-input"
              />
            </div>
          </form>
        </AdminModalV2>
      )}

      {/* MODAL: SERVICE PICKER */}
      {isAddModalOpen && isServicePickerOpen && (
        <AdminModalV2
          icon={Scissors}
          eyebrow="Novo encaixe"
          title="Selecionar serviço"
          onClose={() => setIsServicePickerOpen(false)}
          size="lg"
          labelledBy="service-picker-title"
        >
          {services.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--admin-text-muted)]">
              Nenhum serviço disponível.
            </p>
          ) : (
            <div className="admin-card-grid gap-2.5">
              {services.map((service) => {
                const isSelected = service.title === newServiceTitle;
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => handleSelectWalkInService(service)}
                    className={`min-h-16 p-3.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors ${isSelected ? "bg-[var(--admin-accent)]/10 border-[var(--admin-accent)] text-[var(--admin-text-main)]" : "bg-[var(--admin-bg)] border-[var(--admin-border)] text-[var(--admin-text-main)] hover:border-[var(--admin-accent)]/50"}`}
                  >
                    <span className="text-sm font-bold leading-snug">
                      {service.title}
                    </span>
                    <span className="text-sm font-black finance-positive shrink-0">
                      R$ {service.price.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </AdminModalV2>
      )}

      {/* MODAL: WHATSAPP ALERT */}
      {receiptCheckoutItem && (
        <ReceiptCheckoutModal
          source={{
            appointmentId: receiptCheckoutItem.appointment_id,
            clientId: receiptCheckoutItem.client_id,
            clientName: receiptCheckoutItem.client_name,
            clientPhone: receiptCheckoutItem.client_phone,
            professionalId: receiptCheckoutItem.professional_id,
            professionalName: receiptCheckoutItem.professional_name,
            serviceTitle: receiptCheckoutItem.service_title,
            servicePrice: receiptCheckoutItem.service_price,
          }}
          onClose={() => setReceiptCheckoutItem(null)}
          onPending={() =>
            showNotification("Recebimento pendente criado no Financeiro.")
          }
          onReceived={() =>
            showNotification(
              "Recebimento confirmado e lançado no extrato financeiro.",
            )
          }
        />
      )}

      {isWhatsAppModalOpen && selectedQueueItemForWa && (
        <AdminModalV2
          icon={MessageCircle}
          eyebrow="WhatsApp"
          title="Avisar cliente"
          subtitle={selectedQueueItemForWa.client_name}
          onClose={() => setIsWhatsAppModalOpen(false)}
          accent="whatsapp"
          size="sm"
          footer={
            <div className="receipt-v2-actions">
              <button
                type="button"
                onClick={handleCopyWaMessage}
                className="receipt-v2-secondary"
              >
                {copiedNotice ? (
                  <Check className="receipt-v2-button-icon text-status-success" />
                ) : (
                  <Copy className="receipt-v2-button-icon" />
                )}
                <span>{copiedNotice ? "Copiado!" : "Copiar texto"}</span>
              </button>
              <button
                type="button"
                onClick={handleSendWhatsAppDirect}
                className="receipt-v2-primary"
                style={{
                  background: "var(--color-whatsapp)",
                  color: "var(--color-whatsapp-on)",
                }}
              >
                <Send className="receipt-v2-button-icon" />
                <span>Enviar no WhatsApp</span>
              </button>
            </div>
          }
        >
          <div
            className="receipt-v2-notice"
            style={{
              borderColor:
                "color-mix(in srgb, var(--color-whatsapp) 18%, transparent)",
              background:
                "color-mix(in srgb, var(--color-whatsapp) 7%, transparent)",
            }}
          >
            <Zap
              aria-hidden="true"
              style={{ color: "var(--color-whatsapp)" }}
            />
            <span>
              Integração via API Web/wa.me ativa. O cliente recebe a mensagem
              diretamente.
            </span>
          </div>

          <label className="admin-modal-v2-field">
            <span className="admin-modal-v2-field-label">Mensagem</span>
            <textarea
              rows={4}
              value={customWaMessage}
              onChange={(e) => setCustomWaMessage(e.target.value)}
              className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl p-3 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[#25D366] resize-none mt-1.5 transition-colors"
            />
          </label>
        </AdminModalV2>
      )}
    </div>
  );
};
