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

      {/* KPI Cards: os três números que respondem "como está o caixa hoje". */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
        aria-busy={loading}
      >
        {loading ? (
          <>
            <AdminSkeleton className="h-[6.75rem] rounded-xl" />
            <AdminSkeleton className="h-[6.75rem] rounded-xl" />
            <AdminSkeleton className="h-[6.75rem] rounded-xl col-span-2 sm:col-span-1" />
          </>
        ) : (
          <>
            <div className="admin-card flex flex-col justify-between p-4 gap-2">
              <div className="flex items-center justify-between text-[var(--admin-accent)] mb-1">
                <span className="admin-label text-[var(--admin-accent)] truncate">
                  Faturamento
                </span>
                <div className="w-8 h-8 rounded-[var(--admin-radius-md)] bg-[var(--admin-accent)]/10 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <p className="admin-title-h1 text-status-success tabular-nums truncate">
                R${" "}
                {totalRevenueToday.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </p>
              <div className="flex items-center gap-1.5 mt-auto min-w-0">
                <p className="admin-text-small truncate">
                  {summary?.completedAppointments || 0} concluídos
                </p>
                <Trend
                  current={totalRevenueToday}
                  previous={comparison?.totalIncome}
                />
              </div>
            </div>

            <div className="admin-card flex flex-col justify-between p-4 gap-2">
              <div className="flex items-center justify-between text-[var(--admin-text-muted)] mb-1">
                <span className="admin-label truncate">A Receber</span>
                <div className="w-8 h-8 rounded-[var(--admin-radius-md)] border border-[var(--admin-border)] bg-[var(--admin-bg)] text-[var(--admin-accent)] flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <p
                className={`admin-title-h1 tabular-nums truncate ${pendingAmount > 0 ? "text-amber-400" : "text-[var(--admin-text-main)]"}`}
              >
                R${" "}
                {pendingAmount.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </p>
              <p className="admin-text-small mt-auto truncate">
                {pendingReceiptsCount === 0
                  ? "Nada pendente"
                  : `${pendingReceiptsCount} pendência${pendingReceiptsCount > 1 ? "s" : ""}`}
              </p>
            </div>

            <div className="admin-card flex flex-col justify-between p-4 gap-2 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-[var(--admin-text-muted)] mb-1">
                <span className="admin-label truncate">Ticket Médio</span>
                <div className="w-8 h-8 rounded-[var(--admin-radius-md)] border border-[var(--admin-border)] bg-[var(--admin-bg)] text-[var(--admin-accent)] flex items-center justify-center shrink-0">
                  <CalendarCheck2 className="w-4 h-4" />
                </div>
              </div>
              <p className="admin-title-h1 text-status-success tabular-nums truncate">
                R${" "}
                {ticketMedio.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </p>
              <div className="flex items-center gap-1.5 mt-auto min-w-0">
                <p className="admin-text-small truncate">por atendimento</p>
                <Trend
                  current={ticketMedio}
                  previous={comparison?.averageTicket}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Estado "agora": contadores operacionais, deliberadamente mais discretos que os KPIs financeiros acima. */}
      {!loading && (
        <div className="flex items-stretch rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-surface)] divide-x divide-[var(--admin-border)] overflow-hidden">
          <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
            <UserCheck className="w-5 h-5 text-status-success shrink-0" />
            <div className="min-w-0">
              <p className="admin-title-h3 tabular-nums leading-tight">
                {inServiceToday}
              </p>
              <p className="admin-label truncate">Em atendimento</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
            <Users className="w-5 h-5 text-[var(--admin-accent)] shrink-0" />
            <div className="min-w-0">
              <p className="admin-title-h3 tabular-nums leading-tight">
                {waitingToday}
              </p>
              <p className="admin-label truncate">Aguardando</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
            <AlertTriangle className="w-5 h-5 text-[var(--admin-text-muted)] shrink-0" />
            <div className="min-w-0">
              <p className="admin-title-h3 tabular-nums leading-tight">
                {closedOutToday}
              </p>
              <p className="admin-label truncate">Cancel./Não veio</p>
            </div>
          </div>
        </div>
      )}

      {/* Atendimentos em andamento: o que precisa de atenção agora vem primeiro e visível por padrão. */}
      <div className="admin-card p-0 overflow-hidden min-w-0">
        <div className="h-14 px-4 border-b border-[var(--admin-border)] flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="admin-title-h3 truncate">
              Em Andamento ({activeToday.length})
            </h3>
          </div>
          <button
            onClick={onNavigateToAgenda}
            className="admin-btn-sm admin-btn-primary"
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
