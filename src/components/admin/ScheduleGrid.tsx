import React, { useState, useEffect, useMemo } from 'react';
import { Appointment, Professional } from '../../types';
import {
  fetchAppointmentsFromSupabase,
  fetchProfessionalsFromSupabase,
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
import { Calendar, Clock, Plus, Lock, Unlock, UserCheck, ShieldAlert, CheckCircle2, X, Save, RefreshCw, Scissors } from 'lucide-react';

export const ScheduleGrid: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedBarberId, setSelectedBarberId] = useState<string>('all');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Professional[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopProfile, setShopProfile] = useState<ShopProfile>(defaultShopProfile);

  useEffect(() => {
    fetchShopProfile().then(p => {
      if (p) setShopProfile(p);
    });
  }, []);

  // Modals
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isManualBookingOpen, setIsManualBookingOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Block Form State
  const [blockForm, setBlockForm] = useState({
    professional_id: '',
    time_slot: '12:00',
    reason: 'Pausa para Almoço / Lanche'
  });

  // Manual Booking State
  const [manualBookingForm, setManualBookingForm] = useState({
    client_name: '',
    client_phone: '(11) 9',
    professional_id: '',
    service_title: 'Corte Moderno / Fade',
    amount: 60,
    time_slot: '10:00'
  });

  const timeSlots = useMemo(() => {
    const slots = generateTimeSlotsFromProfile(shopProfile, selectedDate);
    if (slots.length > 0) return slots;
    return [
      '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
      '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
      '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
      '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
    ];
  }, [shopProfile, selectedDate]);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    setLoading(true);
    const [apts, profs, blks] = await Promise.all([
      fetchAppointmentsFromSupabase(),
      fetchProfessionalsFromSupabase(),
      fetchScheduleBlocks()
    ]);

    setAppointments(apts);
    const filteredProfs = profs.filter(p => p.id !== 'prof_any');
    setBarbers(filteredProfs);
    setBlocks(blks);

    if (filteredProfs.length > 0 && !blockForm.professional_id) {
      setBlockForm(prev => ({ ...prev, professional_id: filteredProfs[0].id }));
      setManualBookingForm(prev => ({ ...prev, professional_id: filteredProfs[0].id }));
    }

    setLoading(false);
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const prof = barbers.find(b => b.id === blockForm.professional_id);
    if (!prof) return;

    const updatedBlocks = await addScheduleBlock({
      professional_id: prof.id,
      
      date: selectedDate,
      start_time: blockForm.time_slot,
      end_time: blockForm.time_slot,
      reason: blockForm.reason
    });

    setBlocks(updatedBlocks);
    setIsBlockModalOpen(false);
    showNotification(`Horário das ${blockForm.time_slot} bloqueado com sucesso para ${prof.name}!`);
  };

  const handleUnblock = async (id: string) => {
    const updated = await deleteScheduleBlock(id);
    setBlocks(updated);
    showNotification('Bloqueio removido da agenda!');
  };

  const handleAcceptPendingAppointment = async (aptId: string) => {
    try {
      const res = await fetch(`/api/appointments/${aptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' })
      });
      if (res.ok) {
        showNotification('Agendamento fora do expediente aprovado com sucesso!');
        await loadData();
      } else {
        const errData = await res.json();
        showNotification(`Erro ao aprovar agendamento: ${errData.error || 'Erro desconhecido'}`);
      }
    } catch (err) {
      showNotification('Falha ao conectar com o servidor para aprovar agendamento.');
    }
  };

  const handleManualBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prof = barbers.find(b => b.id === manualBookingForm.professional_id);
    if (!prof || !manualBookingForm.client_name) return;

    const newApt: Appointment = {
      id: `apt_m_${Date.now()}`,
      client_id: 'usr_manual',
      client_name: manualBookingForm.client_name,
      client_phone: manualBookingForm.client_phone,
      professional_id: prof.id,
      professional_name: prof.name,
      services: [
        {
          id: 'srv_manual',
          category_id: 'cat_cortes',
          title: manualBookingForm.service_title,
          description: 'Agendamento direto na recepção',
          price: Number(manualBookingForm.amount),
          duration_minutes: 35
        }
      ],
      total_duration_minutes: 35,
      original_amount: Number(manualBookingForm.amount),
      discount_amount: 0,
      final_amount: Number(manualBookingForm.amount),
      loyalty_points_used: 0,
      date: selectedDate,
      time_slot: manualBookingForm.time_slot,
      status: 'confirmed',
      payment_method: 'pay_at_venue',
      created_at: new Date().toISOString()
    };

    await createAppointmentInSupabase(newApt);
    await loadData();
    setIsManualBookingOpen(false);
    showNotification(`Agendamento presencial criado para ${manualBookingForm.client_name}!`);
  };

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const activeBarbers = selectedBarberId === 'all'
    ? barbers
    : barbers.filter(b => b.id === selectedBarberId);

  return (
    <div className="space-y-4">
      {/* SUCCESS NOTIFICATION */}
      {successMsg && (
        <div className="p-3 bg-status-success/15 border border-status-success/30 text-status-success rounded-xl text-xs font-bold flex items-center justify-between animate-fade-in">
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
              className="bg-surface-base border border-border-subtle text-xs font-bold text-content-base rounded-xl px-2.5 py-1.5 outline-none focus:border-[#FFFFFF] max-w-[130px]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsManualBookingOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-gold-base text-surface-base font-bold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-transform"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Encaixe</span>
            </button>
            <button
              onClick={() => setIsBlockModalOpen(true)}
              className="p-1.5 rounded-xl bg-surface-card text-red-400 border border-red-500/20 active:scale-95 transition-transform"
              title="Bloquear Horário"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Repositioned Barber Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedBarberId('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
              selectedBarberId === 'all'
                ? 'bg-gold-base text-surface-base border-[#FFFFFF]'
                : 'bg-surface-card text-content-muted border-border-subtle hover:text-content-base'
            }`}
          >
            💈 Todos
          </button>
          {barbers.map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBarberId(b.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                selectedBarberId === b.id
                  ? 'bg-gold-base text-surface-base border-[#FFFFFF]'
                  : 'bg-surface-card text-content-muted border-border-subtle hover:text-content-base'
              }`}
            >
              <span>{b.name}</span>
            </button>
          ))}
        </div>

        {/* Compact Timeline Feed */}
        <div className="bg-surface-card rounded-2xl border border-border-subtle p-3 space-y-2">
          {timeSlots.map(slot => {
            // Find appointments or blocks in this time slot for active barbers
            const slotAppointments = activeBarbers.map(barber => {
              const apt = appointments.find(
                a => a.professional_id === barber.id &&
                     a.date === selectedDate &&
                     a.time_slot === slot &&
                     a.status !== 'cancelled'
              );
              const block = blocks.find(
                b => b.professional_id === barber.id &&
                     b.date === selectedDate &&
                     b.time_slot === slot
              );
              return { barber, apt, block };
            }).filter(item => item.apt || item.block);

            return (
              <div key={slot} className="border-b border-border-subtle/60 pb-2 last:border-0 last:pb-0">
                <div className="flex items-start gap-2.5">
                  {/* Time Badge */}
                  <div className="text-[11px] font-serif text-content-base font-semibold bg-surface-base px-2 py-1 rounded-lg border border-border-subtle shrink-0 mt-0.5">
                    {slot}
                  </div>

                  {/* Slot Items Container */}
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {slotAppointments.length === 0 ? (
                      <div 
                        onClick={() => {
                          setManualBookingForm(prev => ({ ...prev, time_slot: slot }));
                          setIsManualBookingOpen(true);
                        }}
                        className="py-1 px-2.5 rounded-xl bg-surface-base/50 border border-dashed border-border-subtle hover:border-border-subtle flex items-center justify-between text-[11px] text-[#555555] cursor-pointer group"
                      >
                        <span>Livre</span>
                        <Plus className="w-3 h-3 text-[#444444] group-hover:text-gold-hover" />
                      </div>
                    ) : (
                      slotAppointments.map(({ barber, apt, block }) => {
                        if (apt) {
                          const isPending = apt.status === 'pending_approval';
                          return (
                            <div key={apt.id} className={`p-2.5 rounded-xl transition-all ${
                              isPending
                                ? 'bg-amber-500/10 border-2 border-amber-500/50 text-amber-200 shadow-sm'
                                : 'bg-surface-base border-l-2 border-l-[#FFFFFF] border border-border-subtle'
                            }`}>
                              {isPending && (
                                <div className="flex items-center justify-between text-[10px] font-bold text-amber-300 mb-1.5 uppercase tracking-wider bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">
                                  <div className="flex items-center gap-1">
                                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span>Fora do Expediente</span>
                                  </div>
                                  <span className="text-[9px] bg-amber-400 text-black px-1.5 rounded font-extrabold">Aprovação Pendente</span>
                                </div>
                              )}
                              <div className="flex justify-between items-center text-xs mb-1">
                                <span className="font-bold text-content-base truncate">{apt.client_name || (apt as any).clientName}</span>
                                <span className="font-bold text-gold-hover text-[11px] shrink-0">R$ {apt.final_amount ? Number(apt.final_amount).toFixed(2) : '60.00'}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-content-muted">
                                <span className="truncate">{(apt.services && apt.services[0]?.title) || 'Atendimento'} • <strong className="text-[#A67B5B]">{barber.name}</strong></span>
                                <span className={`px-2 py-0.5 rounded-full font-semibold text-[9px] shrink-0 ${
                                  isPending
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                                    : apt.status === 'completed'
                                    ? 'bg-status-success/15 text-status-success'
                                    : 'bg-status-success/15 text-status-success'
                                }`}>
                                  {isPending ? 'Requer Aprovação' : apt.status === 'completed' ? 'Concluído' : 'Confirmado'}
                                </span>
                              </div>

                              {isPending && (
                                <div className="pt-2 border-t border-amber-500/20 flex items-center justify-end gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAcceptPendingAppointment(apt.id)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm transition-all active:scale-95"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>ACEITAR AGENDAMENTO</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        }

                        if (block) {
                          return (
                            <div key={block.id} className="p-2 rounded-xl bg-red-950/20 border border-red-500/20 flex items-center justify-between text-xs text-red-300">
                              <div className="flex items-center gap-1.5 truncate">
                                <Lock className="w-3 h-3 text-red-400 shrink-0" />
                                <span className="text-[10px] font-semibold truncate">{barber.name}: {block.reason}</span>
                              </div>
                              <button
                                onClick={() => handleUnblock(block.id)}
                                className="text-[9px] text-red-400 underline font-bold shrink-0 ml-1"
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-card p-5 rounded-2xl border border-border-subtle">
          <div>
            <div className="flex items-center space-x-2 text-gold-hover text-xs font-bold uppercase tracking-widest mb-1">
              <Calendar className="w-4 h-4" />
              <span>Grade da Agenda & Bloqueios</span>
            </div>
            <h1 className="text-xl font-serif text-content-base font-semibold">Agenda Interativa por Barbeiro</h1>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-surface-base border border-border-subtle text-xs text-content-base rounded-xl px-3 py-2 outline-none focus:border-[#FFFFFF]"
            />

            <select
              value={selectedBarberId}
              onChange={(e) => setSelectedBarberId(e.target.value)}
              className="bg-surface-base border border-border-subtle text-xs text-content-base rounded-xl px-3 py-2 outline-none focus:border-[#FFFFFF]"
            >
              <option value="all">💈 Todos os Barbeiros</option>
              {barbers.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <button
              onClick={() => setIsManualBookingOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gold-base text-surface-base font-extrabold text-xs shadow-md flex items-center space-x-1.5 hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              <span>Encaixe Manual</span>
            </button>

            <button
              onClick={() => setIsBlockModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-surface-card hover:bg-surface-card text-red-400 font-extrabold text-xs border border-red-500/20 flex items-center space-x-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Bloquear Horário</span>
            </button>
          </div>
        </div>

        {/* Schedule Grid Table */}
        <div className="w-full overflow-x-auto rounded-2xl border border-border-subtle bg-surface-card shadow-xl">
          <div className="w-full min-w-[750px]">
            {/* Table Header: Barbers Columns */}
            <div className="grid grid-cols-12 bg-surface-base border-b border-border-subtle text-xs font-extrabold text-gold-hover">
              <div className="col-span-2 p-3 border-r border-border-subtle text-center flex items-center justify-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Horário</span>
              </div>

              <div className="col-span-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-x divide-[#2A2A2A]">
                {activeBarbers.map(barber => (
                  <div key={barber.id} className="p-3 flex items-center justify-center space-x-2">
                    <img src={barber.photo_url} alt={barber.name} className="w-6 h-6 rounded-full object-cover border border-[#FFFFFF]" />
                    <span className="text-content-base font-bold">{barber.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Time Slots Rows */}
            <div className="divide-y divide-[#2A2A2A]">
              {timeSlots.map(slot => {
                return (
                  <div key={slot} className="grid grid-cols-12 hover:bg-[#1C1C1C] transition-colors">
                    {/* Time Label */}
                    <div className="col-span-2 p-3 border-r border-border-subtle text-center text-xs font-bold text-gold-hover flex items-center justify-center">
                      {slot}
                    </div>

                    {/* Barbers Cells */}
                    <div className="col-span-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-x divide-[#2A2A2A]">
                      {activeBarbers.map(barber => {
                        const apt = appointments.find(
                          a => a.professional_id === barber.id &&
                               a.date === selectedDate &&
                               a.time_slot === slot &&
                               a.status !== 'cancelled'
                        );

                        const block = blocks.find(
                          b => b.professional_id === barber.id &&
                               b.date === selectedDate &&
                               b.time_slot === slot
                        );

                        return (
                          <div key={barber.id} className="p-2 min-h-[52px] flex items-center">
                            {apt ? (
                              <div className="w-full bg-surface-base border-l-4 border-l-[#FFFFFF] p-2 rounded-r-xl space-y-0.5">
                                <div className="flex items-center justify-between text-xs font-bold text-content-base">
                                  <span>{apt.client_name}</span>
                                  <span className="text-[10px] text-gold-hover">R$ {apt.final_amount.toFixed(2)}</span>
                                </div>
                                <div className="text-[10px] text-content-muted flex items-center justify-between">
                                  <span>{apt.services[0]?.title || 'Atendimento'}</span>
                                  <span className="px-1.5 py-0.5 rounded bg-status-success/20 text-status-success text-[9px] font-bold">
                                    {apt.status === 'completed' ? 'Concluído' : 'Confirmado'}
                                  </span>
                                </div>
                              </div>
                            ) : block ? (
                              <div className="w-full bg-red-950/30 border border-red-500/30 p-2 rounded-xl flex items-center justify-between text-xs text-red-300">
                                <div className="flex items-center space-x-1.5">
                                  <Lock className="w-3.5 h-3.5 text-red-400" />
                                  <span className="font-semibold text-[11px]">{block.reason}</span>
                                </div>
                                <button
                                  onClick={() => handleUnblock(block.id)}
                                  className="text-red-400 hover:text-content-base text-[10px] underline ml-2"
                                  title="Desbloquear Horário"
                                >
                                  Desbloquear
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[#444444] italic">Disponível</span>
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
          <div className="bg-surface-card border border-red-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-4 bg-surface-card border-b border-border-subtle flex justify-between items-center">
              <h2 className="text-sm font-serif text-content-base font-semibold flex items-center space-x-2">
                <Lock className="w-4 h-4 text-red-400" />
                <span>Bloquear Horário na Agenda</span>
              </h2>
              <button onClick={() => setIsBlockModalOpen(false)} className="text-content-muted hover:text-content-base">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBlock} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#E6D4B5] block mb-1">Barbeiro *</label>
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

              <div>
                <label className="text-xs font-bold text-[#E6D4B5] block mb-1">Horário a Bloquear *</label>
                <select
                  value={blockForm.time_slot}
                  onChange={(e) => setBlockForm({ ...blockForm, time_slot: e.target.value })}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base outline-none focus:border-red-400"
                >
                  {timeSlots.map(ts => (
                    <option key={ts} value={ts}>{ts}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#E6D4B5] block mb-1">Motivo do Bloqueio *</label>
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
                  className="px-5 py-2 rounded-xl bg-red-600 text-content-base text-xs font-extrabold shadow-md hover:bg-red-700"
                >
                  Confirmar Bloqueio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Encaixe Manual Presencial */}
      {isManualBookingOpen && (
        <div className="fixed inset-0 z-50 bg-surface-base/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-gold-base/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-4 bg-surface-card border-b border-border-subtle flex justify-between items-center">
              <h2 className="text-sm font-serif text-content-base font-semibold flex items-center space-x-2">
                <Scissors className="w-4 h-4 text-gold-base" />
                <span>Agendamento Presencial / Encaixe de Caixa</span>
              </h2>
              <button onClick={() => setIsManualBookingOpen(false)} className="text-content-muted hover:text-content-base">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualBookingSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#E6D4B5] block mb-1">Nome do Cliente *</label>
                <input
                  type="text"
                  value={manualBookingForm.client_name}
                  onChange={(e) => setManualBookingForm({ ...manualBookingForm, client_name: e.target.value })}
                  placeholder="Ex: Gabriel Santos"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base outline-none focus:border-gold-base"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#E6D4B5] block mb-1">Telefone WhatsApp</label>
                  <input
                    type="text"
                    value={manualBookingForm.client_phone}
                    onChange={(e) => setManualBookingForm({ ...manualBookingForm, client_phone: e.target.value })}
                    placeholder="(11) 98765-4321"
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base outline-none focus:border-gold-base"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#E6D4B5] block mb-1">Barbeiro *</label>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#E6D4B5] block mb-1">Serviço</label>
                  <input
                    type="text"
                    value={manualBookingForm.service_title}
                    onChange={(e) => setManualBookingForm({ ...manualBookingForm, service_title: e.target.value })}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base outline-none focus:border-gold-base"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#E6D4B5] block mb-1">Horário *</label>
                  <select
                    value={manualBookingForm.time_slot}
                    onChange={(e) => setManualBookingForm({ ...manualBookingForm, time_slot: e.target.value })}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base outline-none focus:border-gold-base"
                  >
                    {timeSlots.map(ts => (
                      <option key={ts} value={ts}>{ts}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#E6D4B5] block mb-1">Valor Cobrado (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={manualBookingForm.amount}
                  onChange={(e) => setManualBookingForm({ ...manualBookingForm, amount: Number(e.target.value) })}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base outline-none focus:border-gold-base"
                  required
                />
              </div>

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
                  className="px-5 py-2 rounded-xl bg-gold-base text-surface-base text-xs font-extrabold shadow-md"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
