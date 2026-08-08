import React from 'react';
import { Clock, DollarSign, Calendar as CalendarIcon, User } from 'lucide-react';
import { ServiceItem, Professional } from '../../types';

interface BookingSummaryCardProps {
  selectedServices: ServiceItem[];
  selectedBarber: Professional | null;
  selectedDate: string;
  selectedTimeSlot: string;
}

export const BookingSummaryCard: React.FC<BookingSummaryCardProps> = ({
  selectedServices,
  selectedBarber,
  selectedDate,
  selectedTimeSlot,
}) => {
  if (selectedServices.length === 0) {
    return null;
  }

  const mainService = selectedServices[0];
  const additionalServicesCount = selectedServices.length - 1;
  
  const totalDuration = selectedServices.reduce((acc, curr) => acc + curr.duration_minutes, 0);
  const totalPrice = selectedServices.reduce((acc, curr) => acc + curr.price, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}`;
  };

  return (
    <div className="px-4 py-4">
      <div className="bg-border-subtle backdrop-blur-[10px] border border-border-subtle rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
        {/* Image/Avatar Area */}
        <div className="w-16 h-16 rounded-xl bg-surface-card flex items-center justify-center overflow-hidden flex-shrink-0">
          {selectedBarber && selectedBarber.avatar_url ? (
            <img src={selectedBarber.avatar_url} alt={selectedBarber.name} className="w-full h-full object-cover opacity-60" />
          ) : (
            <User className="w-8 h-8 text-content-muted opacity-60" />
          )}
        </div>

        {/* Info Area */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-content-base truncate">
            {mainService.title}
            {additionalServicesCount > 0 && ` +${additionalServicesCount}`}
          </h3>
          
          <p className="text-xs text-content-muted mb-2 truncate">
            {selectedBarber ? `com ${selectedBarber.name}` : 'Profissional não selecionado'}
          </p>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-[10px] text-content-muted">
              <Clock className="w-3 h-3" />
              <span>{totalDuration} min</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-content-base">
              <DollarSign className="w-3 h-3" />
              <span>{formatCurrency(totalPrice)}</span>
            </div>
          </div>
        </div>
        
        {/* Date & Time (if selected) */}
        {selectedDate && selectedTimeSlot && (
          <div className="absolute right-4 top-4 flex flex-col items-end">
            <div className="text-content-base px-2 py-1 rounded text-[10px] font-bold flex items-center">
              <CalendarIcon className="w-3 h-3 mr-1" />
              {formatDate(selectedDate)}
            </div>
            <div className="text-content-base text-xs font-bold mt-1 pr-2">
              {selectedTimeSlot}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
