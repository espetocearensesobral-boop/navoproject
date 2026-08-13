import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { LoadingButton } from './LoadingButton';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  variant?: 'danger' | 'primary';
  icon?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Voltar',
  isLoading = false,
  variant = 'danger',
  icon,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousActive = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleEscape);
      previousActive?.focus?.();
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="relative w-full max-w-md bg-surface-inverse border border-content-inverse/10 rounded-2xl shadow-2xl animate-success-pop overflow-hidden outline-none"
      >
        {/* Header */}
        <div className="p-6 pb-4 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center shrink-0
              ${variant === 'danger' 
                ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                : 'bg-accent-solid/10 text-accent-solid border border-accent-solid/20'}
            `}>
              {icon || <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <h3 id="confirm-dialog-title" className="text-lg font-bold text-content-inverse">{title}</h3>
              <p id="confirm-dialog-description" className="text-sm text-content-inverse/60 mt-1 leading-relaxed">{description}</p>
            </div>
          </div>
          {!isLoading && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar confirmação"
              className="p-1.5 rounded-lg text-content-inverse/60 hover:text-content-inverse hover:bg-content-inverse/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 pt-2 flex gap-3">
          <LoadingButton
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </LoadingButton>
          <LoadingButton
            variant={variant === 'danger' ? 'danger' : 'primary'}
            className="flex-1"
            onClick={onConfirm}
            isLoading={isLoading}
            loadingText="Processando..."
          >
            {confirmText}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
};
