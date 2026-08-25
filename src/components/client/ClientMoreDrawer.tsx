import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  AlertTriangle,
  X
} from 'lucide-react';

interface ClientMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  isGuest: boolean;
  onNavigate?: (tab: string) => void;
  onOpenProfile: () => void;
  onOpenSubscriptions: () => void;
  onOpenLoyalty: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  onOpenInstall?: () => void;
}

export const ClientMoreDrawer: React.FC<ClientMoreDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  isGuest,
  onNavigate,
  onOpenProfile,
  onOpenSubscriptions,
  onOpenLoyalty,
  onOpenLogin,
  onLogout,
  onOpenInstall,
}) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center gap-8 p-4"
          >
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-11 h-11 rounded-full bg-white/8 border border-white/10 text-white flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
              aria-label="Fechar menu"
            >
              <X className="w-6 h-6" />
            </button>

            <motion.button
              initial={reducedMotion ? {} : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              onClick={() => {
                hapticLight();
                onClose();
                if (onNavigate) onNavigate('home');
              }}
              className="text-gold-base text-2xl font-semibold hover:opacity-100 transition-opacity cursor-pointer"
            >
              Início
            </motion.button>

            <motion.button
              initial={reducedMotion ? {} : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => {
                hapticLight();
                onClose();
                if (onNavigate) onNavigate('booking');
              }}
              className="text-gold-base text-2xl font-semibold hover:opacity-100 transition-opacity cursor-pointer"
            >
              Agendar Agora
            </motion.button>

            <motion.button
              initial={reducedMotion ? {} : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              onClick={() => {
                hapticLight();
                onClose();
                if (onNavigate) onNavigate('appointments');
              }}
              className="text-gold-base text-2xl font-semibold hover:opacity-100 transition-opacity flex items-center gap-2 cursor-pointer"
            >
              Meus Cortes
            </motion.button>

            <div className="w-16 h-px bg-white/15 my-1" />

            <motion.button
              initial={reducedMotion ? {} : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => {
                hapticLight();
                onClose();
                if (isGuest) {
                  onOpenLogin();
                } else {
                  onOpenSubscriptions();
                }
              }}
              className="text-white text-2xl font-semibold opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
            >
              Assinaturas VIP
            </motion.button>

            <motion.button
              initial={reducedMotion ? {} : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              onClick={() => {
                hapticLight();
                onClose();
                if (isGuest) {
                  onOpenLogin();
                } else {
                  onOpenLoyalty();
                }
              }}
              className="text-white text-2xl font-semibold opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
            >
              Fidelidade
            </motion.button>

            <div className="w-16 h-px bg-white/15 my-1" />

            {isGuest ? (
              <motion.button
                initial={reducedMotion ? {} : { opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => {
                  hapticLight();
                  onClose();
                  onOpenLogin();
                }}
                className="text-white text-2xl font-semibold hover:opacity-100 transition-opacity flex items-center gap-2 cursor-pointer"
              >
                Entrar / Criar Conta
              </motion.button>
            ) : (
              <motion.button
                initial={reducedMotion ? {} : { opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => {
                  hapticMedium();
                  setShowLogoutConfirm(true);
                }}
                className="text-red-400 text-2xl font-semibold hover:opacity-100 transition-opacity cursor-pointer"
              >
                Sair da Conta
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          onClose();
          onLogout();
        }}
        variant="danger"
        icon={<AlertTriangle className="w-6 h-6" />}
        title="Deseja sair da conta?"
        description="Ao sair da conta, você precisará fazer login novamente para acessar seus benefícios do clube VIP e histórico sincronizado."
        confirmText="Sim, Sair"
        cancelText="Permanecer Conectado"
      />
    </>
  );
};
