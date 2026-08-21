import React, { useState, useEffect, useMemo } from 'react';
import { Appointment, Professional } from '../../types';
import { handleEnterAsTab } from '../../utils/formUtils';
import { authFetch } from '../../lib/api';
import {
  fetchAppointmentsFromSupabase,
  fetchProfessionalsFromSupabase,
  fetchServicesFromSupabase,
  fetchScheduleBlocks,
  addScheduleBlock,
  deleteScheduleBlock,
  createAppointmentInSupabase,
  ScheduleBlock
} from '../../services/supabaseDataService';
import { 
  ShopProfile, 
  defaultShopProfile, 
  fetchShopProfile, 
  generateTimeSlotsFromProfile 
} from '../../services/shopProfileService';
import { fetchOperationSettings, defaultOperationSettings, type OperationSettings } from '../../services/operationSettingsService';
import { Calendar, Clock, Plus, Lock, Unlock, UserCheck, ShieldAlert, CheckCircle2, X, Save, RefreshCw, Scissors, AlertTriangle, Timer } from 'lucide-react';
import { getTodayStringBRT, getCurrentTimeBRT, timeToMinutes } from '../../utils/dateUtils';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { AdminListSkeleton } from './shared/AdminSkeleton';

const PROFESSIONAL_ACCENT_COUNT = 6;

const getProfessionalAccent = (professionalId: string) => {
  let hash = 0;
  for (let index = 0; index < professionalId.length; index += 1) {
    hash = (hash * 31 + professionalId.charCodeAt(index)) | 0;
  }
  return `var(--color-admin-professional-${Math.abs(hash) % PROFESSIONAL_ACCENT_COUNT})`;
};

