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
        className="relative w-full max-w-md bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl shadow-2xl animate-success-pop overflow-hidden outline-none"
      >
        {/* Header */}
        <div className="p-5 pb-3 flex items-start justify-between">
          <div className="flex items-start gap-3.5">
            <div className={`
              w-10 h-10 rounded-lg flex items-center justify-center shrink-0
              ${variant === 'danger' 
                ? 'bg-status-error/10 text-status-error border border-status-error/25' 
                : 'bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] border border-[var(--admin-accent)]/25'}
            `}>
              {icon || <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h3 id="confirm-dialog-title" className="text-base font-bold text-[var(--admin-text-main)]">{title}</h3>
              <p id="confirm-dialog-description" className="text-xs text-[var(--admin-text-muted)] mt-1 leading-relaxed">{description}</p>
            </div>
          </div>
          {!isLoading && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar confirmação"
              className="p-1 rounded-md text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-surface-hover)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 pt-2 flex gap-2.5">
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
