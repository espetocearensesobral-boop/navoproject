import React, { useState, useEffect, useMemo } from "react";
import { Appointment, Professional } from "../../types";
import { handleEnterAsTab } from "../../utils/formUtils";
import { authFetch } from "../../lib/api";
import {
  fetchAppointmentsFromSupabase,
  fetchProfessionalsFromSupabase,
  fetchServicesFromSupabase,
  fetchScheduleBlocks,
  addScheduleBlock,
  deleteScheduleBlock,
  createAppointmentInSupabase,
  ScheduleBlock,
} from "../../services/supabaseDataService";
import {
  ShopProfile,
  defaultShopProfile,
  fetchShopProfile,
  generateTimeSlotsFromProfile,
} from "../../services/shopProfileService";
import {
  fetchOperationSettings,
  defaultOperationSettings,
  type OperationSettings,
} from "../../services/operationSettingsService";
import {
  Calendar,
  Clock,
  Plus,
  Lock,
  Unlock,
  UserCheck,
  ShieldAlert,
  CheckCircle2,
  X,
  Save,
  RefreshCw,
  Scissors,
  AlertTriangle,
  Timer,
} from "lucide-react";
import {
  getTodayStringBRT,
  getCurrentTimeBRT,
  timeToMinutes,
} from "../../utils/dateUtils";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import { AdminFab } from "./shared/AdminFab";
import { AdminListSkeleton } from "./shared/AdminSkeleton";
import { AdminModalV2 } from "./shared/AdminModalV2";

const PROFESSIONAL_ACCENT_COUNT = 6;

const getProfessionalAccent = (professionalId: string) => {
  let hash = 0;
  for (let index = 0; index < professionalId.length; index += 1) {
    hash = (hash * 31 + professionalId.charCodeAt(index)) | 0;
  }
  return `var(--color-admin-professional-${Math.abs(hash) % PROFESSIONAL_ACCENT_COUNT})`;
};

