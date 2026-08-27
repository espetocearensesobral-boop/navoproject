import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Clock3,
  Gauge,
  Loader2,
  RefreshCw,
  Scissors,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import {
  fetchOperationalReportFromSupabase,
  type OperationalReportData,
  type OperationalReportPeriod,
} from "../../services/supabaseDataService";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value || 0,
  );
const periodOptions: { id: OperationalReportPeriod; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "7 dias" },
  { id: "month", label: "30 dias" },
  { id: "quarter", label: "90 dias" },
];
const statusLabels: Record<string, string> = {
  confirmed: "Confirmado",
  in_queue: "Na fila",
  in_chair: "Na cadeira",
  in_service: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};
const queueLabels: Record<string, string> = {
  waiting: "Aguardando",
  in_chair: "Na cadeira",
  completed: "Concluídos",
  abandoned: "Removidos",
  cancelled: "Cancelados",
};

export const OperationalReportsManagement: React.FC = () => {
  const [period, setPeriod] = useState<OperationalReportPeriod>("week");
  const [report, setReport] = useState<OperationalReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<
    "overview" | "agenda" | "performance"
  >("overview");

  const loadReport = async (selectedPeriod = period) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOperationalReportFromSupabase(selectedPeriod, {
        strict: true,
      });
      setReport(data);
    } catch (requestError) {
      setReport(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar os relatórios operacionais.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(period);
  }, [period]);

  useEffect(() => {
    const refresh = () => loadReport(period);
    window.addEventListener("adminRefresh", refresh);
    return () => window.removeEventListener("adminRefresh", refresh);
  }, [period]);

  useEffect(() => {
    const refreshSeconds = report?.settings.refreshSeconds || 30;
    const refreshTimer = window.setInterval(
      () => loadReport(period),
      refreshSeconds * 1000,
    );
    return () => window.clearInterval(refreshTimer);
  }, [period, report?.settings.refreshSeconds]);

  const maxWeekly = useMemo(
    () =>
      Math.max(
        1,
        ...(report?.weeklyMovement.map((item) => item.appointments) || [1]),
      ),
    [report],
  );
  const maxHour = useMemo(
    () => Math.max(1, ...(report?.topHours.map((item) => item.count) || [1])),
    [report],
  );
  const summary = report?.summary;

  return (
    <div className="space-y-4 animate-fade-in text-[var(--admin-text-main)] min-w-0">
      <AdminPageHeader
        icon={BarChart3}
        title="Relatórios"
        stats={
          report
            ? [
                {
                  label: report.period.label.toLowerCase(),
                  value: `${summary?.appointments || 0} agendas`,
                  tone: "neutral",
                },
                {
                  label: "pico",
                  value: report.peakHour?.label || "—",
                  tone: "warning",
                },
              ]
            : undefined
        }
        action={{
          label: "Atualizar",
          onClick: () => loadReport(),
          icon: RefreshCw,
          disabled: loading,
        }}
      />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div
          data-gesture-scroll="horizontal"
          className="admin-category-scroll flex gap-2 overflow-x-auto no-scrollbar pb-1"
        >
          {periodOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPeriod(option.id)}
              className={`shrink-0 h-10 px-4 rounded-[var(--admin-radius-full)] text-sm font-bold transition-colors ${period === option.id ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)]" : "bg-[var(--admin-surface)] border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div
          data-gesture-scroll="horizontal"
          className="admin-category-scroll flex gap-2 overflow-x-auto no-scrollbar"
        >
          {[
            { id: "overview", label: "Resumo" },
            { id: "agenda", label: "Agenda" },
            { id: "performance", label: "Performance" },
          ].map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => setActiveView(view.id as typeof activeView)}
              className={`shrink-0 h-10 px-4 rounded-[var(--admin-radius-lg)] text-sm font-bold border transition-colors ${activeView === view.id ? "bg-[var(--admin-surface)] border-[var(--admin-accent)] text-[var(--admin-accent)]" : "border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"}`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--admin-radius-lg)] border border-status-error/30 bg-status-error/10 p-3.5 text-sm font-semibold text-status-error">
          {error}
        </div>
      )}
      {loading && !report ? (
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-12 text-center text-[var(--admin-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
          Carregando relatório…
        </div>
      ) : (
        report &&
        summary && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <MetricCard
                label="Agendamentos"
                value={String(summary.appointments)}
                detail={`${summary.completedAppointments} concluídos · ${summary.cancelledAppointments} cancelados`}
                icon={CalendarDays}
                tone="neutral"
              />
              <MetricCard
                label="Hoje"
                value={String(summary.todayAppointments)}
                detail={`${summary.todayActiveAppointments} ainda na operação`}
                icon={Activity}
                tone="positive"
              />
              <MetricCard
                label="Resultado"
                value={money(summary.netResult)}
                detail={`${money(summary.totalIncome)} entradas · ${money(summary.totalExpenses)} saídas`}
                icon={summary.netResult >= 0 ? ArrowUpRight : ArrowDownRight}
                tone={summary.netResult >= 0 ? "positive" : "negative"}
              />
              <MetricCard
                label="Fila agora"
                value={String(summary.currentQueue)}
                detail={`${summary.currentWaiting} aguardando · ${summary.currentInChair} na cadeira`}
                icon={Users}
                tone={summary.currentQueue > 0 ? "warning" : "neutral"}
              />
            </div>
            {report.comparison && <ComparisonStrip report={report} />}

            {activeView === "overview" && (
              <OverviewView
                report={report}
                maxWeekly={maxWeekly}
                maxHour={maxHour}
              />
            )}
            {activeView === "agenda" && (
              <AgendaView report={report} maxWeekly={maxWeekly} />
            )}
            {activeView === "performance" && (
              <PerformanceView report={report} maxHour={maxHour} />
            )}
          </>
        )
      )}
    </div>
  );
};

const ComparisonStrip: React.FC<{ report: OperationalReportData }> = ({
  report,
}) => {
  if (!report.comparison) return null;
  const delta = (current: number, previous: number) => {
    if (previous === 0) return current === 0 ? "0%" : "novo";
    const value = ((current - previous) / Math.abs(previous)) * 100;
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  };
  return (
    <section className="rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-[var(--admin-text-main)]">
            Comparação com o período anterior
          </p>
          <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">
            {report.comparison.from.split("-").reverse().join("/")} até{" "}
            {report.comparison.to.split("-").reverse().join("/")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-[var(--admin-radius-full)] bg-[var(--admin-bg)] border border-[var(--admin-border)] px-2.5 py-1 text-[var(--admin-text-muted)]">
            Agendas{" "}
            {delta(report.summary.appointments, report.comparison.appointments)}
          </span>
          <span className="rounded-[var(--admin-radius-full)] bg-[var(--admin-bg)] border border-[var(--admin-border)] px-2.5 py-1 finance-positive">
            Entradas{" "}
            {delta(report.summary.totalIncome, report.comparison.totalIncome)}
          </span>
          <span className="rounded-[var(--admin-radius-full)] bg-[var(--admin-bg)] border border-[var(--admin-border)] px-2.5 py-1 text-[var(--admin-text-muted)]">
            Ticket{" "}
            {delta(
              report.summary.averageTicket,
              report.comparison.averageTicket,
            )}
          </span>
        </div>
      </div>
    </section>
  );
};

const OverviewView: React.FC<{
  report: OperationalReportData;
  maxWeekly: number;
  maxHour: number;
}> = ({ report, maxWeekly, maxHour }) => {
  const { summary } = report;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
        <WeeklyMovement report={report} maxWeekly={maxWeekly} />
        <PeakHours report={report} maxHour={maxHour} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniMetric
          label="Taxa de conclusão"
          value={`${summary.completionRate.toFixed(1)}%`}
          detail={`${summary.completedAppointments} finalizados`}
          icon={Gauge}
          tone="positive"
        />
        <MiniMetric
          label="Cancelamentos"
          value={`${summary.cancellationRate.toFixed(1)}%`}
          detail={`${summary.cancelledAppointments} no período`}
          icon={ArrowDownRight}
          tone="negative"
        />
        <MiniMetric
          label="Ticket médio"
          value={money(summary.averageTicket)}
          detail="Recebimentos confirmados"
          icon={WalletCards}
          tone="positive"
        />
        {report.settings.showPendingValues && (
          <MiniMetric
            label="A receber"
            value={money(summary.pendingAmount)}
            detail={`${summary.pendingReceipts} pendência${summary.pendingReceipts === 1 ? "" : "s"}`}
            icon={Clock3}
            tone="warning"
          />
        )}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_0.9fr] gap-4">
        <TopServices report={report} />
        <QueueSnapshot report={report} />
      </div>
    </div>
  );
};

const AgendaView: React.FC<{
  report: OperationalReportData;
  maxWeekly: number;
}> = ({ report, maxWeekly }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
      <WeeklyMovement report={report} maxWeekly={maxWeekly} />
      <TodaySchedule report={report} />
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <DailyMovement report={report} />
      <QueueSnapshot report={report} />
    </div>
  </div>
);

const PerformanceView: React.FC<{
  report: OperationalReportData;
  maxHour: number;
}> = ({ report, maxHour }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-4">
      <TopServices report={report} />
      <PeakHours report={report} maxHour={maxHour} />
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-4">
      <ProfessionalsRanking report={report} />
      <TodaySchedule report={report} />
    </div>
  </div>
);

const WeeklyMovement: React.FC<{
  report: OperationalReportData;
  maxWeekly: number;
}> = ({ report, maxWeekly }) => (
  <section className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-4 sm:p-5">
    <SectionTitle
      icon={BarChart3}
      title="Movimento semanal"
      description="Agendamentos por dia; concluídos em destaque."
    />
    <div className="mt-6 h-52 flex items-end gap-2 sm:gap-3">
      {report.weeklyMovement.map((day) => (
        <div
          key={day.weekday}
          className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-2"
        >
          <div className="w-full h-[calc(100%-1.75rem)] flex items-end justify-center gap-1">
            <span
              title={`${day.appointments} agendamentos`}
              className="w-3 sm:w-5 rounded-t-[var(--admin-radius-sm)] bg-[var(--admin-accent)]/30 relative"
              style={{
                height: `${Math.max(day.appointments ? 7 : 0, (day.appointments / maxWeekly) * 100)}%`,
              }}
            >
              <i
                className="absolute bottom-0 left-0 right-0 rounded-t-[var(--admin-radius-sm)] bg-[var(--admin-accent)]"
                style={{
                  height: `${day.appointments ? Math.max(8, (day.completed / day.appointments) * 100) : 0}%`,
                }}
              />
            </span>
          </div>
          <span className="text-xs font-bold text-[var(--admin-text-muted)]">
            {day.label}
          </span>
        </div>
      ))}
    </div>
    <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--admin-text-muted)]">
      <span className="flex items-center gap-1.5">
        <i className="w-2.5 h-2.5 rounded-[var(--admin-radius-xs)] bg-[var(--admin-accent)]" />
        Concluídos
      </span>
      <span className="flex items-center gap-1.5">
        <i className="w-2.5 h-2.5 rounded-[var(--admin-radius-xs)] bg-[var(--admin-accent)]/30" />
        Total agendado
      </span>
    </div>
  </section>
);

const DailyMovement: React.FC<{ report: OperationalReportData }> = ({
  report,
}) => {
  const max = Math.max(
    1,
    ...report.dailyMovement.map((day) => day.appointments),
  );
  return (
    <section className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-4 sm:p-5">
      <SectionTitle
        icon={CalendarDays}
        title="Evolução diária"
        description="Volume no período."
      />
      <div className="mt-5 space-y-2.5 max-h-64 overflow-y-auto pr-1">
        {report.dailyMovement
          .filter((day) => day.appointments > 0)
          .map((day) => (
            <div key={day.date} className="flex items-center gap-3">
              <span className="w-12 text-xs font-mono text-[var(--admin-text-muted)]">
                {day.label}
              </span>
              <div className="flex-1 h-2 rounded-[var(--admin-radius-full)] bg-[var(--admin-bg)] overflow-hidden">
                <span
                  className="block h-full rounded-[var(--admin-radius-full)] bg-[var(--admin-accent)]"
                  style={{ width: `${(day.appointments / max) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs font-bold text-[var(--admin-text-main)]">
                {day.appointments}
              </span>
              <span className="w-20 text-right text-xs finance-positive">
                {money(day.revenue)}
              </span>
            </div>
          ))}
        {report.dailyMovement.every((day) => day.appointments === 0) && (
          <EmptyState text="Nenhum agendamento no período." />
        )}
      </div>
    </section>
  );
};

