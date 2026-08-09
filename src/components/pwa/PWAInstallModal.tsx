import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  CheckCircle2,
  X,
  Share2,
  PlusSquare,
  Pencil,
} from 'lucide-react';
import { usePWA } from '../../usePWA';
import { motion, AnimatePresence } from 'motion/react';
import { hapticLight, hapticSuccess } from '../../lib/haptics';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

const DEFAULT_SHORTCUT_NAME = 'Navo Premium';

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose, onShowToast }) => {
  const { canInstall, isInstalled, installApp } = usePWA();
  const [installing, setInstalling] = useState(false);
  const [shortcutName, setShortcutName] = useState(DEFAULT_SHORTCUT_NAME);
  const [editingName, setEditingName] = useState(false);

  // Só existe prompt nativo automático no Chrome/Edge (Android e desktop).
  // No iOS/Safari não existe beforeinstallprompt — instruções manuais sempre.
  const showManualInstructions = !canInstall || isIOS();

  const handleInstall = async () => {
    hapticLight();
    setInstalling(true);
    try {
      const outcome = await installApp(shortcutName);

      if (outcome === 'accepted') {
        hapticSuccess();
        onShowToast?.(`"${shortcutName || DEFAULT_SHORTCUT_NAME}" instalado como aplicativo!`, 'success');
        onClose();
      } else if (outcome === 'dismissed') {
        onShowToast?.('Instalação cancelada.', 'info');
      } else {
        // 'unavailable': não existe prompt nativo neste navegador/estado —
        // nunca reportar sucesso aqui, apenas orientar o passo manual.
        onShowToast?.('Siga os passos abaixo para instalar neste navegador', 'info');
      }
    } catch {
      onShowToast?.('Não foi possível instalar automaticamente. Siga os passos abaixo.', 'warning');
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
        className="fixed inset-0 z-50 bg-surface-base/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs bg-surface-base border border-border-subtle rounded-3xl shadow-2xl overflow-hidden p-5 text-content-base relative font-sans"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-surface-card text-content-muted hover:text-content-base transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-5 pr-6">
            <div className="w-11 h-11 rounded-xl bg-gold-base flex items-center justify-center text-surface-base shrink-0">
              <Smartphone className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-base font-bold text-content-base tracking-tight leading-tight">
                {isInstalled ? 'App já instalado' : 'Instalar aplicativo'}
              </h2>
              <p className="text-xs text-content-muted mt-0.5">Acesse com 1 toque na tela inicial.</p>
            </div>
          </div>

          {!showManualInstructions ? (
            <>
              {/* Nome do atalho */}
              <div className="mb-4">
                <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1.5">
                  Nome do atalho
                </label>
                {editingName ? (
                  <input
                    autoFocus
                    type="text"
                    value={shortcutName}
                    maxLength={30}
                    onChange={(e) => setShortcutName(e.target.value)}
                    onBlur={() => setEditingName(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-content-base focus:outline-none focus:ring-2 focus:ring-gold-base/50"
                  />
                ) : (
                  <button
                    onClick={() => setEditingName(true)}
                    className="w-full flex items-center justify-between bg-surface-card border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-content-base hover:border-gold-base/40 transition-colors"
                  >
                    <span>{shortcutName || DEFAULT_SHORTCUT_NAME}</span>
                    <Pencil className="w-3.5 h-3.5 text-content-muted shrink-0" />
                  </button>
                )}
              </div>

              <button
                onClick={handleInstall}
                disabled={installing}
                className="w-full py-3.5 px-4 bg-gold-base hover:brightness-110 text-surface-base font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
              >
                <Download className="w-4 h-4" strokeWidth={2} />
                <span>{installing ? 'Instalando…' : 'Confirmar instalação'}</span>
              </button>
            </>
          ) : (
            /* Instruções manuais compactas (iOS ou navegador sem prompt automático) */
            <div className="bg-surface-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-base border border-border-subtle flex items-center justify-center text-gold-base shrink-0">
                  <Share2 className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <p className="text-xs text-content-base leading-snug">
                  Toque no ícone de <strong>compartilhar</strong> do navegador
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-base border border-border-subtle flex items-center justify-center text-gold-base shrink-0">
                  <PlusSquare className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <p className="text-xs text-content-base leading-snug">
                  Selecione <strong>"Adicionar à Tela de Início"</strong> (é aqui que dá para renomear o atalho)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-base border border-border-subtle flex items-center justify-center text-gold-base shrink-0">
                  <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <p className="text-xs text-content-base leading-snug">Confirme e pronto — abre como app.</p>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PWAInstallModal;