export const ScheduleGrid: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getTodayStringBRT(),
  );
  const [selectedBarberId, setSelectedBarberId] = useState<string>("all");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Professional[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopProfile, setShopProfile] =
    useState<ShopProfile>(defaultShopProfile);
  const [operationSettings, setOperationSettings] = useState<OperationSettings>(
    defaultOperationSettings,
  );
  const [currentBrtMinutes, setCurrentBrtMinutes] = useState(
    () => getCurrentTimeBRT().totalMinutes,
  );

  useEffect(() => {
    const refreshCurrentTime = () =>
      setCurrentBrtMinutes(getCurrentTimeBRT().totalMinutes);
    refreshCurrentTime();
    const intervalId = window.setInterval(refreshCurrentTime, 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    fetchShopProfile().then((p) => {
      if (p) setShopProfile(p);
    });
    fetchOperationSettings().then(setOperationSettings);
  }, []);

  // Modals
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isManualBookingOpen, setIsManualBookingOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [notificationTone, setNotificationTone] = useState<"success" | "error">(
    "success",
  );
  const [savingBlock, setSavingBlock] = useState(false);
  const [savingManualBooking, setSavingManualBooking] = useState(false);

  // Block Form State
  const [blockForm, setBlockForm] = useState({
    professional_id: "",
    start_time: "12:00",
    end_time: "13:00",
    reason: "Pausa para Almoço / Lanche",
  });

  // Manual Booking State
  const [manualBookingForm, setManualBookingForm] = useState({
    client_name: "",
    client_phone: "",
    professional_id: "",
    service_id: "",
    time_slot: "10:00",
  });

  const timeSlots = useMemo(
    () =>
      generateTimeSlotsFromProfile(
        shopProfile,
        selectedDate,
        30,
        operationSettings.slotIntervalMinutes,
      ),
    [shopProfile, selectedDate, operationSettings.slotIntervalMinutes],
  );

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener("adminRefresh", handleRefresh);
    return () => window.removeEventListener("adminRefresh", handleRefresh);
  }, [selectedDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [apts, profs, srvs, blks] = await Promise.all([
        fetchAppointmentsFromSupabase(undefined, { strict: true }),
        fetchProfessionalsFromSupabase(true),
        fetchServicesFromSupabase(),
        fetchScheduleBlocks(),
      ]);

      setAppointments(apts);
      const filteredProfs = profs.filter(
        (p) => p.id !== "prof_any" && p.is_active !== false,
      );
      setBarbers(filteredProfs);
      setServices(srvs);
      setBlocks(blks);

      if (filteredProfs.length > 0 && !blockForm.professional_id) {
        setBlockForm((prev) => ({
          ...prev,
          professional_id: filteredProfs[0].id,
        }));
        setManualBookingForm((prev) => ({
          ...prev,
          professional_id: filteredProfs[0].id,
          service_id: prev.service_id || srvs[0]?.id || "",
        }));
      }
    } catch (err: any) {
      showNotification(err?.message || "Não foi possível carregar a agenda.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const prof = barbers.find((b) => b.id === blockForm.professional_id);
    if (!prof) {
      showNotification(
        "Selecione um profissional ativo para bloquear o horário.",
        "error",
      );
      return;
    }
    if (
      timeToMinutes(blockForm.start_time) >= timeToMinutes(blockForm.end_time)
    ) {
      showNotification(
        "O início do bloqueio deve ser anterior ao fim.",
        "error",
      );
      return;
    }

    setSavingBlock(true);
    try {
      const updatedBlocks = await addScheduleBlock({
        professional_id: prof.id,
        date: selectedDate,
        start_time: blockForm.start_time,
        end_time: blockForm.end_time,
        reason: blockForm.reason,
      });
      setBlocks(updatedBlocks);
      setIsBlockModalOpen(false);
      showNotification(
        `${blockForm.start_time}–${blockForm.end_time} bloqueado para ${prof.name}.`,
      );
    } catch (err: any) {
      showNotification(
        err?.message || "Não foi possível criar o bloqueio.",
        "error",
      );
    } finally {
      setSavingBlock(false);
    }
  };

  const handleUnblock = async (id: string) => {
    try {
      const updated = await deleteScheduleBlock(id);
      setBlocks(updated);
      showNotification("Bloqueio removido da agenda.");
    } catch (err: any) {
      showNotification(err?.message || "Não foi possível remover o bloqueio.");
    }
  };

  const handleAcceptPendingAppointment = async (aptId: string) => {
    try {
      const res = await authFetch(`/api/appointments/${aptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });
      if (res.ok) {
        showNotification(
          "Agendamento fora do expediente aprovado com sucesso!",
        );
        await loadData();
      } else {
        const errData = await res.json().catch(() => ({}));
        showNotification(
          `Erro ao aprovar agendamento: ${errData.error || "Erro desconhecido"}`,
        );
      }
    } catch (err) {
      showNotification(
        "Falha ao conectar com o servidor para aprovar agendamento.",
      );
    }
  };

  const handleManualBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prof = barbers.find(
      (b) => b.id === manualBookingForm.professional_id,
    );
    const service = services.find((s) => s.id === manualBookingForm.service_id);
    if (!prof || !service || !manualBookingForm.client_name.trim()) {
      showNotification(
        "Informe cliente, profissional, serviço e horário válidos.",
        "error",
      );
      return;
    }

    const servicePrice = Number(service.price || 0);
    const serviceDuration = Number(service.duration_minutes || 30);
    const newApt: Appointment = {
      id: `apt_m_${Date.now()}`,
      client_id: "usr_manual",
      client_name: manualBookingForm.client_name.trim(),
      client_phone: manualBookingForm.client_phone,
      professional_id: prof.id,
      professional_name: prof.name,
      services: [service],
      total_duration_minutes: serviceDuration,
      original_amount: servicePrice,
      discount_amount: 0,
      final_amount: servicePrice,
      loyalty_points_used: 0,
      date: selectedDate,
      time_slot: manualBookingForm.time_slot,
      status: "confirmed",
      payment_method: "pay_at_venue",
      created_at: new Date().toISOString(),
    };

    setSavingManualBooking(true);
    try {
      await createAppointmentInSupabase(newApt, { adminManual: true });
      await loadData();
      setIsManualBookingOpen(false);
      showNotification(`Encaixe criado para ${newApt.client_name}.`);
    } catch (err: any) {
      showNotification(
        err?.message || "Não foi possível criar o encaixe.",
        "error",
      );
    } finally {
      setSavingManualBooking(false);
    }
  };

  const showNotification = (
    msg: string,
    tone: "success" | "error" = "success",
  ) => {
    setNotificationTone(tone);
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const isBlockCoveringSlot = (block: ScheduleBlock, slot: string) => {
    return (
      block.date === selectedDate &&
      block.professional_id !== "" &&
      timeToMinutes(block.start_time) <= timeToMinutes(slot) &&
      timeToMinutes(slot) < timeToMinutes(block.end_time)
    );
  };

  const activeBarbers =
    selectedBarberId === "all"
      ? barbers
      : barbers.filter((b) => b.id === selectedBarberId);

  const getAppointmentOperationalState = (apt: Appointment) => {
    const isToday = selectedDate === getTodayStringBRT();
    const status = apt.status as string;
    const startMinutes = timeToMinutes(apt.time_slot);
    const durationMinutes = Number(apt.total_duration_minutes || 30);
    const isAwaitingClient = status === "confirmed" || status === "in_queue";
    const isInService = status === "in_service" || status === "in_chair";
    const isLate =
      isToday && isAwaitingClient && currentBrtMinutes >= startMinutes + 10;
    const remainingMinutes =
      isToday && isInService
        ? Math.max(0, startMinutes + durationMinutes - currentBrtMinutes)
        : 0;

    return {
      isLate,
      lateMinutes: isLate ? currentBrtMinutes - startMinutes : 0,
      remainingMinutes,
      isInService,
    };
  };

  const getAppointmentStatusLabel = (status: string) => {
    if (status === "completed") return "Concluído";
    if (status === "in_service" || status === "in_chair")
      return "Em atendimento";
    if (status === "in_queue") return "Na fila";
    return "Confirmado";
  };

  return (
    <div className="space-y-4">
      {/* SUCCESS NOTIFICATION */}
      {successMsg && (
        <div
          className={`p-3 rounded-xl text-sm font-semibold flex items-center justify-between animate-fade-in ${notificationTone === "error" ? "bg-status-error/15 border border-status-error/30 text-status-error" : "bg-status-success/15 border border-status-success/30 text-status-success"}`}
        >
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4" />
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

      {/* ========================================================= */}
      {/* MOBILE AGENDA VIEW (COMPACT, MINIMALIST, SMART) - md:hidden */}
      {/* ========================================================= */}
      <div className="md:hidden space-y-3">
        {/* Compact Top Action Bar */}
        <div className="admin-card p-3 rounded-2xl flex items-center justify-between gap-2">
          {/* Quick Date Selector */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[var(--admin-surface)] text-[var(--admin-accent)] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="admin-input h-8 text-xs font-bold max-w-[130px] rounded-xl px-2"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsBlockModalOpen(true)}
              className="admin-btn-icon-sm admin-btn-destructive border border-status-error/30 rounded-xl cursor-pointer"
              title="Bloquear horário"
              aria-label="Bloquear horário"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Repositioned Barber Filter Pills */}
        <div
          data-gesture-scroll="horizontal"
          className="admin-category-scroll flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1"
        >
          <button
            onClick={() => setSelectedBarberId("all")}
            className={`shrink-0 min-h-10 px-4 py-1.5 rounded-[var(--admin-radius-md)] text-sm font-semibold whitespace-nowrap transition-all border ${
              selectedBarberId === "all"
                ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)] border-[var(--admin-accent)]"
                : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border-[var(--admin-border)] hover:text-[var(--admin-text-main)]"
            }`}
          >
            Todos
          </button>
          {barbers.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBarberId(b.id)}
              className={`shrink-0 min-h-10 px-4 py-1.5 rounded-[var(--admin-radius-md)] text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 border ${
                selectedBarberId === b.id
                  ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)] border-[var(--admin-accent)]"
                  : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border-[var(--admin-border)] hover:text-[var(--admin-text-main)]"
              }`}
            >
              <span>{b.name}</span>
            </button>
          ))}
        </div>

        {/* Compact Timeline Feed */}
        <div className="space-y-3" aria-busy={loading}>
          {loading ? (
            <AdminListSkeleton rows={5} />
          ) : (
            timeSlots.map((slot) => {
              // Find appointments or blocks in this time slot for active barbers
              const slotAppointments = activeBarbers
                .map((barber) => {
                  const apt = appointments.find(
                    (a) =>
                      a.professional_id === barber.id &&
                      a.date === selectedDate &&
                      a.time_slot === slot &&
                      a.status !== "cancelled" &&
                      a.status !== "completed",
                  );
                  const block = blocks.find(
                    (b) =>
                      b.professional_id === barber.id &&
                      isBlockCoveringSlot(b, slot),
                  );
                  return { barber, apt, block };
                })
                .filter((item) => item.apt || item.block);

              return (
                <div key={slot} className="flex items-stretch gap-3">
                  <div className="w-16 shrink-0 pt-3 text-right">
                    {/* Time Badge */}
                    <span className="text-sm font-mono tabular-nums font-bold text-[var(--admin-text-muted)]">
                      {slot}
                    </span>
                  </div>

                  {/* Slot Items Container */}
                  <div className="flex-1 space-y-2 min-w-0 pb-1">
                    {slotAppointments.length === 0 ? (
                      <div
                        onClick={() => {
                          setManualBookingForm((prev) => ({
                            ...prev,
                            time_slot: slot,
                          }));
                          setIsManualBookingOpen(true);
                        }}
                        className="min-h-[72px] px-4 rounded-[var(--admin-radius-lg)] bg-[var(--admin-surface)] border-2 border-dashed border-[var(--admin-border)] hover:border-[var(--admin-accent)]/50 flex items-center justify-between text-base font-semibold text-[var(--admin-text-muted)] cursor-pointer group transition-colors"
                      >
                        <span>Livre</span>
                        <span className="w-10 h-10 rounded-full bg-[var(--admin-bg)] text-[var(--admin-text-muted)] group-hover:text-[var(--admin-accent)] flex items-center justify-center transition-colors">
                          <Plus className="w-5 h-5" />
                        </span>
                      </div>
                    ) : (
                      slotAppointments.map(({ barber, apt, block }) => {
                        if (apt) {
                          const isPending = apt.status === "pending_approval";
                          const operationalState =
                            getAppointmentOperationalState(apt);
                          const professionalAccent =
                            selectedBarberId === "all" &&
                            !operationalState.isLate &&
                            !isPending
                              ? getProfessionalAccent(barber.id)
                              : undefined;
                          return (
                            <div
                              key={apt.id}
                              style={
                                professionalAccent
                                  ? { borderLeftColor: professionalAccent }
                                  : undefined
                              }
                              className={`p-4 rounded-[var(--admin-radius-lg)] border border-l-4 shadow-sm transition-all ${
                                isPending
                                  ? "bg-amber-500/10 border-amber-500/50 text-amber-200 shadow-sm"
                                  : operationalState.isLate
                                    ? "bg-amber-500/5 border-amber-500/60"
                                    : "bg-[var(--admin-surface)] border-[var(--admin-border)]"
                              }`}
                            >
                              {isPending && (
                                <div className="flex items-center justify-between text-xs font-bold text-amber-300 mb-1.5 uppercase tracking-wider bg-amber-500/20 px-2 py-0.5 rounded-xl border border-amber-500/30">
                                  <div className="flex items-center gap-1">
                                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span>Fora do horário</span>
                                  </div>
                                  <span className="text-xs bg-amber-400 text-black px-1.5 rounded-xl font-extrabold">
                                    Pendente
                                  </span>
                                </div>
                              )}
                              {operationalState.isLate && (
                                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold schedule-late-text uppercase tracking-wide">
                                  <AlertTriangle className="w-3.5 h-3.5 schedule-late-text shrink-0" />
                                  <span>
                                    Atrasado {operationalState.lateMinutes} min
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between items-center text-base mb-2 gap-3">
                                <span className="font-bold text-[var(--admin-text-main)] truncate">
                                  {apt.client_name || (apt as any).clientName}
                                </span>
                                <span className="font-extrabold finance-positive text-base shrink-0">
                                  R${" "}
                                  {apt.final_amount
                                    ? Number(apt.final_amount).toFixed(2)
                                    : "60.00"}
                                </span>
                              </div>
                              <div className="flex justify-between items-start gap-3 text-sm text-[var(--admin-text-muted)]">
                                <span className="min-w-0 leading-relaxed">
                                  {(apt.services && apt.services[0]?.title) ||
                                    "Atendimento"}
                                </span>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  {operationalState.remainingMinutes > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-status-info bg-status-info/10 border border-status-info/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                                      <Timer className="w-3 h-3" />
                                      Faltam {
                                        operationalState.remainingMinutes
                                      }{" "}
                                      min
                                    </span>
                                  )}
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-semibold text-xs ${
                                      isPending
                                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                        : apt.status === "completed"
                                          ? "bg-status-success/15 text-status-success"
                                          : operationalState.isInService
                                            ? "bg-status-info/10 text-status-info border border-status-info/20"
                                            : "bg-status-success/15 text-status-success"
                                    }`}
                                  >
                                    {isPending
                                      ? "Aprovação"
                                      : getAppointmentStatusLabel(apt.status)}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2 pt-2 border-t border-[var(--admin-border)]/70 flex items-center justify-between gap-2 text-xs">
                                <span className="font-bold uppercase tracking-wide text-[var(--admin-text-muted)]">
                                  Barbeiro
                                </span>
                                <span className="font-bold text-[var(--admin-accent)] truncate">
                                  {barber.name}
                                </span>
                              </div>

                              {isPending && (
                                <div className="pt-2 border-t border-amber-500/20 flex items-center justify-end gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAcceptPendingAppointment(apt.id)
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all active:scale-95"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Aceitar</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        }

                        if (block) {
                          return (
                            <div
                              key={block.id}
                              className="min-h-[72px] p-4 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-between text-sm text-red-300 shadow-sm"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <Lock className="w-3 h-3 text-red-400 shrink-0" />
                                <span className="font-semibold truncate">
                                  {barber.name}: {block.reason}
                                </span>
                              </div>
                              <button
                                onClick={() => handleUnblock(block.id)}
                                className="text-xs text-red-400 underline font-bold shrink-0 ml-1"
                              >
                                Desbloquear
                              </button>
                            </div>
                          );
                        }

                        return null;
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* DESKTOP AGENDA VIEW (FULL GRID TABLE) - hidden md:block   */}
      {/* ========================================================= */}
      <div className="hidden md:block space-y-6">
        {/* Header Bar */}
        <AdminPageHeader
          icon={Calendar}
          title="Agenda"
        >
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="admin-input h-9 text-xs font-bold rounded-xl px-3"
            />

            <select
              value={selectedBarberId}
              onChange={(e) => setSelectedBarberId(e.target.value)}
              className="admin-input h-9 text-xs font-bold rounded-xl px-3"
            >
              <option value="all">Todos os barbeiros</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsBlockModalOpen(true)}
              className="admin-btn admin-btn-sm admin-btn-destructive border border-status-error/30 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Bloquear Horário</span>
            </button>
          </div>
        </AdminPageHeader>

        {/* Schedule Grid Table */}
        <div className="w-full overflow-x-auto rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
          <div className="w-full min-w-[750px]">
            {/* Table Header: Barbers Columns. Colunas geradas dinamicamente pelo nº de barbeiros
                ativos (evita desalinhamento quando há mais de 3, que quebrava linha com grid-cols-3 fixo). */}
            <div
              className="sticky top-0 z-10 grid bg-[var(--admin-bg)] border-b border-[var(--admin-border)] text-xs font-extrabold text-[var(--admin-accent)]"
              style={{
                gridTemplateColumns: `7rem repeat(${Math.max(activeBarbers.length, 1)}, minmax(9rem, 1fr))`,
              }}
            >
              <div className="p-3 border-r border-[var(--admin-border)] text-center flex items-center justify-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Horário</span>
              </div>
              {activeBarbers.map((barber) => (
                <div
                  key={barber.id}
                  className="p-3 flex items-center justify-center space-x-2 border-r border-[var(--admin-border)] last:border-r-0"
                >
                  <img
                    src={barber.photo_url}
                    alt={barber.name}
                    className="w-6 h-6 rounded-full object-cover border border-[var(--admin-accent)]"
                  />
                  <span className="text-[var(--admin-text-main)] font-bold truncate">
                    {barber.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Time Slots Rows */}
            <div className="divide-y divide-[var(--admin-border)]">
              {timeSlots.map((slot) => {
                const isNowRow =
                  selectedDate === getTodayStringBRT() &&
                  currentBrtMinutes >= timeToMinutes(slot) &&
                  currentBrtMinutes <
                    timeToMinutes(slot) +
                      (operationSettings.slotIntervalMinutes || 30);
                return (
                  <div
                    key={slot}
                    className={`grid transition-colors ${isNowRow ? "bg-[var(--admin-accent)]/[0.06]" : "hover:bg-[var(--admin-bg)]/50"}`}
                    style={{
                      gridTemplateColumns: `7rem repeat(${Math.max(activeBarbers.length, 1)}, minmax(9rem, 1fr))`,
                    }}
                  >
                    {/* Time Label */}
                    <div
                      className={`p-3 border-r border-[var(--admin-border)] text-center text-xs font-bold flex items-center justify-center gap-1 ${isNowRow ? "text-[var(--admin-accent)]" : "text-[var(--admin-text-muted)]"}`}
                    >
                      {isNowRow && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-[var(--admin-accent)] shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      {slot}
                    </div>

                    {/* Barbers Cells */}
                    {activeBarbers.map((barber) => {
                      const apt = appointments.find(
                        (a) =>
                          a.professional_id === barber.id &&
                          a.date === selectedDate &&
                          a.time_slot === slot &&
                          a.status !== "cancelled" &&
                          a.status !== "completed",
                      );
                      const isPending = apt?.status === "pending_approval";
                      const operationalState = apt
                        ? getAppointmentOperationalState(apt)
                        : null;
                      const professionalAccent =
                        selectedBarberId === "all" &&
                        !operationalState?.isLate &&
                        !isPending
                          ? getProfessionalAccent(barber.id)
                          : undefined;

                      const block = blocks.find(
                        (b) =>
                          b.professional_id === barber.id &&
                          isBlockCoveringSlot(b, slot),
                      );

                      return (
                        <div
                          key={barber.id}
                          className="p-2 min-h-[52px] flex items-center border-r border-[var(--admin-border)] last:border-r-0"
                        >
                          {apt ? (
                            <div
                              style={
                                professionalAccent
                                  ? { borderLeftColor: professionalAccent }
                                  : undefined
                              }
                              className={`w-full border border-l-4 p-2 rounded-r-[var(--admin-radius-md)] space-y-1 ${
                                isPending
                                  ? "bg-amber-500/10 border-amber-500/50"
                                  : operationalState?.isLate
                                    ? "bg-amber-500/5 border-amber-500/60"
                                    : "bg-[var(--admin-bg)] border-[var(--admin-border)]"
                              }`}
                            >
                              {isPending && (
                                <div className="flex items-center gap-1 text-xs font-bold text-amber-300 uppercase tracking-wide">
                                  <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
                                  <span>Fora do expediente</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between text-xs font-bold text-[var(--admin-text-main)] gap-2">
                                <span className="truncate">
                                  {apt.client_name}
                                </span>
                                <span className="text-xs finance-positive shrink-0">
                                  R$ {apt.final_amount.toFixed(2)}
                                </span>
                              </div>
                              <div className="text-xs text-[var(--admin-text-muted)] flex items-center justify-between gap-2">
                                <span className="truncate">
                                  {apt.services[0]?.title || "Atendimento"}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {operationalState?.remainingMinutes &&
                                  operationalState.remainingMinutes > 0 ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-status-info">
                                      <Timer className="w-3 h-3" />{" "}
                                      {operationalState.remainingMinutes} min
                                    </span>
                                  ) : null}
                                  {!isPending && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded-xl text-xs font-bold ${
                                        operationalState?.isInService
                                          ? "bg-status-info/10 text-status-info border border-status-info/20"
                                          : "bg-status-success/20 text-status-success"
                                      }`}
                                    >
                                      {getAppointmentStatusLabel(apt.status)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {operationalState?.isLate && (
                                <div className="inline-flex items-center gap-1 text-xs font-bold schedule-late-text">
                                  <AlertTriangle className="w-3 h-3 schedule-late-text" />
                                  Atrasado {operationalState.lateMinutes} min
                                </div>
                              )}
                              {isPending && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAcceptPendingAppointment(apt.id)
                                  }
                                  className="w-full mt-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors active:scale-[0.97]"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Aceitar</span>
                                </button>
                              )}
                            </div>
                          ) : block ? (
                            <div className="w-full bg-red-950/30 border border-red-500/30 p-2 rounded-xl flex items-center justify-between text-xs text-red-300">
                              <div className="flex items-center space-x-1.5">
                                <Lock className="w-3.5 h-3.5 text-red-400" />
                                <span className="font-semibold text-xs">
                                  {block.reason}
                                </span>
                              </div>
                              <button
                                onClick={() => handleUnblock(block.id)}
                                className="text-red-400 hover:text-[var(--admin-text-main)] text-xs underline ml-2"
                                title="Desbloquear horário"
                              >
                                Desbloquear
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--admin-text-muted)] italic">
                              Disponível
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Bloquear Horário */}
      {isBlockModalOpen && (
        <AdminModalV2
          icon={Lock}
          eyebrow="Operação de Grade"
          title="Bloquear Horário"
          subtitle="Impedir agendamentos no período selecionado"
          accent="neutral"
          size="sm"
          onClose={() => setIsBlockModalOpen(false)}
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsBlockModalOpen(false)}
                className="admin-btn admin-btn-sm admin-btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="block-time-form"
                disabled={savingBlock}
                className="admin-btn admin-btn-sm admin-btn-destructive"
              >
                {savingBlock ? "Salvando..." : "Confirmar Bloqueio"}
              </button>
            </div>
          }
        >
          <form
            id="block-time-form"
            onKeyDown={handleEnterAsTab}
            onSubmit={handleAddBlock}
            className="space-y-3.5"
          >
            <div>
              <label className="text-xs font-bold text-[var(--admin-text-main)] block mb-1">
                Barbeiro *
              </label>
              <select
                value={blockForm.professional_id}
                onChange={(e) =>
                  setBlockForm({
                    ...blockForm,
                    professional_id: e.target.value,
                  })
                }
                className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] outline-none focus:border-status-error/60 transition-colors"
              >
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--admin-text-main)] block mb-1">
                  Início *
                </label>
                <select
                  value={blockForm.start_time}
                  onChange={(e) =>
                    setBlockForm({
                      ...blockForm,
                      start_time: e.target.value,
                      end_time:
                        timeToMinutes(e.target.value) >=
                        timeToMinutes(blockForm.end_time)
                          ? timeSlots.find(
                              (ts) =>
                                timeToMinutes(ts) >
                                timeToMinutes(e.target.value),
                            ) || blockForm.end_time
                          : blockForm.end_time,
                    })
                  }
                  className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] outline-none focus:border-status-error/60 transition-colors"
                >
                  {timeSlots.map((ts) => (
                    <option key={ts} value={ts}>
                      {ts}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--admin-text-main)] block mb-1">
                  Fim *
                </label>
                <select
                  value={blockForm.end_time}
                  onChange={(e) =>
                    setBlockForm({ ...blockForm, end_time: e.target.value })
                  }
                  className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] outline-none focus:border-status-error/60 transition-colors"
                >
                  {timeSlots
                    .filter(
                      (ts) =>
                        timeToMinutes(ts) >
                        timeToMinutes(blockForm.start_time),
                    )
                    .map((ts) => (
                      <option key={ts} value={ts}>
                        {ts}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--admin-text-main)] block mb-1">
                Motivo do Bloqueio *
              </label>
              <input
                type="text"
                value={blockForm.reason}
                onChange={(e) =>
                  setBlockForm({ ...blockForm, reason: e.target.value })
                }
                placeholder="Ex: Almoço, Intervalo, Consulta Médica"
                className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] outline-none focus:border-status-error/60 transition-colors"
                required
              />
            </div>
          </form>
        </AdminModalV2>
      )}

      {/* Modal: Encaixe Manual Presencial */}
      {isManualBookingOpen && (
        <AdminModalV2
          icon={Scissors}
          eyebrow="Agenda Manual"
          title="Encaixe Presencial"
          subtitle="Registrar agendamento direto na grade"
          accent="gold"
          size="sm"
          onClose={() => setIsManualBookingOpen(false)}
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setIsManualBookingOpen(false)}
                className="admin-btn admin-btn-sm admin-btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="manual-booking-form"
                disabled={savingManualBooking}
                className="admin-btn admin-btn-sm admin-btn-primary disabled:opacity-60 disabled:cursor-wait"
              >
                {savingManualBooking
                  ? "Salvando..."
                  : "Confirmar Agendamento"}
              </button>
            </div>
          }
        >
          <form
            id="manual-booking-form"
            onKeyDown={handleEnterAsTab}
            onSubmit={handleManualBookingSubmit}
            className="space-y-3.5"
          >
            <div>
              <label className="text-xs font-bold text-[var(--admin-text-main)] block mb-1">
                Nome do Cliente *
              </label>
              <input
                type="text"
                value={manualBookingForm.client_name}
                onChange={(e) =>
                  setManualBookingForm({
                    ...manualBookingForm,
                    client_name: e.target.value,
                  })
                }
                placeholder="Ex: Gabriel Santos"
                className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)] transition-colors"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--admin-text-main)] block mb-1">
                  Telefone WhatsApp
                </label>
                <input
                  type="text"
                  value={manualBookingForm.client_phone}
                  onChange={(e) =>
                    setManualBookingForm({
                      ...manualBookingForm,
                      client_phone: e.target.value,
                    })
                  }
                  placeholder="(11) 98765-4321"
                  className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)] transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--admin-text-main)] block mb-1">
                  Barbeiro *
                </label>
                <select
                  value={manualBookingForm.professional_id}
                  onChange={(e) =>
                    setManualBookingForm({
                      ...manualBookingForm,
                      professional_id: e.target.value,
                    })
                  }
                  className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)] transition-colors"
                >
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--admin-text-main)] block mb-1">
                  Serviço real *
                </label>
                <select
                  value={manualBookingForm.service_id}
                  onChange={(e) =>
                    setManualBookingForm({
                      ...manualBookingForm,
                      service_id: e.target.value,
                    })
                  }
                  className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)] transition-colors"
                  required
                >
                  <option value="">Selecione</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.title} — R${" "}
                      {Number(service.price || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--admin-text-main)] block mb-1">
                  Horário *
                </label>
                <select
                  value={manualBookingForm.time_slot}
                  onChange={(e) =>
                    setManualBookingForm({
                      ...manualBookingForm,
                      time_slot: e.target.value,
                    })
                  }
                  className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)] transition-colors"
                  required
                >
                  {timeSlots.map((ts) => (
                    <option key={ts} value={ts}>
                      {ts}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {manualBookingForm.service_id &&
              (() => {
                const selectedService = services.find(
                  (service) => service.id === manualBookingForm.service_id,
                );
                return selectedService ? (
                  <p className="text-xs text-[var(--admin-text-muted)]">
                    Duração real:{" "}
                    <strong className="text-[var(--admin-accent)]">
                      {selectedService.duration_minutes} min
                    </strong>
                    . O valor será recalculado pelo servidor.
                  </p>
                ) : null;
              })()}
          </form>
        </AdminModalV2>
      )}

      <AdminFab
        onClick={() => setIsManualBookingOpen(true)}
        label="Novo Agendamento"
        icon={Plus}
      />
    </div>
  );
};
