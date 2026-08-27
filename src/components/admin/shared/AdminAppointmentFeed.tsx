import React from"react";
import { ArrowRight, Clock, LucideIcon } from"lucide-react";
import { Appointment } from"../../../types";
import { AdminSkeleton } from"./AdminSkeleton";
import { AdminEmptyState } from"./AdminEmptyState";

interface AdminAppointmentFeedProps {
 appointments: Appointment[];
 onNavigateToAgenda: () => void;
 loading?: boolean;
 /** Permite reaproveitar o feed em contextos diferentes (ex: histórico) sem repetir o texto padrão. */
 emptyIcon?: LucideIcon;
 emptyTitle?: string;
 emptyDescription?: string;
 emptyActionLabel?: string;
 /** Quando false, oculta o CTA do estado vazio (ex: dentro de uma seção de histórico já colapsável). */
 showEmptyAction?: boolean;
}

const statusLabel: Record<string, string> = {
 confirmed:"Confirmado",
 pending_approval:"Aguardando aprovação",
 in_queue:"Na fila",
 in_service:"Em atendimento",
 in_chair:"Em atendimento",
 completed:"Finalizado",
 cancelled:"Cancelado",
 no_show:"Não compareceu",
};

const statusClass: Record<string, string> = {
 confirmed:"text-[var(--admin-accent)]",
 pending_approval:"text-status-warning",
 in_queue:"text-status-warning",
 in_service:"text-status-success",
 in_chair:"text-status-success",
 completed:"text-status-info",
 cancelled:"text-status-error",
 no_show:"text-status-error",
};

export const AdminAppointmentFeed: React.FC<AdminAppointmentFeedProps> = ({
 appointments,
 onNavigateToAgenda,
 loading = false,
 emptyIcon: EmptyIcon = Clock,
 emptyTitle ="Nenhum agendamento hoje",
 emptyDescription ="A agenda está livre por enquanto.",
 emptyActionLabel ="Abrir agenda",
 showEmptyAction = true,
}) => (
 <div className="divide-y divide-[var(--admin-border)]">
 {loading ? (
 <div
 className="space-y-3 px-4 py-5"
 aria-label="Carregando atendimentos"
 aria-busy="true"
 >
 {[1, 2, 3].map((item) => (
 <div
 key={item}
 className="flex items-center gap-3 rounded-[var(--admin-radius-md)] bg-[var(--admin-bg)]/70 px-2 py-2"
 >
 <AdminSkeleton className="h-8 w-8 shrink-0 rounded-[var(--admin-radius-md)]"/>
 <div className="min-w-0 flex-1 space-y-2">
 <AdminSkeleton className="h-2.5 w-2/5"/>
 <AdminSkeleton className="h-2.5 w-3/5"/>
 </div>
 <AdminSkeleton className="h-7 w-12 shrink-0 rounded-[var(--admin-radius-sm)]"/>
 </div>
 ))}
 </div>
 ) : appointments.length === 0 ? (
 <AdminEmptyState
 icon={EmptyIcon}
 title={emptyTitle}
 description={emptyDescription}
 actionLabel={showEmptyAction ? emptyActionLabel : undefined}
 onAction={showEmptyAction ? onNavigateToAgenda : undefined}
 />
 ) : (
 appointments.map((appointment) => {
 const serviceName =
 Array.isArray(appointment.services) && appointment.services.length > 0
 ? typeof appointment.services[0] ==="string"
 ? appointment.services[0]
 : appointment.services[0].title
 :"Atendimento de barbearia";
 const status = appointment.status as string;
 return (
 <div
 key={appointment.id}
 className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(150px,1.2fr)_minmax(180px,1.5fr)_auto_auto_auto] items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-[var(--admin-bg)]/50"
 >
 <div className="flex items-center gap-3 min-w-0">
 <div
 className="w-8 h-8 rounded-[var(--admin-radius-sm)] bg-[var(--admin-bg)] border border-[var(--admin-border)] text-[var(--admin-accent)] font-serif font-bold text-xs flex items-center justify-center shrink-0"
 aria-hidden="true"
 >
 {appointment.client_name
 ? appointment.client_name.charAt(0).toUpperCase()
 :"C"}
 </div>
 <div className="min-w-0">
 <p className="admin-text-body font-bold truncate">
 {appointment.client_name ||"Cliente"}
 </p>
 <p className="admin-text-small truncate md:hidden">
 {serviceName}
 </p>
 </div>
 </div>

 <p className="hidden md:block admin-text-small truncate">
 <span className="text-[var(--admin-text-main)] font-medium">
 {serviceName}
 </span>
 <span className="mx-1">·</span>
 <span className="text-[var(--admin-accent)] font-bold">
 {appointment.professional_name ||"Barbeiro"}
 </span>
 </p>

 <p className="text-right tabular-nums whitespace-nowrap admin-text-body font-bold">
 {appointment.time_slot ||"--:--"}
 </p>
 <p className="hidden md:block text-right tabular-nums whitespace-nowrap admin-text-body font-bold finance-positive">
 R${""}
 {appointment.final_amount
 ? appointment.final_amount.toFixed(2)
 :"0,00"}
 </p>
 <div className="flex items-center justify-end gap-3">
 <span
 className={`admin-label whitespace-nowrap ${statusClass[status] ||"text-[var(--admin-text-muted)]"}`}
 >
 {statusLabel[status] ||"Status"}
 </span>
 <button
 type="button"
 onClick={onNavigateToAgenda}
 className="admin-btn-icon-sm admin-btn-secondary rounded-[var(--admin-radius-sm)]"
 aria-label="Ver agendamento na agenda"
 >
 <ArrowRight className="w-4 h-4"/>
 </button>
 </div>
 </div>
 );
 })
 )}
 </div>
);
