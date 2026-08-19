import React, { useState, useEffect } from 'react';
import { fetchAppointmentsFromSupabase, fetchOperationalReportFromSupabase, type OperationalReportData } from '../../services/supabaseDataService';
import { getTodayStringBRT } from '../../utils/dateUtils';
import { Appointment } from '../../types';
import { Receipt, Scissors, Users, CalendarCheck2 } from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { AdminAppointmentFeed } from './shared/AdminAppointmentFeed';
import { AdminSkeleton } from './shared/AdminSkeleton';

interface NavoHomeViewProps {
  onNavigateToAgenda: () => void;
}

export const NavoHomeView: React.FC<NavoHomeViewProps> = ({ onNavigateToAgenda }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [operationalReport, setOperationalReport] = useState<OperationalReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('adminRefresh', handleRefresh);
    return () => window.removeEventListener('adminRefresh', handleRefresh);
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [data, report] = await Promise.all([
      fetchAppointmentsFromSupabase(),
      fetchOperationalReportFromSupabase('today'),
    ]);
    setAppointments(data);
    setOperationalReport(report);
    setLoading(false);
  };

  const todayStr = operationalReport?.summary.operationalDay || getTodayStringBRT();
  const todayAppointments = appointments.filter(a => a.date === todayStr);
  const activeToday = todayAppointments.filter(a => !['cancelled', 'completed', 'no_show'].includes(a.status));
  
  const totalRevenueToday = operationalReport?.summary.totalIncome || 0;
  const inServiceToday = operationalReport?.summary.currentInChair || activeToday.filter(a => a.status === 'in_service' || a.status === 'in_chair').length;
  const pendingToday = operationalReport?.summary.currentWaiting || activeToday.filter(a => a.status === 'confirmed').length;
  const ticketMedio = operationalReport?.summary.averageTicket || 0;

  const uniqueClients = new Set(appointments.map(a => a.client_id || a.client_phone || a.client_name)).size;

  const todayFormatted = new Date(`${todayStr}T12:00:00`).toLocaleDateString('pt-BR', {
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
          <span className="text-xs font-bold text-status-success bg-status-success/10 border border-status-success/30 px-2 py-0.5 rounded-xl whitespace-nowrap inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
            Na Cadeira
          </span>
        );
      case 'pending_approval':
        return (
          <span className="text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-xl whitespace-nowrap inline-flex items-center gap-1">
            Fora do expediente
          </span>
        );
      case 'completed':
        return (
          <span className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-xl whitespace-nowrap">
            Finalizado
          </span>
        );
      case 'cancelled':
        return (
          <span className="text-xs font-bold text-status-error bg-status-error/10 border border-status-error/30 px-2 py-0.5 rounded-xl whitespace-nowrap">
            Cancelado
          </span>
        );
      case 'confirmed':
      default:
        return (
          <span className="text-xs font-bold text-gold-base bg-gold-base/10 border border-gold-base/30 px-2 py-0.5 rounded-xl whitespace-nowrap">
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5" aria-busy={loading}>
        {loading ? (
          <>
            <AdminSkeleton className="h-[6.75rem] rounded-xl" />
            <AdminSkeleton className="h-[6.75rem] rounded-xl" />
            <AdminSkeleton className="h-[6.75rem] rounded-xl col-span-2 sm:col-span-1" />
          </>
        ) : (
          <>
            <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-gold-base mb-1">
                <span className="text-xs font-bold uppercase tracking-wider truncate">Faturamento</span>
                <div className="w-6 h-6 rounded-lg bg-gold-base/10 flex items-center justify-center shrink-0">
                  <Receipt className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-lg font-black finance-positive tabular-nums truncate">R$ {totalRevenueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-content-muted mt-1 font-medium truncate">{operationalReport?.summary.completedAppointments || 0} concluídos hoje</p>
            </div>

            <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-content-muted mb-1">
                <span className="text-xs font-bold uppercase tracking-wider truncate">Ticket Médio</span>
                <div className="w-6 h-6 rounded-lg bg-surface-base border border-border-subtle text-gold-base flex items-center justify-center shrink-0">
                  <CalendarCheck2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-lg font-black finance-positive tabular-nums truncate">R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-status-success mt-1 font-medium truncate">{inServiceToday} ativos agora</p>
            </div>

            <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-content-muted mb-1">
                <span className="text-xs font-bold uppercase tracking-wider truncate">Clientes Cadastrados</span>
                <div className="w-6 h-6 rounded-lg bg-surface-base border border-border-subtle text-gold-base flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-lg font-black text-content-base tabular-nums truncate">{uniqueClients}</p>
              <p className="text-xs text-content-muted mt-1 font-medium truncate">{pendingToday} aguardando</p>
            </div>
          </>
        )}
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
            className="h-9 sm:h-8 px-0 sm:px-3 w-9 sm:w-auto rounded-xl bg-gold-base/10 hover:bg-gold-base text-gold-base hover:text-surface-base border border-gold-base/30 transition-[transform,color,background-color] duration-150 text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap active:scale-[0.97]"
            aria-label="Ver na Agenda"
          >
            <Scissors className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Ver na Agenda</span>
          </button>
        </div>

        <AdminAppointmentFeed appointments={todayAppointments} onNavigateToAgenda={onNavigateToAgenda} loading={loading} />
      </div>
    </div>
  );
};
