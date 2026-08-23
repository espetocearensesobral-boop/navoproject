import React, { useState, useEffect } from 'react';
import { fetchAppointmentsFromSupabase, fetchOperationalReportFromSupabase, type OperationalReportData } from '../../services/supabaseDataService';
import { getTodayStringBRT } from '../../utils/dateUtils';
import { Appointment } from '../../types';
import { Receipt, Wallet, CalendarCheck2, Users, UserCheck, AlertTriangle, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp } from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { AdminAppointmentFeed } from './shared/AdminAppointmentFeed';
import { AdminSkeleton } from './shared/AdminSkeleton';

interface NavoHomeViewProps {
  onNavigateToAgenda: () => void;
}

const HISTORY_STATUSES = new Set(['cancelled', 'completed', 'no_show']);

/** Variação percentual vs. o mesmo período anterior (fornecida pela API quando a comparação está habilitada). */
const Trend: React.FC<{ current: number; previous?: number | null }> = ({ current, previous }) => {
  if (previous === undefined || previous === null) return null;
  if (previous === 0 && current === 0) return null;
  const diff = previous === 0 ? 100 : ((current - previous) / previous) * 100;
  const isUp = diff >= 0;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${isUp ? 'text-status-success' : 'text-status-error'}`}>
      <Icon className="w-3 h-3" />
      {Math.abs(diff).toFixed(0)}%
      <span className="text-content-muted font-medium ml-0.5">vs ontem</span>
    </span>
  );
};

export const NavoHomeView: React.FC<NavoHomeViewProps> = ({ onNavigateToAgenda }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [operationalReport, setOperationalReport] = useState<OperationalReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

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
  const todayAppointments = appointments
    .filter(a => a.date === todayStr)
    .sort((a, b) => (a.time_slot || '').localeCompare(b.time_slot || ''));

  const activeToday = todayAppointments.filter(a => !HISTORY_STATUSES.has(a.status));
  const historyToday = todayAppointments.filter(a => HISTORY_STATUSES.has(a.status));
  const pendingApprovalToday = todayAppointments.filter(a => a.status === 'pending_approval');

  const summary = operationalReport?.summary;
  const comparison = operationalReport?.comparison;

  const totalRevenueToday = summary?.totalIncome || 0;
  const pendingAmount = summary?.pendingAmount || 0;
  const pendingReceiptsCount = summary?.pendingReceipts || 0;
  const ticketMedio = summary?.averageTicket || 0;
  const inServiceToday = summary?.currentInChair ?? activeToday.filter(a => a.status === 'in_service' || a.status === 'in_chair').length;
  const waitingToday = summary?.currentWaiting ?? activeToday.filter(a => a.status === 'confirmed').length;
  const closedOutToday = todayAppointments.filter(a => a.status === 'cancelled' || a.status === 'no_show').length;

  const uniqueClients = new Set(appointments.map(a => a.client_id || a.client_phone || a.client_name)).size;

  const todayFormatted = new Date(`${todayStr}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={Receipt}
        title="Painel do Dia"
        stats={[
          { label: todayFormatted, value: '', tone: 'gold' },
          { label: 'clientes na base', value: uniqueClients, tone: 'muted' },
        ]}
      />

      {/* Atenção: só aparece quando existe algo que realmente precisa de decisão do admin. */}
      {!loading && pendingApprovalToday.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs font-semibold text-amber-200 flex-1 min-w-0">
            {pendingApprovalToday.length === 1
              ? '1 agendamento fora do expediente aguardando aprovação.'
              : `${pendingApprovalToday.length} agendamentos fora do expediente aguardando aprovação.`}
          </p>
          <button
            type="button"
            onClick={onNavigateToAgenda}
            className="text-xs font-bold text-amber-300 hover:text-amber-100 underline underline-offset-2 shrink-0"
          >
            Revisar
          </button>
        </div>
      )}

      {/* KPI Cards: os três números que respondem "como está o caixa hoje". */}
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
              <div className="flex items-center gap-1.5 mt-1 min-w-0">
                <p className="text-xs text-content-muted font-medium truncate">{summary?.completedAppointments || 0} concluídos</p>
                <Trend current={totalRevenueToday} previous={comparison?.totalIncome} />
              </div>
            </div>

            <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-content-muted mb-1">
                <span className="text-xs font-bold uppercase tracking-wider truncate">A Receber</span>
                <div className="w-6 h-6 rounded-lg bg-surface-base border border-border-subtle text-gold-base flex items-center justify-center shrink-0">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className={`text-lg font-black tabular-nums truncate ${pendingAmount > 0 ? 'text-amber-400' : 'text-content-base'}`}>
                R$ {pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-content-muted mt-1 font-medium truncate">
                {pendingReceiptsCount === 0 ? 'Nada pendente' : `${pendingReceiptsCount} pendência${pendingReceiptsCount > 1 ? 's' : ''}`}
              </p>
            </div>

            <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-content-muted mb-1">
                <span className="text-xs font-bold uppercase tracking-wider truncate">Ticket Médio</span>
                <div className="w-6 h-6 rounded-lg bg-surface-base border border-border-subtle text-gold-base flex items-center justify-center shrink-0">
                  <CalendarCheck2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-lg font-black finance-positive tabular-nums truncate">R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <div className="flex items-center gap-1.5 mt-1 min-w-0">
                <p className="text-xs text-content-muted font-medium truncate">por atendimento</p>
                <Trend current={ticketMedio} previous={comparison?.averageTicket} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Estado "agora": contadores operacionais, deliberadamente mais discretos que os KPIs financeiros acima. */}
      {!loading && (
        <div className="flex items-stretch rounded-xl border border-border-subtle bg-surface-card divide-x divide-border-subtle overflow-hidden">
          <div className="flex-1 flex items-center gap-2.5 px-3 py-2.5 min-w-0">
            <UserCheck className="w-4 h-4 text-status-success shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-content-base tabular-nums leading-tight">{inServiceToday}</p>
              <p className="text-[10px] text-content-muted uppercase tracking-wide truncate">Em atendimento</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-2.5 px-3 py-2.5 min-w-0">
            <Users className="w-4 h-4 text-gold-base shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-content-base tabular-nums leading-tight">{waitingToday}</p>
              <p className="text-[10px] text-content-muted uppercase tracking-wide truncate">Aguardando</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-2.5 px-3 py-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-content-muted shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-content-base tabular-nums leading-tight">{closedOutToday}</p>
              <p className="text-[10px] text-content-muted uppercase tracking-wide truncate">Cancel./Não veio</p>
            </div>
          </div>
        </div>
      )}

      {/* Atendimentos em andamento: o que precisa de atenção agora vem primeiro e visível por padrão. */}
      <div className="bg-surface-card rounded-xl border border-border-subtle overflow-hidden min-w-0">
        <div className="h-12 px-4 border-b border-border-subtle flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-serif font-bold text-content-base tracking-tight truncate">
              Em Andamento ({activeToday.length})
            </h3>
          </div>
          <button
            onClick={onNavigateToAgenda}
            className="h-9 sm:h-8 px-0 sm:px-3 w-9 sm:w-auto rounded-xl bg-gold-base/10 hover:bg-gold-base text-gold-base hover:text-content-on-accent border border-gold-base/30 transition-[transform,color,background-color] duration-150 text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap active:scale-[0.97]"
            aria-label="Ver na Agenda"
          >
            <CalendarCheck2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Ver na Agenda</span>
          </button>
        </div>

        <AdminAppointmentFeed
          appointments={activeToday}
          onNavigateToAgenda={onNavigateToAgenda}
          loading={loading}
          emptyTitle="Nada pendente agora"
          emptyDescription="Todos os atendimentos de hoje já foram concluídos ou a agenda está livre."
        />
      </div>

      {/* Histórico do dia: informação real, mas de menor prioridade — recolhida por padrão para não competir com o que está em aberto. */}
      {!loading && historyToday.length > 0 && (
        <div className="bg-surface-card rounded-xl border border-border-subtle overflow-hidden min-w-0">
          <button
            type="button"
            onClick={() => setShowHistory(v => !v)}
            className="w-full h-11 px-4 flex items-center justify-between gap-3 text-content-muted hover:text-content-base transition-colors"
            aria-expanded={showHistory}
          >
            <span className="text-xs font-bold tracking-tight">
              Concluídos e cancelados hoje ({historyToday.length})
            </span>
            {showHistory ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
          </button>
          {showHistory && (
            <div className="border-t border-border-subtle">
              <AdminAppointmentFeed
                appointments={historyToday}
                onNavigateToAgenda={onNavigateToAgenda}
                loading={false}
                showEmptyAction={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