const PeakHours: React.FC<{
  report: OperationalReportData;
  maxHour: number;
}> = ({ report, maxHour }) => (
  <section className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-4 sm:p-5">
    <SectionTitle
      icon={Clock3}
      title="Horários de pico"
      description={
        report.peakHour
          ? `Maior movimento concentrado às ${report.peakHour.label}.`
          : "Sem dados suficientes para identificar um pico."
      }
    />
    {report.topHours.length === 0 ? (
      <EmptyState text="Nenhum horário registrado no período." />
    ) : (
      <div className="mt-5 space-y-3">
        {report.topHours.map((hour, index) => (
          <div key={hour.hour} className="flex items-center gap-3">
            <span className="w-6 text-xs font-bold text-[var(--admin-accent)]">
              #{index + 1}
            </span>
            <span className="w-10 text-sm font-mono font-bold text-[var(--admin-text-main)]">
              {hour.label}
            </span>
            <div className="flex-1 h-2 rounded-[var(--admin-radius-full)] bg-[var(--admin-bg)] overflow-hidden">
              <span
                className="block h-full rounded-[var(--admin-radius-full)] bg-status-warning"
                style={{ width: `${(hour.count / maxHour) * 100}%` }}
              />
            </div>
            <span className="w-20 text-right text-xs text-[var(--admin-text-muted)]">
              {hour.count} agend.
            </span>
          </div>
        ))}
      </div>
    )}
  </section>
);

