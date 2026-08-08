import React from 'react';
import { LandingPage } from './LandingPage';

interface ClientHomeProps {
  currentUser?: any;
  isGuest?: boolean;
  upcomingCount?: number;
  onGoToBooking: (service?: any) => void;
  onGoToAppointments?: () => void;
  onOpenLogin?: () => void;
  onOpenProfile?: () => void;
  onOpenSubscriptions?: () => void;
  onOpenLoyalty?: () => void;
}

export const ClientHome: React.FC<ClientHomeProps> = ({ onGoToBooking, onGoToAppointments }) => {
  return <LandingPage onGoToBooking={onGoToBooking} onGoToAppointments={onGoToAppointments} />;
};
