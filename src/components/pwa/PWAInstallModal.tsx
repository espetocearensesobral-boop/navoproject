import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Download, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  X, 
  Share2,
  ChevronRight,
  PlusSquare,
  MoreVertical
} from 'lucide-react';
import { usePWA } from '../../usePWA';
import { motion, AnimatePresence } from 'motion/react';
import { hapticLight, hapticSuccess } from '../../lib/haptics';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose, onShowToast }) => {
  const { canInstall, isInstalled, installApp } = usePWA();
  const [installing, setInstalling] = useState(false);
  const [activeTab, setActiveTab] = useState<'android' | 'ios'>('android');

  const handleInstall = async () => {
    hapticLight();
    setInstalling(true);
    try {
      await installApp();
      if (canInstall === false) {
        hapticSuccess();
        if (onShowToast) onShowToast('Instalação iniciada!', 'success');
        onClose();
      } else {
        if (onShowToast) onShowToast('Siga as instruções abaixo para adicionar à tela inicial', 'info');
      }
    } catch (err) {
      if (onShowToast) onShowToast('Siga os passos de instalação para o seu dispositivo', 'info');
    } finally {
      setInstalling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-surface-base/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-surface-base border border-border-subtle rounded-3xl shadow-2xl overflow-hidden p-6 text-content-base relative my-8 font-sans"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-1 rounded-full hover:bg-surface-card text-content-muted hover:text-content-base transition-colors"
            title="Fechar"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gold-base flex items-center justify-center text-surface-base shrink-0">
              <Smartphone className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[22px] font-bold text-content-base tracking-tight">Instalar no Celular</h2>
                <span className="px-2 py-0.5 rounded-full border border-gold-base/50 text-[10px] text-gold-base font-bold uppercase tracking-wider">
                  PWA
                </span>
              </div>
              <p className="text-sm text-content-muted mt-1 leading-tight">Adicione o atalho na tela inicial e acesse com 1 toque.</p>
            </div>
          </div>

          {/* Automatic Install Section */}
          <div className="bg-surface-card rounded-2xl p-5 mb-8">
            <div className="flex gap-4 items-start mb-5">
              <div className="px-2.5 py-1 rounded-lg bg-gold-base/10 border border-gold-base/20 flex items-center gap-1.5 text-gold-base shrink-0">
                <Zap className="w-3.5 h-3.5" fill="currentColor" />
                <span className="text-xs font-bold">Automático</span>
              </div>
              <div className="text-sm">
                <p className="text-content-base font-medium">Instale em segundos.</p>
                <p className="text-content-muted mt-0.5">Sem loja, sem ocupar espaço.</p>
              </div>
            </div>

            <button
              onClick={handleInstall}
              disabled={installing}
              className="w-full py-4 px-4 bg-gold-base hover:brightness-110 text-surface-base font-bold text-[17px] rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Download className="w-5 h-5" strokeWidth={2} />
              <span>Adicionar à Tela Inicial</span>
            </button>
          </div>

          {/* Manual Install Section */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-bold text-content-muted uppercase tracking-wider">Como instalar</h3>
            
            <div className="bg-surface-card/50 rounded-2xl p-5">
              <div className="flex bg-surface-base/50 p-1.5 rounded-2xl mb-8">
                <button
                  onClick={() => { setActiveTab('android'); hapticLight(); }}
                  className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-[13px] ${activeTab === 'android' ? 'bg-gold-base text-surface-base font-bold shadow-sm' : 'text-content-muted hover:text-content-base font-medium'}`}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" className="hidden"/>
                    {/* Chrome logo simplified path */}
                    <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 100-16 8 8 0 000 16z" opacity="0.3"/>
                    <path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"/>
                    <path d="M12 8.5l4.8 8.32a8 8 0 00-9.6 0L12 8.5z"/>
                    <path d="M15.5 14.5l-9.6 0A8 8 0 0012 22l3.5-7.5z"/>
                    <path d="M8.5 14.5l4.8-8.32a8 8 0 00-7.3 12.6l2.5-4.28z"/>
                  </svg>
                  Android (Chrome)
                </button>
                <button
                  onClick={() => { setActiveTab('ios'); hapticLight(); }}
                  className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-[13px] ${activeTab === 'ios' ? 'bg-gold-base text-surface-base font-bold shadow-sm' : 'text-content-muted hover:text-content-base font-medium'}`}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                    <path d="M12 20.575C12 20.575 14.4 20.175 15.6 18.975C16.8 17.775 17.2 16.175 17.2 16.175C17.2 16.175 15.6 16.175 14.4 17.375C13.2 18.575 12 20.575 12 20.575ZM16.346 14.175C16.346 12.355 17.848 11.233 17.915 11.191C16.993 9.851 15.545 9.645 15.034 9.58C13.882 9.467 12.776 10.274 12.181 10.274C11.586 10.274 10.672 9.59 9.697 9.609C8.423 9.628 7.251 10.355 6.594 11.493C5.253 13.832 6.252 17.288 7.558 19.167C8.196 20.088 8.941 21.118 9.92 21.082C10.871 21.045 11.238 20.472 12.378 20.472C13.518 20.472 13.85 21.082 14.839 21.045C15.86 21 16.505 20.093 17.135 19.16C17.868 18.093 18.173 17.054 18.192 17.001C18.156 16.985 16.346 16.29 16.346 14.175Z" />
                  </svg>
                  iOS (Safari)
                </button>
              </div>

              {activeTab === 'android' ? (
                <div className="flex justify-between items-start text-center relative">
                  <div className="absolute top-6 left-[15%] right-[15%] h-[1px] bg-border-subtle" />
                  
                  <div className="relative z-10 flex flex-col items-center w-1/3 px-1">
                    <div className="w-12 h-12 rounded-full bg-surface-base flex items-center justify-center text-gold-base mb-3 shadow-sm border border-border-subtle">
                      <Share2 className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                    <p className="text-[11px] text-content-base leading-tight font-medium">Toque no menu<br/>compartilhar</p>
                  </div>
                  
                  <div className="absolute top-10 left-[33%] -translate-x-1/2 text-border-subtle z-20">
                    <ChevronRight className="w-4 h-4" />
                  </div>

                  <div className="relative z-10 flex flex-col items-center w-1/3 px-1">
                    <div className="w-12 h-12 rounded-full bg-surface-base flex items-center justify-center text-gold-base mb-3 shadow-sm border border-border-subtle">
                      <PlusSquare className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                    <p className="text-[11px] text-content-base leading-tight font-medium">Selecione<br/>"Adicionar à Tela"</p>
                  </div>
                  
                  <div className="absolute top-10 left-[67%] -translate-x-1/2 text-border-subtle z-20">
                    <ChevronRight className="w-4 h-4" />
                  </div>

                  <div className="relative z-10 flex flex-col items-center w-1/3 px-1">
                    <div className="w-12 h-12 rounded-full bg-surface-base flex items-center justify-center text-gold-base mb-3 shadow-sm border border-border-subtle">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <p className="text-[11px] text-content-base leading-tight font-medium">Confirme e<br/>pronto!<br/>Atalho criado.</p>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start text-center relative">
                  <div className="absolute top-6 left-[15%] right-[15%] h-[1px] bg-border-subtle" />
                  
                  <div className="relative z-10 flex flex-col items-center w-1/3 px-1">
                    <div className="w-12 h-12 rounded-full bg-surface-base flex items-center justify-center text-gold-base mb-3 shadow-sm border border-border-subtle">
                      <Share2 className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                    <p className="text-[11px] text-content-base leading-tight font-medium">Toque no menu<br/>compartilhar</p>
                  </div>
                  
                  <div className="absolute top-10 left-[33%] -translate-x-1/2 text-border-subtle z-20">
                    <ChevronRight className="w-4 h-4" />
                  </div>

                  <div className="relative z-10 flex flex-col items-center w-1/3 px-1">
                    <div className="w-12 h-12 rounded-full bg-surface-base flex items-center justify-center text-gold-base mb-3 shadow-sm border border-border-subtle">
                      <PlusSquare className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                    <p className="text-[11px] text-content-base leading-tight font-medium">Selecione<br/>"Adicionar à Tela"</p>
                  </div>
                  
                  <div className="absolute top-10 left-[67%] -translate-x-1/2 text-border-subtle z-20">
                    <ChevronRight className="w-4 h-4" />
                  </div>

                  <div className="relative z-10 flex flex-col items-center w-1/3 px-1">
                    <div className="w-12 h-12 rounded-full bg-surface-base flex items-center justify-center text-gold-base mb-3 shadow-sm border border-border-subtle">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <p className="text-[11px] text-content-base leading-tight font-medium">Confirme e<br/>pronto!<br/>Atalho criado.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-border-subtle flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-gold-base shrink-0" />
            <p className="text-xs text-content-muted">Seguro, leve e rápido. Não consome memória extra.</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PWAInstallModal;
