import React, { lazy, Suspense, useState, useMemo } from 'react';
import { Appointment } from '../../types';
import { X, Search, FileText, Calendar, Clock } from 'lucide-react';
const AppointmentDetailsModal = lazy(() => import('./AppointmentDetailsModal').then(m => ({ default: m.AppointmentDetailsModal })));

interface FullHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: Appointment[];
  onAppointmentUpdated?: (updated: Appointment) => void;
  onReviewClick?: (appointment: Appointment) => void;
}

export const FullHistoryModal: React.FC<FullHistoryModalProps> = ({
  isOpen,
  onClose,
  appointments,
  onAppointmentUpdated,
  onReviewClick
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const matchesSearch = apt.services.some(s => s.title.toLowerCase().includes(searchTerm.toLowerCase())) || 
                            apt.professional_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            apt.date.includes(searchTerm);
      const matchesStatus = filterStatus === 'all' || apt.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [appointments, searchTerm, filterStatus]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-surface-base/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:w-[600px] h-[90vh] sm:h-[80vh] bg-surface-base rounded-3xl border border-border-subtle shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
        
        <div className="p-5 border-b border-border-subtle flex items-center justify-between shrink-0">
          <h2 className="text-lg font-serif text-content-base font-semibold">Histórico Completo</h2>
          <button onClick={onClose} className="p-1.5 rounded-full bg-border-subtle backdrop-blur-[10px] text-content-muted hover:text-content-base transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 border-b border-border-subtle space-y-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-content-muted" />
            <input 
              type="text"
              placeholder="Buscar por serviço, barbeiro ou data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-border-subtle backdrop-blur-[10px] border border-border-subtle rounded-xl py-2.5 pl-10 pr-4 text-sm text-content-base focus:outline-none focus:border-gold-base"
            />
          </div>
          <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
            {['all', 'confirmed', 'in_service', 'in_queue', 'completed', 'cancelled'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  filterStatus === status ? 'bg-gold-base text-surface-base font-extrabold shadow-sm' : 'bg-border-subtle backdrop-blur-[10px] text-content-muted hover:bg-surface-card'
                }`}
              >
                {status === 'all' ? 'Todos' : 
                 status === 'confirmed' ? 'Confirmados' : 
                 status === 'in_service' ? 'Em Atendimento' : 
                 status === 'in_queue' ? 'Na Fila' : 
                 status === 'completed' ? 'Concluídos' : 'Cancelados'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-3">
            {filteredAppointments.length === 0 ? (
              <div className="text-center py-10 text-content-muted">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum agendamento encontrado.</p>
              </div>
            ) : (
              filteredAppointments.map(apt => (
                <div
                  key={apt.id}
                  onClick={() => setSelectedAppointment(apt)}
                  className="bg-border-subtle p-3 rounded-2xl border border-border-subtle flex flex-col space-y-2 hover:border-gold-base/50 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-gold-base" />
                      <span className="font-bold text-content-base capitalize">{apt.date} às {apt.time_slot}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      apt.status === 'in_queue' ? 'bg-status-warning/20 text-[#FF8C00]' : 
                      apt.status === 'in_service' ? 'bg-status-success/20 text-status-success' : 
                      apt.status === 'confirmed' ? 'bg-status-success/20 text-status-success' : 
                      apt.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                      'bg-surface-card text-content-muted'
                    }`}>
                      {apt.status === 'in_queue' && 'Fila'}
                      {apt.status === 'in_service' && 'Atendimento'}
                      {apt.status === 'confirmed' && 'Confirmado'}
                      {apt.status === 'completed' && 'Concluído'}
                      {apt.status === 'cancelled' && 'Cancelado'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border-subtle">
                    <div className="text-content-base font-medium truncate max-w-[240px]">
                      {apt.services.map(s => s.title).join(', ')}
                    </div>
                    <div className="font-black text-status-success whitespace-nowrap">
                      R$ {Number(apt.final_amount).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {selectedAppointment && (
        <Suspense fallback={null}>
          <AppointmentDetailsModal
            isOpen
            onClose={() => setSelectedAppointment(null)}
            appointment={selectedAppointment}
            onAppointmentUpdated={(updated) => {
              setSelectedAppointment(updated);
              if (onAppointmentUpdated) {
                onAppointmentUpdated(updated);
              }
            }}
            onReviewClick={() => {
              if (selectedAppointment && onReviewClick) {
                onReviewClick(selectedAppointment);
              }
            }}
          />
        </Suspense>
      )}
    </div>
  );
};
