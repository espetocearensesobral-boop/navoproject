import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  User, 
  Crown, 
  Award, 
  Sun, 
  Moon, 
  LogOut, 
  LogIn, 
  ChevronRight, 
  Sparkles,
  X,
  Sliders,
  AlertTriangle,
  Home,
  Calendar,
  Clock
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
  const { theme, setTheme } = useTheme();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-surface-base/80 backdrop-blur-sm"
        />

        {/* Drawer Container */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="relative w-full max-w-md bg-surface-card border-t sm:border border-border-subtle rounded-t-3xl sm:rounded-modal p-5 sm:p-6 shadow-2xl z-10 space-y-5 max-h-[85vh] overflow-y-auto no-scrollbar"
        >
          {/* Drag handle */}
          <div className="w-12 h-1 bg-border-subtle rounded-full mx-auto -mt-1 mb-2 sm:hidden" />

          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-gold-base" />
              <h2 className="text-base font-serif text-content-base font-semibold">Menu & Configurações</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-btn bg-surface-base hover:bg-surface-card text-content-muted hover:text-content-base transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Card */}
          {!isGuest && (
            <div 
              onClick={() => {
                onClose();
                onOpenProfile();
              }}
              className="bg-surface-base/80 p-4 rounded-card border border-border-subtle flex items-center justify-between cursor-pointer hover:border-gold-base/50 transition-all"
            >
              <div className="flex items-center gap-3">
                <img
                  src={currentUser.avatar_url || currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=75&w=150'}
                  alt={currentUser.name}
                  className="w-11 h-11 rounded-full object-cover border border-gold-base/50"
                />
                <div>
                  <h3 className="text-sm font-serif text-content-base font-semibold">{currentUser.name}</h3>
                  <span className="text-[10px] text-content-muted font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-gold-base" />
                    <span>{currentUser.loyalty_points || 0} Pts • {currentUser.loyalty_tier || 'Bronze'}</span>
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-content-muted" />
            </div>
          )}

          {/* Navigation Options List */}
          <div className="space-y-2">
            <button
              onClick={() => {
                hapticLight();
                onClose();
                if (onNavigate) onNavigate('home');
              }}
              className="w-full bg-surface-base/50 hover:bg-surface-base p-3.5 rounded-btn border border-border-subtle/60 flex items-center justify-between transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-btn bg-gold-base/10 text-gold-base flex items-center justify-center">
                  <Home className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-content-base">Início</div>
                  <div className="text-[10px] text-content-muted">Página principal</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-content-muted" />
            </button>
            <button
              onClick={() => {
                hapticLight();
                onClose();
                if (onNavigate) onNavigate('booking');
              }}
              className="w-full bg-surface-base/50 hover:bg-surface-base p-3.5 rounded-btn border border-border-subtle/60 flex items-center justify-between transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-btn bg-gold-base/10 text-gold-base flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-content-base">Agendar</div>
                  <div className="text-[10px] text-content-muted">Novo corte ou serviço</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-content-muted" />
            </button>
            <button
              onClick={() => {
                hapticLight();
                onClose();
                if (onNavigate) onNavigate('appointments');
              }}
              className="w-full bg-surface-base/50 hover:bg-surface-base p-3.5 rounded-btn border border-border-subtle/60 flex items-center justify-between transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-btn bg-gold-base/10 text-gold-base flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-content-base">Meus Cortes</div>
                  <div className="text-[10px] text-content-muted">Histórico e agendamentos</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-content-muted" />
            </button>

            <div className="h-px bg-border-subtle w-full my-2"></div>

            {!isGuest && (
              <button
                onClick={() => {
                  hapticLight();
                  onClose();
                  onOpenProfile();
                }}
                className="w-full bg-surface-base/50 hover:bg-surface-base p-3.5 rounded-btn border border-border-subtle/60 flex items-center justify-between transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-btn bg-gold-base/10 text-gold-base flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-content-base">Meu Perfil</div>
                    <div className="text-[10px] text-content-muted">Editar dados e preferências</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-content-muted" />
              </button>
            )}

            <button
              onClick={() => {
                hapticLight();
                onClose();
                if (isGuest) {
                  onOpenLogin();
                } else {
                  onOpenSubscriptions();
                }
              }}
              className="w-full bg-surface-base/50 hover:bg-surface-base p-3.5 rounded-btn border border-border-subtle/60 flex items-center justify-between transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-btn bg-gold-base/10 text-gold-base flex items-center justify-center">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-content-base">Assinaturas VIP</div>
                  <div className="text-[10px] text-content-muted">Planos mensais e cortes ilimitados</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-content-muted" />
            </button>

            <button
              onClick={() => {
                hapticLight();
                onClose();
                if (isGuest) {
                  onOpenLogin();
                } else {
                  onOpenLoyalty();
                }
              }}
              className="w-full bg-surface-base/50 hover:bg-surface-base p-3.5 rounded-btn border border-border-subtle/60 flex items-center justify-between transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-btn bg-gold-base/10 text-gold-base flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-content-base">Programa de Fidelidade</div>
                  <div className="text-[10px] text-content-muted">Seus pontos e recompensas</div>
                </div>
              </div>
              {!isGuest && (
                <span className="px-2 py-0.5 rounded-badge bg-gold-base/20 border border-gold-base/30 text-gold-hover text-[10px] font-extrabold">
                  {currentUser.loyalty_points || 0} pts
                </span>
              )}
            </button>

          </div>

          {/* Footer Logout/Login Action */}
          <div className="pt-2 border-t border-border-subtle">
            
            {/* Theme Toggle */}
            <button
              onClick={() => {
                hapticLight();
                setTheme(theme === 'dark' ? 'light' : 'dark');
              }}
              className="w-full bg-surface-base/50 hover:bg-surface-base p-3.5 rounded-btn border border-border-subtle/60 flex items-center justify-between transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-btn bg-gold-base/10 text-gold-base flex items-center justify-center">
                  {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-content-base">Aparência</div>
                  <div className="text-[10px] text-content-muted">{theme === 'dark' ? 'Tema Escuro (Noir)' : 'Tema Claro (Heritage)'}</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-content-muted" />
            </button>
            <div className="h-px bg-border-subtle w-full my-2"></div>


            {!isGuest ? (
              <button
                onClick={() => {
                  hapticMedium();
                  setShowLogoutConfirm(true);
                }}
                className="w-full p-3.5 rounded-btn bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da Conta</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  hapticMedium();
                  onClose();
                  onOpenLogin();
                }}
                className="w-full p-3.5 rounded-btn bg-gold-base hover:bg-gold-hover text-content-on-accent text-xs font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                <span>Fazer Login ou Criar Conta</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>

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
