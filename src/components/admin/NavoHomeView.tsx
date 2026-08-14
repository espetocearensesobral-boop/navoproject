import React, { useState, useEffect } from 'react';
import { fetchAppointmentsFromSupabase } from '../../services/supabaseDataService';
import { Appointment } from '../../types';
import { RefreshCw, ArrowRight, Clock, Receipt, Scissors, Users, CalendarCheck2 } from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';

interface NavoHomeViewProps {
  onNavigateToAgenda: () => void;
}

export const NavoHomeView: React.FC<NavoHomeViewProps> = ({ onNavigateToAgenda }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('adminRefresh', handleRefresh);
    return () => window.removeEventListener('adminRefresh', handleRefresh);
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchAppointmentsFromSupabase();
    setAppointments(data);
    setLoading(false);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter(a => a.date === todayStr);
  const activeToday = todayAppointments.filter(a => a.status !== 'cancelled');
  
  const totalRevenueToday = activeToday.reduce((sum, a) => sum + (a.final_amount || 0), 0);
  const inServiceToday = activeToday.filter(a => a.status === 'in_service' || a.status === 'in_chair').length;
  const pendingToday = activeToday.filter(a => a.status === 'confirmed').length;

  const totalCompletedAppointments = appointments.filter(a => a.status === 'completed');
  const ticketMedio = totalCompletedAppointments.length > 0 
    ? totalCompletedAppointments.reduce((sum, a) => sum + (a.final_amount || 0), 0) / totalCompletedAppointments.length 
    : (activeToday.length > 0 ? totalRevenueToday / activeToday.length : 0);

  const uniqueClients = new Set(appointments.map(a => a.client_id || a.client_phone || a.client_name)).size;

  const todayFormatted = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_service':
      case 'in_chair':
        return (
          <span className="text-[10px] font-bold text-status-success bg-status-success/10 border border-status-success/30 px-2 py-0.5 rounded-xl whitespace-nowrap inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
            Na Cadeira
          </span>
        );
      case 'pending_approval':
        return (
          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-xl whitespace-nowrap inline-flex items-center gap-1 animate-pulse">
            ⚠️ Fora do Expediente
          </span>
        );
      case 'completed':
        return (
          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-xl whitespace-nowrap">
            Finalizado
          </span>
        );
      case 'cancelled':
        return (
          <span className="text-[10px] font-bold text-status-error bg-status-error/10 border border-status-error/30 px-2 py-0.5 rounded-xl whitespace-nowrap">
            Cancelado
          </span>
        );
      case 'confirmed':
      default:
        return (
          <span className="text-[10px] font-bold text-gold-base bg-gold-base/10 border border-gold-base/30 px-2 py-0.5 rounded-xl whitespace-nowrap">
            Confirmado
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 animate-fade-in text-content-base min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={Receipt}
        title="Caixa de Hoje & Operação"
        stats={[{ label: todayFormatted, value: '', tone: 'gold' }]}
        
      />

      {/* Ação (mobile) */}
      

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-gold-base mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Faturamento</span>
            <div className="w-6 h-6 rounded-lg bg-gold-base/10 flex items-center justify-center shrink-0">
              <Receipt className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black finance-positive tabular-nums truncate">R$ {totalRevenueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">{activeToday.length} cortes hoje</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Ticket Médio</span>
            <div className="w-6 h-6 rounded-lg bg-surface-base border border-border-subtle text-gold-base flex items-center justify-center shrink-0">
              <CalendarCheck2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black finance-positive tabular-nums truncate">R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[9px] text-status-success mt-1 font-medium truncate">{inServiceToday} ativos agora</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Clientes Cadastrados</span>
            <div className="w-6 h-6 rounded-lg bg-surface-base border border-border-subtle text-gold-base flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-content-base tabular-nums truncate">{uniqueClients}</p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">{pendingToday} aguardando</p>
        </div>
      </div>

      {/* TODAY'S SCHEDULE / QUEUE FLOW */}
      <div className="bg-surface-card rounded-xl border border-border-subtle overflow-hidden min-w-0">
        {/* Card Header (Fixed 48px height zone) */}
        <div className="h-12 px-4 border-b border-border-subtle flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-serif font-bold text-content-base tracking-tight truncate">
              Fluxo de Atendimentos ({todayAppointments.length})
            </h3>
          </div>

          {/* Action Zone: Card Header Right Button (Mobile text-to-icon, >=40px touch) */}
          <button 
            onClick={onNavigateToAgenda}
            className="h-9 sm:h-8 px-0 sm:px-3 w-9 sm:w-auto rounded-xl bg-gold-base/10 hover:bg-gold-base text-gold-base hover:text-surface-base border border-gold-base/30 transition-all text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95"
            aria-label="Ver na Agenda"
          >
            <Scissors className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Ver na Agenda</span>
          </button>
        </div>

        {/* MOBILE CARD LIST (< md) / DESKTOP TABLE (>= md) */}
        {/* Mobile View */}
        <div className="block md:hidden divide-y divide-border-subtle">
          {todayAppointments.length === 0 ? (
            <div className="py-10 px-4 text-center text-content-muted">
              <Clock className="w-6 h-6 text-content-muted mx-auto mb-2 opacity-50" />
              <p className="text-xs font-medium">Nenhum agendamento hoje.</p>
              <button
                onClick={onNavigateToAgenda}
                className="mt-2 text-xs font-bold text-gold-base active:underline"
              >
                Abrir agenda completa
              </button>
            </div>
          ) : (
            todayAppointments.map(apt => {
              const serviceName = Array.isArray(apt.services) && apt.services.length > 0
                ? (typeof apt.services[0] === 'string' ? apt.services[0] : apt.services[0].title)
                : 'Atendimento de Barbearia';

              return (
                <div key={apt.id} className="p-3.5 space-y-2.5 active:bg-surface-base/50 transition-colors">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-surface-base border border-border-subtle text-gold-base font-serif font-bold text-xs flex items-center justify-center shrink-0">
                        {apt.client_name ? apt.client_name.charAt(0).toUpperCase() : 'C'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-content-base truncate">{apt.client_name || 'Cliente'}</div>
                        <div className="text-[11px] text-content-muted truncate">{serviceName}</div>
                      </div>
                    </div>
                    {getStatusBadge(apt.status)}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border-subtle/50">
                    <div className="flex items-center gap-3 text-content-muted">
                      <span className="num-tabular font-bold text-content-base whitespace-nowrap">{apt.time_slot || '--:--'}</span>
                      <span>•</span>
                      <span className="text-gold-base font-bold truncate max-w-[120px]">{apt.professional_name || 'Barbeiro'}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold finance-positive num-tabular whitespace-nowrap">
                        R$ {apt.final_amount ? apt.final_amount.toFixed(2) : '0.00'}
                      </span>
                      <button
                        onClick={onNavigateToAgenda}
                        className="h-8 w-8 flex items-center justify-center rounded-xl bg-surface-base text-content-muted active:text-gold-base border border-border-subtle shrink-0"
                        aria-label="Ver agendamento"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View Table (>= md) */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-base/50 h-9 text-[10px] font-bold uppercase tracking-wider text-content-muted">
                <th className="px-4 py-2 font-bold min-w-[180px]">Cliente</th>
                <th className="px-4 py-2 font-bold min-w-[180px]">Serviço & Barbeiro</th>
                <th className="px-4 py-2 font-bold text-right min-w-[100px]">Horário</th>
                <th className="px-4 py-2 font-bold text-right min-w-[110px]">Valor</th>
                <th className="px-4 py-2 font-bold text-center min-w-[120px]">Status</th>
                <th className="px-4 py-2 font-bold text-right min-w-[80px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {todayAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-content-muted">
                    <Clock className="w-6 h-6 text-content-muted mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-medium">Nenhum agendamento registrado para hoje.</p>
                    <button
                      onClick={onNavigateToAgenda}
                      className="mt-2 text-xs font-bold text-gold-base hover:underline"
                    >
                      Abrir agenda para agendar cliente
                    </button>
                  </td>
                </tr>
              ) : (
                todayAppointments.map(apt => {
                  const serviceName = Array.isArray(apt.services) && apt.services.length > 0
                    ? (typeof apt.services[0] === 'string' ? apt.services[0] : apt.services[0].title)
                    : 'Atendimento de Barbearia';

                  return (
                    <tr key={apt.id} className="h-12 hover:bg-surface-base/40 transition-colors">
                      {/* Cliente */}
                      <td className="px-4 py-2 min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-xl bg-surface-base border border-border-subtle text-gold-base font-serif font-bold text-xs flex items-center justify-center shrink-0">
                            {apt.client_name ? apt.client_name.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <span className="font-bold text-content-base truncate">{apt.client_name || 'Cliente'}</span>
                        </div>
                      </td>

                      {/* Serviço & Barbeiro */}
                      <td className="px-4 py-2 min-w-0">
                        <div className="truncate text-content-muted">
                          <span className="text-content-base font-medium">{serviceName}</span>
                          <span className="mx-1">•</span>
                          <span className="text-gold-base font-bold">{apt.professional_name || 'Barbeiro'}</span>
                        </div>
                      </td>

                      {/* Horário */}
                      <td className="px-4 py-2 text-right num-tabular whitespace-nowrap font-bold text-content-base">
                        {apt.time_slot || '--:--'}
                      </td>

                      {/* Valor */}
                      <td className="px-4 py-2 text-right num-tabular whitespace-nowrap font-bold finance-positive">
                        R$ {apt.final_amount ? apt.final_amount.toFixed(2) : '0.00'}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2 text-center">
                        {getStatusBadge(apt.status)}
                      </td>

                      {/* Action Zone: End of Table Row */}
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={onNavigateToAgenda}
                          className="h-8 px-2.5 rounded-xl bg-surface-base hover:bg-surface-card text-content-muted hover:text-gold-base border border-border-subtle transition-all text-[11px] font-bold whitespace-nowrap inline-flex items-center gap-1 active:scale-95"
                        >
                          <span>Ver</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