const TopServices: React.FC<{ report: OperationalReportData }> = ({
  report,
}) => (
  <section className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-4 sm:p-5">
    <SectionTitle
      icon={Scissors}
      title="Top 5 serviços"
      description="Serviços mais movimentados no período."
    />
    {report.topServices.length === 0 ? (
      <EmptyState text="Nenhum serviço encontrado no período." />
    ) : (
      <div className="mt-4 space-y-2.5">
        {report.topServices.map((service, index) => (
          <div
            key={service.serviceTitle}
            className="p-3 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)] border border-[var(--admin-border)] flex items-center gap-3"
          >
            <span className="w-8 h-8 rounded-[var(--admin-radius-md)] bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] text-xs font-bold flex items-center justify-center shrink-0">
              #{index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[var(--admin-text-main)] admin-clamp-2">
                {service.serviceTitle}
              </p>
              <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">
                {service.count} agendamento{service.count === 1 ? "" : "s"} ·{" "}
                {service.completedCount} concluído
                {service.completedCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-mono font-bold finance-positive">
                {money(service.revenue)}
              </p>
              <p className="text-xs text-[var(--admin-text-muted)]">recebido</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

const ProfessionalsRanking: React.FC<{ report: OperationalReportData }> = ({
  report,
}) => (
  <section className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-4 sm:p-5">
    <SectionTitle
      icon={UserRound}
      title="Performance da equipe"
      description="Atendimentos concluídos e receita por profissional."
    />
    {report.topProfessionals.length === 0 ? (
      <EmptyState text="Nenhum profissional com atividade no período." />
    ) : (
      <div className="mt-4 space-y-2.5">
        {report.topProfessionals.map((professional, index) => (
          <div
            key={professional.professionalName}
            className="p-3 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)] border border-[var(--admin-border)] flex items-center gap-3"
          >
            <span className="w-8 h-8 rounded-[var(--admin-radius-md)] bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] text-xs font-bold flex items-center justify-center shrink-0">
              #{index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[var(--admin-text-main)] admin-clamp-2">
                {professional.professionalName}
              </p>
              <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">
                {professional.completed} concluído
                {professional.completed === 1 ? "" : "s"} de{" "}
                {professional.appointments} agenda
                {professional.appointments === 1 ? "" : "s"}
              </p>
            </div>
            <p className="text-sm font-mono font-bold finance-positive shrink-0">
              {money(professional.revenue)}
            </p>
          </div>
        ))}
      </div>
    )}
  </section>
);

const QueueSnapshot: React.FC<{ report: OperationalReportData }> = ({
  report,
}) => (
  <section className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-4 sm:p-5">
    <SectionTitle
      icon={Users}
      title="Fila e operação"
      description={`${report.summary.currentQueue} cliente${report.summary.currentQueue === 1 ? "" : "s"} na operação agora.`}
    />
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {report.queueSummary
        .filter((item) =>
          ["waiting", "in_chair", "completed", "abandoned"].includes(
            item.status,
          ),
        )
        .map((item) => (
          <div
            key={item.status}
            className="p-3 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)] border border-[var(--admin-border)]"
          >
            <p className="text-xs text-[var(--admin-text-muted)] admin-safe-wrap">
              {queueLabels[item.status] || item.status}
            </p>
            <p className="mt-1 text-xl font-mono font-bold text-[var(--admin-text-main)]">
              {item.count}
            </p>
          </div>
        ))}
    </div>
  </section>
);

const TodaySchedule: React.FC<{ report: OperationalReportData }> = ({
  report,
}) => (
  <section className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-4 sm:p-5">
    <SectionTitle
      icon={CalendarDays}
      title="Próximos hoje"
      description="Agenda de hoje."
    />
    {report.upcomingAppointments.length === 0 ? (
      <EmptyState text="Nenhum atendimento ativo hoje." />
    ) : (
      <div className="mt-4 divide-y divide-[var(--admin-border)]">
        {report.upcomingAppointments.map((appointment) => (
          <div
            key={appointment.id}
            className="py-3 first:pt-0 last:pb-0 flex items-center gap-3"
          >
            <span className="w-12 text-center text-sm font-mono font-bold text-[var(--admin-accent)]">
              {appointment.timeSlot}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[var(--admin-text-main)] admin-clamp-2">
                {appointment.clientName}
              </p>
              <p className="mt-0.5 text-xs text-[var(--admin-text-muted)] admin-safe-wrap">
                {appointment.serviceTitle} · {appointment.professionalName}
              </p>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-[var(--admin-radius-full)] bg-[var(--admin-bg)] text-[var(--admin-text-muted)] shrink-0">
              {statusLabels[appointment.status] || appointment.status}
            </span>
          </div>
        ))}
      </div>
    )}
  </section>
);

const SectionTitle: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
}> = ({ icon: Icon, title, description }) => (
  <div>
    <h2 className="admin-copy-title text-base font-serif font-bold text-[var(--admin-text-main)] flex items-center gap-2">
      <Icon className="w-4 h-4 text-[var(--admin-accent)]" />
      {title}
    </h2>
    <p className="admin-copy-description mt-1 text-sm text-[var(--admin-text-muted)]">
      {description}
    </p>
  </div>
);
const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <p className="py-10 text-center text-sm text-[var(--admin-text-muted)]">
    {text}
  </p>
);
const MetricCard: React.FC<{
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  tone: "positive" | "negative" | "warning" | "neutral";
}> = ({ label, value, detail, icon: Icon, tone }) => {
  const toneClass =
    tone === "positive"
      ? "text-status-success bg-status-success/10"
      : tone === "negative"
        ? "text-status-error bg-status-error/10"
        : tone === "warning"
          ? "text-amber-500 bg-amber-500/10"
          : "text-[var(--admin-accent)] bg-[var(--admin-accent)]/10";
  const valueClass =
    tone === "positive"
      ? "finance-positive"
      : tone === "negative"
        ? "finance-negative"
        : "text-[var(--admin-text-main)]";
  return (
    <div className="min-w-0 p-3.5 sm:p-4 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] admin-safe-wrap">
          {label}
        </p>
        <span
          className={`w-8 h-8 rounded-[var(--admin-radius-md)] shrink-0 flex items-center justify-center ${toneClass}`}
        >
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <p
        className={`mt-3 text-lg sm:text-xl font-mono font-bold truncate ${valueClass}`}
      >
        {value}
      </p>
      <p className="admin-copy-description mt-1 text-xs text-[var(--admin-text-muted)] admin-safe-wrap">
        {detail}
      </p>
    </div>
  );
};
const MiniMetric: React.FC<{
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  tone: "positive" | "negative" | "warning";
}> = ({ label, value, detail, icon: Icon, tone }) => (
  <div className="p-3.5 rounded-[var(--admin-radius-lg)] bg-[var(--admin-surface)] border border-[var(--admin-border)] flex items-start gap-3">
    <span
      className={`w-8 h-8 rounded-[var(--admin-radius-md)] shrink-0 flex items-center justify-center ${tone === "positive" ? "text-status-success bg-status-success/10" : tone === "negative" ? "text-status-error bg-status-error/10" : "text-amber-500 bg-amber-500/10"}`}
    >
      <Icon className="w-4 h-4" />
    </span>
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] admin-safe-wrap">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-mono font-bold ${tone === "positive" ? "finance-positive" : tone === "negative" ? "finance-negative" : "text-[var(--admin-text-main)]"}`}
      >
        {value}
      </p>
      <p className="admin-copy-description mt-0.5 text-xs text-[var(--admin-text-muted)] admin-safe-wrap">
        {detail}
      </p>
    </div>
  </div>
);
