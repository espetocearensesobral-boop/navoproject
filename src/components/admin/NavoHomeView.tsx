import React, { useEffect, useMemo, useState } from"react";
import {
 Activity,
 AlertTriangle,
 ArrowDownRight,
 ArrowUpRight,
 Banknote,
 CalendarCheck2,
 CalendarClock,
 CheckCircle2,
 ChevronDown,
 ChevronUp,
 Clock3,
 ListChecks,
 Receipt,
 UserCheck,
 Users,
 Wallet,
} from"lucide-react";
import {
 fetchAppointmentsFromSupabase,
 fetchOperationalReportFromSupabase,
 type OperationalReportData,
} from"../../services/supabaseDataService";
import { getTodayStringBRT } from"../../utils/dateUtils";
import { Appointment } from"../../types";
import { AdminAppointmentFeed } from"./shared/AdminAppointmentFeed";
import { AdminSkeleton } from"./shared/AdminSkeleton";

interface NavoHomeViewProps {
 onNavigateToAgenda: () => void;
 onNavigateToQueue: () => void;
 onNavigateToReceipts: () => void;
}

const HISTORY_STATUSES = new Set(["cancelled","completed","no_show"]);

type UpcomingAppointment = {
 id: string;
 clientName: string;
 professionalName: string;
 serviceTitle: string;
 timeSlot: string;
 status: string;
 finalAmount: number;
};

const STATUS_LABELS: Record<Appointment["status"], string> = {
 pending:"Pendente",
 pending_approval:"Aguardando aprovação",
 confirmed:"Confirmado",
 in_queue:"Na fila",
 in_service:"Em atendimento",
 completed:"Concluído",
 cancelled:"Cancelado",
 no_show:"Não compareceu",
};

const STATUS_TONES: Record<string, string> = {
 pending:"is-warning",
 pending_approval:"is-warning",
 confirmed:"is-neutral",
 in_queue:"is-info",
 in_service:"is-success",
 completed:"is-success",
 cancelled:"is-error",
 no_show:"is-error",
};

const formatCurrency = (value: number) =>
 `R$ ${value.toLocaleString("pt-BR", {
 minimumFractionDigits: 2,
 maximumFractionDigits: 2,
 })}`;

const formatDateLabel = (value: string) => {
 if (!value) return"Hoje";
 return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatStatus = (status: string) => {
 if (status in STATUS_LABELS) {
 return STATUS_LABELS[status as Appointment["status"]];
 }
 return status.replaceAll("_","");
};

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
 className={`admin-dashboard-trend ${isUp ?"is-positive":"is-negative"}`}
 >
 <Icon className="h-3.5 w-3.5"/>
 {Math.abs(diff).toFixed(0)}%
 <span className="font-normal text-[var(--admin-text-muted)]">vs. período anterior</span>
 </span>
 );
};

const MetricSkeleton: React.FC = () => (
 <div className="admin-dashboard-metric">
 <AdminSkeleton className="h-3 w-24"/>
 <AdminSkeleton className="mt-4 h-7 w-32"/>
 <AdminSkeleton className="mt-3 h-3 w-28"/>
 </div>
);