export const ScheduleGrid: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayStringBRT());
  const [selectedBarberId, setSelectedBarberId] = useState<string>('all');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Professional[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopProfile, setShopProfile] = useState<ShopProfile>(defaultShopProfile);
  const [operationSettings, setOperationSettings] = useState<OperationSettings>(defaultOperationSettings);
  const [currentBrtMinutes, setCurrentBrtMinutes] = useState(() => getCurrentTimeBRT().totalMinutes);

  useEffect(() => {
    const refreshCurrentTime = () => setCurrentBrtMinutes(getCurrentTimeBRT().totalMinutes);
    refreshCurrentTime();
    const intervalId = window.setInterval(refreshCurrentTime, 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    fetchShopProfile().then(p => {
      if (p) setShopProfile(p);
    });
    fetchOperationSettings().then(setOperationSettings);
  }, []);

  // Modals
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isManualBookingOpen, setIsManualBookingOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [notificationTone, setNotificationTone] = useState<'success' | 'error'>('success');
  const [savingBlock, setSavingBlock] = useState(false);
  const [savingManualBooking, setSavingManualBooking] = useState(false);

  // Block Form State
  const [blockForm, setBlockForm] = useState({
    professional_id: '',
    start_time: '12:00',
    end_time: '13:00',
    reason: 'Pausa para Almoço / Lanche'
  });

  // Manual Booking State
  const [manualBookingForm, setManualBookingForm] = useState({
    client_name: '',
    client_phone: '',
    professional_id: '',
    service_id: '',
    time_slot: '10:00'
  });

  const timeSlots = useMemo(
    () => generateTimeSlotsFromProfile(shopProfile, selectedDate, 30, operationSettings.slotIntervalMinutes),
    [shopProfile, selectedDate, operationSettings.slotIntervalMinutes]
  );

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('adminRefresh', handleRefresh);
    return () => window.removeEventListener('adminRefresh', handleRefresh);
  }, [selectedDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [apts, profs, srvs, blks] = await Promise.all([
        fetchAppointmentsFromSupabase(undefined, { strict: true }),
        fetchProfessionalsFromSupabase(true),
        fetchServicesFromSupabase(),
        fetchScheduleBlocks()
      ]);

      setAppointments(apts);
      const filteredProfs = profs.filter(p => p.id !== 'prof_any' && p.is_active !== false);
      setBarbers(filteredProfs);
      setServices(srvs);
      setBlocks(blks);

      if (filteredProfs.length > 0 && !blockForm.professional_id) {
        setBlockForm(prev => ({ ...prev, professional_id: filteredProfs[0].id }));
        setManualBookingForm(prev => ({ ...prev, professional_id: filteredProfs[0].id, service_id: prev.service_id || srvs[0]?.id || '' }));
      }
    } catch (err: any) {
      showNotification(err?.message || 'Não foi possível carregar a agenda.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const prof = barbers.find(b => b.id === blockForm.professional_id);
    if (!prof) {
      showNotification('Selecione um profissional ativo para bloquear o horário.', 'error');
      return;
    }
    if (timeToMinutes(blockForm.start_time) >= timeToMinutes(blockForm.end_time)) {
      showNotification('O início do bloqueio deve ser anterior ao fim.', 'error');
      return;
    }

    setSavingBlock(true);
    try {
      const updatedBlocks = await addScheduleBlock({
        professional_id: prof.id,
        date: selectedDate,
        start_time: blockForm.start_time,
        end_time: blockForm.end_time,
        reason: blockForm.reason
      });
      setBlocks(updatedBlocks);
      setIsBlockModalOpen(false);
      showNotification(`${blockForm.start_time}–${blockForm.end_time} bloqueado para ${prof.name}.`);
    } catch (err: any) {
      showNotification(err?.message || 'Não foi possível criar o bloqueio.', 'error');
    } finally {
      setSavingBlock(false);
    }
  };

  const handleUnblock = async (id: string) => {
    try {
      const updated = await deleteScheduleBlock(id);
      setBlocks(updated);
      showNotification('Bloqueio removido da agenda.');
    } catch (err: any) {
      showNotification(err?.message || 'Não foi possível remover o bloqueio.');
    }
  };

  const handleAcceptPendingAppointment = async (aptId: string) => {
    try {
      const res = await authFetch(`/api/appointments/${aptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' })
      });
      if (res.ok) {
        showNotification('Agendamento fora do expediente aprovado com sucesso!');
        await loadData();
      } else {
        const errData = await res.json().catch(() => ({}));
        showNotification(`Erro ao aprovar agendamento: ${errData.error || 'Erro desconhecido'}`);
      }
    } catch (err) {
      showNotification('Falha ao conectar com o servidor para aprovar agendamento.');
    }
  };

  const handleManualBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prof = barbers.find(b => b.id === manualBookingForm.professional_id);
    const service = services.find(s => s.id === manualBookingForm.service_id);
    if (!prof || !service || !manualBookingForm.client_name.trim()) {
      showNotification('Informe cliente, profissional, serviço e horário válidos.', 'error');
      return;
    }

    const servicePrice = Number(service.price || 0);
    const serviceDuration = Number(service.duration_minutes || 30);
    const newApt: Appointment = {
      id: `apt_m_${Date.now()}`,
      client_id: 'usr_manual',
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
      status: 'confirmed',
      payment_method: 'pay_at_venue',
      created_at: new Date().toISOString()
    };

    setSavingManualBooking(true);
    try {
      await createAppointmentInSupabase(newApt, { adminManual: true });
      await loadData();
      setIsManualBookingOpen(false);
      showNotification(`Encaixe criado para ${newApt.client_name}.`);
    } catch (err: any) {
      showNotification(err?.message || 'Não foi possível criar o encaixe.', 'error');
    } finally {
      setSavingManualBooking(false);
    }
  };

  const showNotification = (msg: string, tone: 'success' | 'error' = 'success') => {
    setNotificationTone(tone);
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const isBlockCoveringSlot = (block: ScheduleBlock, slot: string) => {
    return block.date === selectedDate
      && block.professional_id !== ''
      && timeToMinutes(block.start_time) <= timeToMinutes(slot)
      && timeToMinutes(slot) < timeToMinutes(block.end_time);
  };

  const activeBarbers = selectedBarberId === 'all'
    ? barbers
    : barbers.filter(b => b.id === selectedBarberId);

  const getAppointmentOperationalState = (apt: Appointment) => {
    const isToday = selectedDate === getTodayStringBRT();
    const status = apt.status as string;
    const startMinutes = timeToMinutes(apt.time_slot);
    const durationMinutes = Number(apt.total_duration_minutes || 30);
    const isAwaitingClient = status === 'confirmed' || status === 'in_queue';
    const isInService = status === 'in_service' || status === 'in_chair';
    const isLate = isToday && isAwaitingClient && currentBrtMinutes >= startMinutes + 10;
    const remainingMinutes = isToday && isInService
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
    if (status === 'completed') return 'Concluído';
    if (status === 'in_service' || status === 'in_chair') return 'Em atendimento';
    if (status === 'in_queue') return 'Na fila';
    return 'Confirmado';
  };

  return (
    <div className="space-y-4">
      {/* SUCCESS NOTIFICATION */}
      {successMsg && (
        <div className={`p-3 rounded-xl text-sm font-semibold flex items-center justify-between animate-fade-in ${notificationTone === 'error' ? 'bg-status-error/15 border border-status-error/30 text-status-error' : 'bg-status-success/15 border border-status-success/30 text-status-success'}`}>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-xs text-content-muted hover:text-content-base">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* MOBILE AGENDA VIEW (COMPACT, MINIMALIST, SMART) - md:hidden */}
      {/* ========================================================= */}
      <div className="md:hidden space-y-3">
        {/* Compact Top Action Bar */}
        <div className="bg-surface-card p-3 rounded-2xl border border-border-subtle flex items-center justify-between gap-2">
          {/* Quick Date Selector */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-surface-card text-gold-hover flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-surface-base border border-border-subtle text-xs font-bold text-content-base rounded-xl px-2.5 py-1.5 outline-none focus:border-gold-base max-w-[130px]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsManualBookingOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-gold-base text-content-on-accent font-bold text-xs flex items-center gap-1 shadow-sm active:scale-[0.97] transition-[transform,background-color] duration-150"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Encaixe</span>
            </button>
            <button
              onClick={() => setIsBlockModalOpen(true)}
              className="p-1.5 rounded-xl bg-surface-card text-red-400 border border-red-500/20 active:scale-[0.97] transition-[transform,background-color] duration-150"
              title="Bloquear horário"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Repositioned Barber Filter Pills */}
        <div data-gesture-scroll="horizontal" className="admin-category-scroll flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1">
          <button
            onClick={() => setSelectedBarberId('all')}
            className={`shrink-0 min-h-11 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border ${
              selectedBarberId === 'all'
                ? 'bg-gold-base text-content-on-accent border-gold-base'
                : 'bg-surface-card text-content-muted border-border-subtle hover:text-content-base'
            }`}
          >
              Todos
          </button>
          {barbers.map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBarberId(b.id)}
              className={`shrink-0 min-h-11 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 border ${
                selectedBarberId === b.id
                  ? 'bg-gold-base text-content-on-accent border-gold-base'
                  : 'bg-surface-card text-content-muted border-border-subtle hover:text-content-base'
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
          ) : timeSlots.map(slot => {
            // Find appointments or blocks in this time slot for active barbers
            const slotAppointments = activeBarbers.map(barber => {
              const apt = appointments.find(
                a => a.professional_id === barber.id &&
                     a.date === selectedDate &&
                     a.time_slot === slot &&
                     a.status !== 'cancelled' &&
                     a.status !== 'completed'
              );
              const block = blocks.find(
                b => b.professional_id === barber.id && isBlockCoveringSlot(b, slot)
              );
              return { barber, apt, block };
            }).filter(item => item.apt || item.block);

            return (
              <div key={slot} className="flex items-stretch gap-3">
                <div className="w-16 shrink-0 pt-3 text-right">
                  {/* Time Badge */}
                  <span className="text-sm font-mono num-tabular font-bold text-content-muted">{slot}</span>
                </div>

                {/* Slot Items Container */}
                <div className="flex-1 space-y-2 min-w-0 pb-1">
                    {slotAppointments.length === 0 ? (
                      <div 
                        onClick={() => {
                          setManualBookingForm(prev => ({ ...prev, time_slot: slot }));
                          setIsManualBookingOpen(true);
                        }}
                        className="min-h-[72px] px-4 rounded-2xl bg-surface-card border-2 border-dashed border-border-subtle hover:border-gold-base/50 flex items-center justify-between text-base font-semibold text-content-muted cursor-pointer group transition-colors"
                      >
                        <span>Livre</span>
                        <span className="w-10 h-10 rounded-full bg-surface-base text-content-muted group-hover:text-gold-base flex items-center justify-center transition-colors">
                          <Plus className="w-5 h-5" />
                        </span>
                      </div>
                    ) : (
                      slotAppointments.map(({ barber, apt, block }) => {
                        if (apt) {
                          const isPending = apt.status === 'pending_approval';
                          const operationalState = getAppointmentOperationalState(apt);
                          const professionalAccent = selectedBarberId === 'all' && !operationalState.isLate && !isPending
                            ? getProfessionalAccent(barber.id)
                            : undefined;
                          return (
                            <div
                              key={apt.id}
                              style={professionalAccent ? { borderLeftColor: professionalAccent } : undefined}
                              className={`p-4 rounded-2xl border border-l-4 shadow-sm transition-all ${
                                isPending
                                  ? 'bg-amber-500/10 border-amber-500/50 text-amber-200 shadow-sm'
                                  : operationalState.isLate
                                  ? 'bg-amber-500/5 border-amber-500/60'
                                  : 'bg-surface-card border-border-subtle'
                              }`}
                            >
                              {isPending && (
                                <div className="flex items-center justify-between text-xs font-bold text-amber-300 mb-1.5 uppercase tracking-wider bg-amber-500/20 px-2 py-0.5 rounded-xl border border-amber-500/30">
                                  <div className="flex items-center gap-1">
                                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span>Fora do horário</span>
                                  </div>
                                  <span className="text-xs bg-amber-400 text-black px-1.5 rounded-xl font-extrabold">Pendente</span>
                                </div>
                              )}
                              {operationalState.isLate && (
                                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold schedule-late-text uppercase tracking-wide">
                                  <AlertTriangle className="w-3.5 h-3.5 schedule-late-text shrink-0" />
                                  <span>Atrasado {operationalState.lateMinutes} min</span>
                                </div>
                              )}
                              <div className="flex justify-between items-center text-base mb-2 gap-3">
                                <span className="font-bold text-content-base truncate">{apt.client_name || (apt as any).clientName}</span>
                                <span className="font-extrabold finance-positive text-base shrink-0">R$ {apt.final_amount ? Number(apt.final_amount).toFixed(2) : '60.00'}</span>
                              </div>
                              <div className="flex justify-between items-start gap-3 text-sm text-content-muted">
                                <span className="min-w-0 leading-relaxed">{(apt.services && apt.services[0]?.title) || 'Atendimento'}</span>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  {operationalState.remainingMinutes > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-status-info bg-status-info/10 border border-status-info/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                                      <Timer className="w-3 h-3" />
                                      Faltam {operationalState.remainingMinutes} min
                                    </span>
                                  )}
                                  <span className={`px-2 py-0.5 rounded-full font-semibold text-xs ${
                                    isPending
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : apt.status === 'completed'
                                      ? 'bg-status-success/15 text-status-success'
                                      : operationalState.isInService
                                      ? 'bg-status-info/10 text-status-info border border-status-info/20'
                                      : 'bg-status-success/15 text-status-success'
                                  }`}>
                                    {isPending ? 'Aprovação' : getAppointmentStatusLabel(apt.status)}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2 pt-2 border-t border-border-subtle/70 flex items-center justify-between gap-2 text-xs">
                                <span className="font-bold uppercase tracking-wide text-content-muted">Barbeiro</span>
                                <span className="font-bold text-gold-base truncate">{barber.name}</span>
                              </div>

                              {isPending && (
                                <div className="pt-2 border-t border-amber-500/20 flex items-center justify-end gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAcceptPendingAppointment(apt.id)}
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
                            <div key={block.id} className="min-h-[72px] p-4 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-between text-sm text-red-300 shadow-sm">
                              <div className="flex items-center gap-1.5 truncate">
                                <Lock className="w-3 h-3 text-red-400 shrink-0" />
                                <span className="font-semibold truncate">{barber.name}: {block.reason}</span>
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
          })}
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
          action={{ label: 'Encaixe Manual', onClick: () => setIsManualBookingOpen(true), icon: Plus }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-surface-base border border-border-subtle text-xs text-content-base rounded-xl px-3 py-2 outline-none focus:border-gold-base"
            />

            <select
              value={selectedBarberId}
              onChange={(e) => setSelectedBarberId(e.target.value)}
              className="bg-surface-base border border-border-subtle text-xs text-content-base rounded-xl px-3 py-2 outline-none focus:border-gold-base"
            >
              <option value="all">Todos os barbeiros</option>
              {barbers.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <button
              onClick={() => setIsBlockModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-surface-card hover:bg-surface-card text-red-400 font-extrabold text-xs border border-red-500/20 flex items-center space-x-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Bloquear Horário</span>
            </button>
          </div>
        </AdminPageHeader>

        {/* Schedule Grid Table */}
        <div className="w-full overflow-x-auto rounded-2xl border border-border-subtle bg-surface-card shadow-xl">
          <div className="w-full min-w-[750px]">
            {/* Table Header: Barbers Columns */}
            <div className="grid grid-cols-12 bg-surface-base border-b border-border-subtle text-xs font-extrabold text-gold-hover">
              <div className="col-span-2 p-3 border-r border-border-subtle text-center flex items-center justify-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Horário</span>
              </div>

              <div className="col-span-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-x divide-border-subtle">
                {activeBarbers.map(barber => (
                  <div key={barber.id} className="p-3 flex items-center justify-center space-x-2">
                    <img src={barber.photo_url} alt={barber.name} className="w-6 h-6 rounded-full object-cover border border-gold-base" />
                    <span className="text-content-base font-bold">{barber.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Time Slots Rows */}
            <div className="divide-y divide-border-subtle">
              {timeSlots.map(slot => {
                return (
                  <div key={slot} className="grid grid-cols-12 hover:bg-surface-card transition-colors">
                    {/* Time Label */}
                    <div className="col-span-2 p-3 border-r border-border-subtle text-center text-xs font-bold text-gold-hover flex items-center justify-center">
                      {slot}
                    </div>

                    {/* Barbers Cells */}
                    <div className="col-span-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-x divide-border-subtle">
                      {activeBarbers.map(barber => {
                        const apt = appointments.find(
                          a => a.professional_id === barber.id &&
                               a.date === selectedDate &&
                               a.time_slot === slot &&
                               a.status !== 'cancelled' &&
                               a.status !== 'completed'
                        );
                        const operationalState = apt ? getAppointmentOperationalState(apt) : null;
                        const professionalAccent = selectedBarberId === 'all' && !operationalState?.isLate
                          ? getProfessionalAccent(barber.id)
                          : undefined;

                        const block = blocks.find(
                          b => b.professional_id === barber.id && isBlockCoveringSlot(b, slot)
                        );

                        return (
                          <div key={barber.id} className="p-2 min-h-[52px] flex items-center">
                            {apt ? (
                              <div
                                style={professionalAccent ? { borderLeftColor: professionalAccent } : undefined}
                                className={`w-full border border-l-4 p-2 rounded-r-xl space-y-1 ${
                                  operationalState?.isLate
                                    ? 'bg-amber-500/5 border-amber-500/60'
                                    : 'bg-surface-base border-border-subtle'
                                }`}
                              >
                                <div className="flex items-center justify-between text-xs font-bold text-content-base gap-2">
                                  <span className="truncate">{apt.client_name}</span>
                                  <span className="text-xs finance-positive shrink-0">R$ {apt.final_amount.toFixed(2)}</span>
                                </div>
                                <div className="text-xs text-content-muted flex items-center justify-between gap-2">
                                  <span className="truncate">{apt.services[0]?.title || 'Atendimento'}</span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {operationalState?.remainingMinutes && operationalState.remainingMinutes > 0 ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-bold text-status-info">
                                        <Timer className="w-3 h-3" /> {operationalState.remainingMinutes} min
                                      </span>
                                    ) : null}
                                    <span className={`px-1.5 py-0.5 rounded-xl text-xs font-bold ${
                                      operationalState?.isInService
                                        ? 'bg-status-info/10 text-status-info border border-status-info/20'
                                        : 'bg-status-success/20 text-status-success'
                                    }`}>
                                      {getAppointmentStatusLabel(apt.status)}
                                    </span>
                                  </div>
                                </div>
                                {operationalState?.isLate && (
                                  <div className="inline-flex items-center gap-1 text-xs font-bold schedule-late-text">
                                    <AlertTriangle className="w-3 h-3 schedule-late-text" />
                                    Atrasado {operationalState.lateMinutes} min
                                  </div>
                                )}
                              </div>
                            ) : block ? (
                              <div className="w-full bg-red-950/30 border border-red-500/30 p-2 rounded-xl flex items-center justify-between text-xs text-red-300">
                                <div className="flex items-center space-x-1.5">
                                  <Lock className="w-3.5 h-3.5 text-red-400" />
                                  <span className="font-semibold text-xs">{block.reason}</span>
                                </div>
                                <button
                                  onClick={() => handleUnblock(block.id)}
                                  className="text-red-400 hover:text-content-base text-xs underline ml-2"
                                  title="Desbloquear horário"
                                >
                                  Desbloquear
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-content-muted italic">Disponível</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Bloquear Horário */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-base/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="admin-modal bg-surface-card border border-red-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-4 bg-surface-card border-b border-border-subtle flex justify-between items-center">
              <h2 className="text-sm font-serif text-content-base font-semibold flex items-center space-x-2">
                <Lock className="w-4 h-4 text-red-400" />
                <span>Bloquear horário</span>
              </h2>
              <button onClick={() => setIsBlockModalOpen(false)} className="text-content-muted hover:text-content-base">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onKeyDown={handleEnterAsTab} onSubmit={handleAddBlock} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-gold-base block mb-1">Barbeiro *</label>
                <select
                  value={blockForm.professional_id}
                  onChange={(e) => setBlockForm({ ...blockForm, professional_id: e.target.value })}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base outline-none focus:border-red-400"
                >
                  {barbers.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gold-base block mb-1">Início *</label>
                  <select
                    value={blockForm.start_time}
                    onChange={(e) => setBlockForm({ ...blockForm, start_time: e.target.value, end_time: timeToMinutes(e.target.value) >= timeToMinutes(blockForm.end_time) ? timeSlots.find(ts => timeToMinutes(ts) > timeToMinutes(e.target.value)) || blockForm.end_time : blockForm.end_time })}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base outline-none focus:border-red-400"
                  >
                    {timeSlots.map(ts => <option key={ts} value={ts}>{ts}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gold-base block mb-1">Fim *</label>
                  <select
                    value={blockForm.end_time}
                    onChange={(e) => setBlockForm({ ...blockForm, end_time: e.target.value })}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base outline-none focus:border-red-400"
                  >
                    {timeSlots.filter(ts => timeToMinutes(ts) > timeToMinutes(blockForm.start_time)).map(ts => <option key={ts} value={ts}>{ts}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gold-base block mb-1">Motivo do Bloqueio *</label>
                <input
                  type="text"
                  value={blockForm.reason}
                  onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                  placeholder="Ex: Almoço, Intervalo, Consulta Médica"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base outline-none focus:border-red-400"
                  required
                />
              </div>

              <div className="pt-3 border-t border-border-subtle flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsBlockModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-card text-content-base text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingBlock}
                  className="px-5 py-2 rounded-xl bg-red-600 text-white text-xs font-extrabold shadow-md hover:bg-red-700 disabled:opacity-60 disabled:cursor-wait"
                >
                  {savingBlock ? 'Salvando...' : 'Confirmar Bloqueio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Encaixe Manual Presencial */}
      {isManualBookingOpen && (
        <div className="fixed inset-0 z-50 bg-surface-base/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="admin-modal bg-surface-card border border-gold-base/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-4 bg-surface-card border-b border-border-subtle flex justify-between items-center">
              <h2 className="text-sm font-serif text-content-base font-semibold flex items-center space-x-2">
                <Scissors className="w-4 h-4 text-gold-base" />
                <span>Encaixe presencial</span>
              </h2>
              <button onClick={() => setIsManualBookingOpen(false)} className="text-content-muted hover:text-content-base">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onKeyDown={handleEnterAsTab} onSubmit={handleManualBookingSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-gold-base block mb-1">Nome do Cliente *</label>
                <input
                  type="text"
                  value={manualBookingForm.client_name}
                  onChange={(e) => setManualBookingForm({ ...manualBookingForm, client_name: e.target.value })}
                  placeholder="Ex: Gabriel Santos"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base outline-none focus:border-gold-base"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gold-base block mb-1">Telefone WhatsApp</label>
                  <input
                    type="text"
                    value={manualBookingForm.client_phone}
                    onChange={(e) => setManualBookingForm({ ...manualBookingForm, client_phone: e.target.value })}
                    placeholder="(11) 98765-4321"
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base outline-none focus:border-gold-base"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gold-base block mb-1">Barbeiro *</label>
                  <select
                    value={manualBookingForm.professional_id}
                    onChange={(e) => setManualBookingForm({ ...manualBookingForm, professional_id: e.target.value })}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base outline-none focus:border-gold-base"
                  >
                    {barbers.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gold-base block mb-1">Serviço real *</label>
                  <select
                    value={manualBookingForm.service_id}
                    onChange={(e) => setManualBookingForm({ ...manualBookingForm, service_id: e.target.value })}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base outline-none focus:border-gold-base"
                    required
                  >
                    <option value="">Selecione</option>
                    {services.map(service => <option key={service.id} value={service.id}>{service.title} — R$ {Number(service.price || 0).toFixed(2)}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gold-base block mb-1">Horário *</label>
                  <select
                    value={manualBookingForm.time_slot}
                    onChange={(e) => setManualBookingForm({ ...manualBookingForm, time_slot: e.target.value })}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base outline-none focus:border-gold-base"
                    required
                  >
                    {timeSlots.map(ts => <option key={ts} value={ts}>{ts}</option>)}
                  </select>
                </div>
              </div>

              {manualBookingForm.service_id && (() => {
                const selectedService = services.find(service => service.id === manualBookingForm.service_id);
                return selectedService ? <p className="text-xs text-content-muted">Duração real: <strong className="text-gold-base">{selectedService.duration_minutes} min</strong>. O valor será recalculado pelo servidor.</p> : null;
              })()}

              <div className="pt-3 border-t border-border-subtle flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsManualBookingOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-card text-content-base text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingManualBooking}
                  className="px-5 py-2 rounded-xl bg-gold-base text-content-on-accent text-xs font-extrabold shadow-md disabled:opacity-60 disabled:cursor-wait"
                >
                  {savingManualBooking ? 'Salvando...' : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
