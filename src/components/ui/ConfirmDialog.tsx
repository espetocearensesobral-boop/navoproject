import React from 'react';
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl animate-success-pop overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center shrink-0
              ${variant === 'danger' 
                ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                : 'bg-[#d4a853]/10 text-[#d4a853] border border-[#d4a853]/20'}
            `}>
              {icon || <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="text-sm text-neutral-400 mt-1 leading-relaxed">{description}</p>
            </div>
          </div>
          {!isLoading && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
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