export const NavoHomeView: React.FC<NavoHomeViewProps> = ({
 onNavigateToAgenda,
 onNavigateToQueue,
 onNavigateToReceipts,
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
 .filter((appointment) => appointment.date === todayStr)
 .sort((a, b) => (a.time_slot ||"").localeCompare(b.time_slot ||""));
 const activeToday = todayAppointments.filter(
 (appointment) => !HISTORY_STATUSES.has(appointment.status),
 );
 const historyToday = todayAppointments.filter((appointment) =>
 HISTORY_STATUSES.has(appointment.status),
 );
 const pendingApprovalToday = todayAppointments.filter(
 (appointment) => appointment.status ==="pending_approval",
 );

 const summary = operationalReport?.summary;
 const comparison = operationalReport?.comparison;
 const totalRevenueToday = summary?.totalIncome ?? 0;
 const pendingAmount = summary?.pendingAmount ?? 0;
 const pendingReceiptsCount = summary?.pendingReceipts ?? 0;
 const ticketMedio = summary?.averageTicket ?? 0;
 const inServiceToday =
 summary?.currentInChair ??
 activeToday.filter(
 (appointment) =>
 appointment.status ==="in_service"|| appointment.status ==="in_queue",
 ).length;
 const waitingToday = summary?.currentWaiting ?? 0;
 const queueCount = summary?.currentQueue ?? waitingToday;
 const completedToday = summary?.completedAppointments ?? 0;
 const activeAppointmentCount =
 summary?.todayActiveAppointments ?? activeToday.length;
 const appointmentCount = summary?.todayAppointments ?? todayAppointments.length;
 const completionRate = summary?.completionRate ?? 0;
 const closedOutToday = todayAppointments.filter(
 (appointment) =>
 appointment.status ==="cancelled"|| appointment.status ==="no_show",
 ).length;

 const uniqueClients = new Set(
 appointments.map(
 (appointment) =>
 appointment.client_id || appointment.client_phone || appointment.client_name,
 ),
 ).size;

 const todayFormatted = formatDateLabel(
 new Date(`${todayStr}T12:00:00`).toLocaleDateString("pt-BR", {
 weekday:"long",
 day:"numeric",
 month:"long",
 year:"numeric",
 }),
 );

 const upcomingAppointments = useMemo<UpcomingAppointment[]>(() => {
 const reportAppointments = operationalReport?.upcomingAppointments ?? [];
 if (reportAppointments.length > 0) {
 return reportAppointments.slice(0, 6).map((appointment) => ({
 id: appointment.id,
 clientName: appointment.clientName,
 professionalName: appointment.professionalName,
 serviceTitle: appointment.serviceTitle,
 timeSlot: appointment.timeSlot,
 status: appointment.status,
 finalAmount: appointment.finalAmount,
 }));
 }

 return activeToday.slice(0, 6).map((appointment) => ({
 id: appointment.id,
 clientName: appointment.client_name,
 professionalName: appointment.professional_name,
 serviceTitle: appointment.services?.[0]?.title ||"Serviço",
 timeSlot: appointment.time_slot,
 status: appointment.status,
 finalAmount: appointment.final_amount || 0,
 }));
 }, [activeToday, operationalReport?.upcomingAppointments]);

 const movement = operationalReport?.dailyMovement ?? [];
 const visibleMovement = movement.slice(-7);
 const maxMovement = Math.max(
 1,
 ...visibleMovement.map((item) => item.appointments),
 );
 const topServices = operationalReport?.topServices?.slice(0, 4) ?? [];
 const peakHour = operationalReport?.peakHour;

 return (
 <div className="admin-dashboard min-w-0 space-y-6 text-[var(--admin-text-main)]">
 <section className="admin-dashboard-hero"aria-labelledby="admin-dashboard-title">
 <div className="min-w-0">
 <p className="admin-dashboard-eyebrow">
 Operação <span aria-hidden="true">/</span> {todayFormatted}
 </p>
 <h1 id="admin-dashboard-title"className="admin-dashboard-title">
 Visão do dia
 </h1>
 <p className="admin-dashboard-subtitle">
 Acompanhe o ritmo da unidade, resolva pendências e mantenha a agenda fluindo.
 </p>
 </div>
 <div className="admin-dashboard-hero-actions">
 <div className="admin-dashboard-date"aria-label={`Data operacional: ${todayFormatted}`}>
 <CalendarClock className="h-4 w-4"/>
 <span>{todayFormatted}</span>
 </div>
 <button
 type="button"
 onClick={onNavigateToAgenda}
 className="admin-btn admin-btn-primary admin-dashboard-primary-action"
 >
 <CalendarCheck2 className="h-4 w-4"/>
 Abrir agenda
 </button>
 </div>
 </section>

 {!loading && pendingApprovalToday.length > 0 && (
 <div className="admin-dashboard-alert"role="status">
 <div className="admin-dashboard-alert-icon">
 <AlertTriangle className="h-4 w-4"/>
 </div>
 <div className="min-w-0 flex-1">
 <p className="admin-dashboard-alert-title">
 {pendingApprovalToday.length === 1
 ?"1 agendamento fora do expediente aguarda aprovação"
 : `${pendingApprovalToday.length} agendamentos fora do expediente aguardam aprovação`}
 </p>
 <p className="admin-dashboard-alert-copy">
 Revise a solicitação antes do próximo atendimento.
 </p>
 </div>
 <button
 type="button"
 onClick={onNavigateToAgenda}
 className="admin-btn admin-btn-ghost admin-dashboard-alert-action"
 >
 Revisar
 </button>
 </div>
 )}

 <section
 className="admin-dashboard-metric-grid"
 aria-busy={loading}
 aria-label="Resumo operacional"
 >
 {loading ? (
 <>
 <MetricSkeleton />
 <MetricSkeleton />
 <MetricSkeleton />
 <MetricSkeleton />
 </>
 ) : (
 <>
 <article className="admin-dashboard-metric is-emphasis">
 <div className="admin-dashboard-metric-label">
 <Banknote className="h-4 w-4"/>
 Recebido hoje
 </div>
 <p className="admin-dashboard-metric-value finance-positive">
 {formatCurrency(totalRevenueToday)}
 </p>
 <div className="admin-dashboard-metric-meta">
 <span>{completedToday} concluídos</span>
 <Trend current={totalRevenueToday} previous={comparison?.totalIncome} />
 </div>
 </article>

 <article className="admin-dashboard-metric">
 <div className="admin-dashboard-metric-label">
 <ListChecks className="h-4 w-4"/>
 Agenda de hoje
 </div>
 <p className="admin-dashboard-metric-value">{appointmentCount}</p>
 <div className="admin-dashboard-metric-meta">
 <span>{completionRate.toFixed(0)}% concluído</span>
 <Trend current={appointmentCount} previous={comparison?.appointments} />
 </div>
 </article>

 <article className="admin-dashboard-metric">
 <div className="admin-dashboard-metric-label">
 <Clock3 className="h-4 w-4"/>
 Na operação agora
 </div>
 <p className="admin-dashboard-metric-value">{activeAppointmentCount}</p>
 <div className="admin-dashboard-metric-meta">
 <span>{inServiceToday} em atendimento</span>
 <button type="button"onClick={onNavigateToQueue} className="admin-dashboard-inline-action">
 Ver fila
 </button>
 </div>
 </article>

 <article className={`admin-dashboard-metric ${pendingAmount > 0 ?"is-attention":""}`}>
 <div className="admin-dashboard-metric-label">
 <Wallet className="h-4 w-4"/>
 A acompanhar
 </div>
 <p className="admin-dashboard-metric-value">
 {formatCurrency(pendingAmount)}
 </p>
 <div className="admin-dashboard-metric-meta">
 <span>
 {pendingReceiptsCount === 0
 ?"Caixa em dia"
 : `${pendingReceiptsCount} pendências`}
 </span>
 {pendingReceiptsCount > 0 && (
 <button
 type="button"
 onClick={onNavigateToReceipts}
 className="admin-dashboard-inline-action"
 >
 Ver recebimentos
 </button>
 )}
 </div>
 </article>
 </>
 )}
 </section>

 <section className="admin-dashboard-live-grid"aria-label="Operação em tempo real">
 <article className="admin-dashboard-panel admin-dashboard-state-panel">
 <div className="admin-dashboard-panel-heading">
 <div>
 <p className="admin-dashboard-section-kicker">Agora</p>
 <h2 className="admin-dashboard-panel-title">Status da operação</h2>
 </div>
 <Activity className="admin-dashboard-panel-heading-icon h-5 w-5"/>
 </div>

 {loading ? (
 <div className="space-y-4">
 <AdminSkeleton className="h-12 w-full"/>
 <AdminSkeleton className="h-12 w-full"/>
 <AdminSkeleton className="h-12 w-full"/>
 </div>
 ) : (
 <div className="admin-dashboard-state-list">
 <button type="button"onClick={onNavigateToQueue} className="admin-dashboard-state-row">
 <span className="admin-dashboard-state-icon is-success">
 <UserCheck className="h-4 w-4"/>
 </span>
 <span className="min-w-0 flex-1 text-left">
 <span className="admin-dashboard-state-label">Em atendimento</span>
 <span className="admin-dashboard-state-caption">Cadeiras ocupadas agora</span>
 </span>
 <strong className="admin-dashboard-state-value">{inServiceToday}</strong>
 </button>

 <button type="button"onClick={onNavigateToQueue} className="admin-dashboard-state-row">
 <span className="admin-dashboard-state-icon is-info">
 <Users className="h-4 w-4"/>
 </span>
 <span className="min-w-0 flex-1 text-left">
 <span className="admin-dashboard-state-label">Aguardando</span>
 <span className="admin-dashboard-state-caption">Clientes na fila ou confirmados</span>
 </span>
 <strong className="admin-dashboard-state-value">{queueCount}</strong>
 </button>

 <div className="admin-dashboard-state-row is-static">
 <span className="admin-dashboard-state-icon is-muted">
 <CheckCircle2 className="h-4 w-4"/>
 </span>
 <span className="min-w-0 flex-1">
 <span className="admin-dashboard-state-label">Encerrados</span>
 <span className="admin-dashboard-state-caption">Cancelamentos e faltas hoje</span>
 </span>
 <strong className="admin-dashboard-state-value">{closedOutToday}</strong>
 </div>
 </div>
 )}

 <div className="admin-dashboard-state-footer">
 <span>
 {uniqueClients} clientes na base
 </span>
 {peakHour && (
 <span>
 Pico previsto: <strong>{peakHour.label}</strong>
 </span>
 )}
 </div>
 </article>

 <article className="admin-dashboard-panel admin-dashboard-upcoming-panel">
 <div className="admin-dashboard-panel-heading">
 <div>
 <p className="admin-dashboard-section-kicker">Próximos passos</p>
 <h2 className="admin-dashboard-panel-title">Próximos atendimentos</h2>
 </div>
 <button
 type="button"
 onClick={onNavigateToAgenda}
 className="admin-btn admin-btn-ghost admin-btn-sm"
 >
 Agenda
 </button>
 </div>

 {loading ? (
 <div className="space-y-3">
 <AdminSkeleton className="h-14 w-full"/>
 <AdminSkeleton className="h-14 w-full"/>
 <AdminSkeleton className="h-14 w-full"/>
 </div>
 ) : upcomingAppointments.length > 0 ? (
 <div className="admin-dashboard-upcoming-list">
 {upcomingAppointments.map((appointment) => (
 <div className="admin-dashboard-upcoming-row"key={appointment.id}>
 <time className="admin-dashboard-upcoming-time">{appointment.timeSlot ||"--:--"}</time>
 <div className="min-w-0 flex-1">
 <p className="admin-dashboard-upcoming-client">{appointment.clientName}</p>
 <p className="admin-dashboard-upcoming-meta">
 {appointment.serviceTitle} <span aria-hidden="true">·</span> {appointment.professionalName}
 </p>
 </div>
 <span className={`admin-dashboard-status ${STATUS_TONES[appointment.status] ||"is-neutral"}`}>
 <span className="admin-dashboard-status-dot"aria-hidden="true"/>
 {formatStatus(appointment.status)}
 </span>
 </div>
 ))}
 </div>
 ) : (
 <div className="admin-dashboard-empty">
 <CalendarClock className="h-7 w-7"/>
 <p>Nenhum atendimento pendente</p>
 <span>A agenda está livre por enquanto.</span>
 </div>
 )}
 </article>
 </section>

 <section className="admin-dashboard-insight-grid"aria-label="Ritmo e fechamento">
 <article className="admin-dashboard-panel admin-dashboard-movement-panel">
 <div className="admin-dashboard-panel-heading">
 <div>
 <p className="admin-dashboard-section-kicker">Ritmo da operação</p>
 <h2 className="admin-dashboard-panel-title">Atendimentos recentes</h2>
 </div>
 <span className="admin-dashboard-panel-context">
 {visibleMovement.length || 0} dias
 </span>
 </div>

 {loading ? (
 <div className="space-y-4">
 <AdminSkeleton className="h-5 w-full"/>
 <AdminSkeleton className="h-5 w-4/5"/>
 <AdminSkeleton className="h-5 w-3/5"/>
 </div>
 ) : visibleMovement.length > 0 ? (
 <div className="admin-dashboard-movement-list">
 {visibleMovement.map((item) => (
 <div className="admin-dashboard-movement-row"key={item.date}>
 <span className="admin-dashboard-movement-label">{item.label}</span>
 <div className="admin-dashboard-movement-track"aria-hidden="true">
 <span
 className="admin-dashboard-movement-bar"
 style={{ width: `${Math.max(6, (item.appointments / maxMovement) * 100)}%` }}
 />
 </div>
 <span className="admin-dashboard-movement-value">{item.appointments}</span>
 </div>
 ))}
 </div>
 ) : (
 <div className="admin-dashboard-empty is-compact">
 <p>Sem dados de movimento para exibir</p>
 </div>
 )}

 {topServices.length > 0 && (
 <div className="admin-dashboard-top-services">
 <div className="admin-dashboard-subsection-heading">
 <span>Serviços mais procurados</span>
 <span>Atendimentos</span>
 </div>
 {topServices.map((service) => (
 <div className="admin-dashboard-service-row"key={service.serviceTitle}>
 <span className="min-w-0 truncate">{service.serviceTitle}</span>
 <strong>{service.count}</strong>
 </div>
 ))}
 </div>
 )}
 </article>

 <article className="admin-dashboard-panel admin-dashboard-finance-panel">
 <div className="admin-dashboard-panel-heading">
 <div>
 <p className="admin-dashboard-section-kicker">Fechamento parcial</p>
 <h2 className="admin-dashboard-panel-title">Caixa sob controle</h2>
 </div>
 <Receipt className="admin-dashboard-panel-heading-icon h-5 w-5"/>
 </div>

 <div className="admin-dashboard-finance-primary">
 <span>Recebido hoje</span>
 <strong>{formatCurrency(totalRevenueToday)}</strong>
 <Trend current={totalRevenueToday} previous={comparison?.totalIncome} />
 </div>

 <div className="admin-dashboard-finance-list">
 <div className="admin-dashboard-finance-row">
 <span><Wallet className="h-4 w-4"/>A receber</span>
 <strong className={pendingAmount > 0 ?"text-status-warning":""}>{formatCurrency(pendingAmount)}</strong>
 </div>
 <div className="admin-dashboard-finance-row">
 <span><Banknote className="h-4 w-4"/>Ticket médio</span>
 <strong>{formatCurrency(ticketMedio)}</strong>
 </div>
 <div className="admin-dashboard-finance-row">
 <span><Clock3 className="h-4 w-4"/>Pico do dia</span>
 <strong>{peakHour?.label ||"Sem previsão"}</strong>
 </div>
 </div>

 <div className="admin-dashboard-finance-footer">
 <span>{pendingReceiptsCount === 0 ?"Nenhuma pendência financeira": `${pendingReceiptsCount} recebimentos aguardando confirmação`}</span>
 {pendingReceiptsCount > 0 && (
 <button type="button"onClick={onNavigateToReceipts} className="admin-btn admin-btn-secondary admin-btn-sm">
 Abrir recebimentos
 </button>
 )}
 </div>
 </article>
 </section>

 {historyToday.length > 0 && (
 <section className="admin-dashboard-panel admin-dashboard-history-panel">
 <button
 type="button"
 onClick={() => setShowHistory((visible) => !visible)}
 className="admin-dashboard-history-toggle"
 aria-expanded={showHistory}
 >
 <span>
 Histórico de hoje <strong>({historyToday.length})</strong>
 </span>
 {showHistory ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
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
 </section>
 )}
 </div>
 );
};
