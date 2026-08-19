import React from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import { Appointment } from '../../../types';

interface AdminAppointmentFeedProps {
  appointments: Appointment[];
  onNavigateToAgenda: () => void;
  loading?: boolean;
}

const statusLabel: Record<string, string> = {
  confirmed: 'Confirmado',
  pending_approval: 'Aguardando aprovação',
  in_queue: 'Na fila',
  in_service: 'Em atendimento',
  in_chair: 'Em atendimento',
  completed: 'Finalizado',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};

const statusClass: Record<string, string> = {
  confirmed: 'text-gold-base',
  pending_approval: 'text-amber-400',
  in_queue: 'text-amber-400',
  in_service: 'text-status-success',
  in_chair: 'text-status-success',
  completed: 'text-blue-400',
  cancelled: 'text-status-error',
  no_show: 'text-status-error',
};

export const AdminAppointmentFeed: React.FC<AdminAppointmentFeedProps> = ({ appointments, onNavigateToAgenda, loading = false }) => (
  <div className="divide-y divide-border-subtle">
    {loading ? (
      <div className="space-y-3 px-4 py-5" aria-label="Carregando atendimentos">
        {[1, 2, 3].map((item) => <div key={item} className="h-10 rounded-lg bg-surface-base" />)}
      </div>
    ) : appointments.length === 0 ? (
      <div className="py-10 px-4 text-center text-content-muted">
        <Clock className="w-6 h-6 text-content-muted mx-auto mb-2" aria-hidden="true" />
        <p className="text-xs font-medium">Nenhum agendamento hoje.</p>
        <button type="button" onClick={onNavigateToAgenda} className="mt-2 text-xs font-bold text-gold-base hover:underline">
          Abrir agenda completa
        </button>
      </div>
    ) : appointments.map((appointment) => {
      const serviceName = Array.isArray(appointment.services) && appointment.services.length > 0
        ? (typeof appointment.services[0] === 'string' ? appointment.services[0] : appointment.services[0].title)
        : 'Atendimento de barbearia';
      const status = appointment.status as string;
      return (
        <div
          key={appointment.id}
          className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(150px,1.2fr)_minmax(180px,1.5fr)_auto_auto_auto] items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-surface-base/50"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-surface-base border border-border-subtle text-gold-base font-serif font-bold text-xs flex items-center justify-center shrink-0" aria-hidden="true">
              {appointment.client_name ? appointment.client_name.charAt(0).toUpperCase() : 'C'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-content-base truncate">{appointment.client_name || 'Cliente'}</p>
              <p className="text-xs text-content-muted truncate md:hidden">{serviceName}</p>
            </div>
          </div>

          <p className="hidden md:block text-xs text-content-muted truncate">
            <span className="text-content-base font-medium">{serviceName}</span>
            <span className="mx-1">·</span>
            <span className="text-gold-base font-bold">{appointment.professional_name || 'Barbeiro'}</span>
          </p>

          <p className="text-right num-tabular whitespace-nowrap text-xs font-bold text-content-base">
            {appointment.time_slot || '--:--'}
          </p>
          <p className="hidden md:block text-right num-tabular whitespace-nowrap text-xs font-bold finance-positive">
            R$ {appointment.final_amount ? appointment.final_amount.toFixed(2) : '0,00'}
          </p>
          <div className="flex items-center justify-end gap-2">
            <span className={`text-[10px] font-bold whitespace-nowrap ${statusClass[status] || 'text-content-muted'}`}>
              {statusLabel[status] || 'Status'}
            </span>
            <button
              type="button"
              onClick={onNavigateToAgenda}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border-subtle text-content-muted hover:text-gold-base"
              aria-label="Ver agendamento na agenda"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      );
    })}
  </div>
);
