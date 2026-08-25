import React, { useState, useEffect } from "react";
import {
  fetchAppointmentsFromSupabase,
  fetchOperationalReportFromSupabase,
  type OperationalReportData,
} from "../../services/supabaseDataService";
import { getTodayStringBRT } from "../../utils/dateUtils";
import { Appointment } from "../../types";
import {
  Receipt,
  Wallet,
  CalendarCheck2,
  Users,
  UserCheck,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import { AdminAppointmentFeed } from "./shared/AdminAppointmentFeed";
import { AdminSkeleton } from "./shared/AdminSkeleton";

interface NavoHomeViewProps {
  onNavigateToAgenda: () => void;
}

const HISTORY_STATUSES = new Set(["cancelled", "completed", "no_show"]);

/** Variação percentual vs. o mesmo período anterior (fornecida pela API quando a comparação está habilitada). */
const Trend: React.FC<{ current: number; previous?: number | null }> = ({
  current,
  previous,
}) => {
  if (previous === undefined || previous === null) return null;
  if (previous === 0 && current === 0) return null;
  const diff = previous === 0 ? 100 : ((current - previous) / previous) * 100;
  const isUp = diff >= 0;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${isUp ? "text-status-success" : "text-status-error"}`}
    >
      <Icon className="w-3 h-3" />
      {Math.abs(diff).toFixed(0)}%
      <span className="text-[var(--admin-text-muted)] font-medium ml-0.5">
        vs ontem
      </span>
    </span>
  );
};

export const NavoHomeView: React.FC<NavoHomeViewProps> = ({
  onNavigateToAgenda,
}) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [operationalReport, setOperationalReport] =
    useState<OperationalReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener("adminRefresh", handleRefresh);
    return () => window.removeEventListener("adminRefresh", handleRefresh);
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [data, report] = await Promise.all([
      fetchAppointmentsFromSupabase(),
      fetchOperationalReportFromSupabase("today"),
    ]);
    setAppointments(data);
    setOperationalReport(report);
    setLoading(false);
  };

  const todayStr =
    operationalReport?.summary.operationalDay || getTodayStringBRT();
  const todayAppointments = appointments
    .filter((a) => a.date === todayStr)
    .sort((a, b) => (a.time_slot || "").localeCompare(b.time_slot || ""));

  const activeToday = todayAppointments.filter(
    (a) => !HISTORY_STATUSES.has(a.status),
  );
  const historyToday = todayAppointments.filter((a) =>
    HISTORY_STATUSES.has(a.status),
  );
  const pendingApprovalToday = todayAppointments.filter(
    (a) => a.status === "pending_approval",
  );

  const summary = operationalReport?.summary;
  const comparison = operationalReport?.comparison;

  const totalRevenueToday = summary?.totalIncome || 0;
  const pendingAmount = summary?.pendingAmount || 0;
  const pendingReceiptsCount = summary?.pendingReceipts || 0;
  const ticketMedio = summary?.averageTicket || 0;
  const inServiceToday =
    summary?.currentInChair ??
    activeToday.filter(
      (a) => a.status === "in_service" || a.status === "in_chair",
    ).length;
  const waitingToday =
    summary?.currentWaiting ??
    activeToday.filter((a) => a.status === "confirmed").length;
  const closedOutToday = todayAppointments.filter(
    (a) => a.status === "cancelled" || a.status === "no_show",
  ).length;

  const uniqueClients = new Set(
    appointments.map((a) => a.client_id || a.client_phone || a.client_name),
  ).size;

  const todayFormatted = new Date(`${todayStr}T12:00:00`).toLocaleDateString(
    "pt-BR",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );

  return (
    <div className="space-y-4 animate-fade-in text-[var(--admin-text-main)] min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={Receipt}
        title="Painel do Dia"
        stats={[
          { label: todayFormatted, value: "", tone: "gold" },
          { label: "clientes na base", value: uniqueClients, tone: "muted" },
        ]}
      />

      {/* Atenção: só aparece quando existe algo que realmente precisa de decisão do admin. */}
      {!loading && pendingApprovalToday.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs font-semibold text-amber-200 flex-1 min-w-0">
            {pendingApprovalToday.length === 1
              ? "1 agendamento fora do expediente aguardando aprovação."
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

      {/* KPI Cards & Operational State - Clean SaaS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5" aria-busy={loading}>
        {/* Principal KPIs */}
        <div className="lg:col-span-8 flex flex-col gap-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--admin-border)] bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl overflow-hidden">
            {loading ? (
              <>
                <AdminSkeleton className="h-28" />
                <AdminSkeleton className="h-28" />
                <AdminSkeleton className="h-28" />
              </>
            ) : (
              <>
                <div className="p-4 sm:p-5 flex flex-col justify-between hover:bg-[var(--admin-surface-hover)] transition-colors">
                  <div className="flex items-center gap-2 text-[var(--admin-text-muted)] mb-2.5">
                    <Receipt className="w-4 h-4 text-[var(--admin-accent)]" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Faturamento</span>
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-status-success tabular-nums">
                      R$ {totalRevenueToday.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs font-semibold text-[var(--admin-text-main)]">
                        {summary?.completedAppointments || 0} concluídos
                      </p>
                      <Trend current={totalRevenueToday} previous={comparison?.totalIncome} />
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 flex flex-col justify-between hover:bg-[var(--admin-surface-hover)] transition-colors">
                  <div className="flex items-center gap-2 text-[var(--admin-text-muted)] mb-2.5">
                    <Wallet className="w-4 h-4 text-amber-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">A Receber</span>
                  </div>
                  <div>
                    <p className={`text-xl sm:text-2xl font-bold tabular-nums ${pendingAmount > 0 ? "text-amber-400" : "text-[var(--admin-text-main)]"}`}>
                      R$ {pendingAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-[var(--admin-text-muted)] mt-1">
                      {pendingReceiptsCount === 0 ? "Caixa em dia" : `${pendingReceiptsCount} pendências financeiras`}
                    </p>
                  </div>
                </div>

                <div className="p-4 sm:p-5 flex flex-col justify-between hover:bg-[var(--admin-surface-hover)] transition-colors">
                  <div className="flex items-center gap-2 text-[var(--admin-text-muted)] mb-2.5">
                    <CalendarCheck2 className="w-4 h-4 text-[var(--admin-text-muted)]" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Ticket Médio</span>
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-[var(--admin-text-main)] tabular-nums">
                      R$ {ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-[var(--admin-text-muted)]">
                        por atendimento
                      </p>
                      <Trend current={ticketMedio} previous={comparison?.averageTicket} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Operational Status (Agora) */}
        <div className="lg:col-span-4">
          <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl p-4 sm:p-5 h-full flex flex-col justify-center">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-3.5">
              Status Operacional
            </h3>
            {loading ? (
               <div className="space-y-3">
                 <AdminSkeleton className="h-6 w-full" />
                 <AdminSkeleton className="h-6 w-3/4" />
               </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[var(--admin-text-main)]">
                    <UserCheck className="w-4 h-4 text-status-success" />
                    <span className="text-xs sm:text-sm font-semibold">Em atendimento</span>
                  </div>
                  <span className="text-xs sm:text-sm font-bold tabular-nums bg-status-success/10 text-status-success px-2.5 py-0.5 rounded-full">{inServiceToday}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[var(--admin-text-main)]">
                    <Users className="w-4 h-4 text-[var(--admin-accent)]" />
                    <span className="text-xs sm:text-sm font-semibold">Aguardando</span>
                  </div>
                  <span className="text-xs sm:text-sm font-bold tabular-nums bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] px-2.5 py-0.5 rounded-full">{waitingToday}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[var(--admin-text-main)]">
                    <AlertTriangle className="w-4 h-4 text-status-error" />
                    <span className="text-xs sm:text-sm font-semibold">Faltas / Cancelados</span>
                  </div>
                  <span className="text-xs sm:text-sm font-bold tabular-nums bg-status-error/10 text-status-error px-2.5 py-0.5 rounded-full">{closedOutToday}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Atendimentos em andamento: o que precisa de atenção agora vem primeiro e visível por padrão. */}
      <div className="admin-card p-0 overflow-hidden min-w-0">
        <div className="h-14 px-4 border-b border-[var(--admin-border)] flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="admin-title-h3 truncate">
              Em Andamento ({activeToday.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={onNavigateToAgenda}
            className="admin-btn admin-btn-sm admin-btn-primary cursor-pointer"
            aria-label="Ver na Agenda"
          >
            <CalendarCheck2 className="w-4 h-4 shrink-0" />
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
        <div className="admin-card p-0 overflow-hidden min-w-0">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="w-full h-14 px-4 flex items-center justify-between gap-3 text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-bg)] transition-colors"
            aria-expanded={showHistory}
          >
            <span className="admin-title-h3 tracking-tight">
              Concluídos e cancelados hoje ({historyToday.length})
            </span>
            {showHistory ? (
              <ChevronUp className="w-5 h-5 shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 shrink-0" />
            )}
          </button>
          {showHistory && (
            <div className="border-t border-[var(--admin-border)]">
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
