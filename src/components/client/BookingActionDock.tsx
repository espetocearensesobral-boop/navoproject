import React, { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Trash2, X } from 'lucide-react';

interface DockButton {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: ReactNode;
}

interface BookingActionDockProps {
  summaryLabel?: string;
  summaryValue?: ReactNode;
  clearAction?: {
    onClick: () => void;
    label?: string;
    disabled?: boolean;
  };
  backAction?: DockButton;
  primaryAction?: DockButton;
  confirmation?: {
    message: string;
    onCancel: () => void;
    onConfirm: () => void;
    confirmLabel: string;
  };
}

const buttonBase = 'min-h-10 rounded-full px-3.5 sm:px-4 font-bold text-[11px] sm:text-xs inline-flex items-center justify-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-base disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]';

export const BookingActionDock: React.FC<BookingActionDockProps> = ({
  summaryLabel,
  summaryValue,
  clearAction,
  backAction,
  primaryAction,
  confirmation,
}) => {
  return (
    <div className="client-booking-dock sticky bottom-2 z-40 px-3 sm:px-4 my-2 flex justify-center pointer-events-none animate-fade-in pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-auto w-full max-w-[560px] rounded-3xl border border-border-strong bg-surface-inverse/95 text-content-inverse shadow-2xl backdrop-blur-xl p-3 sm:p-3.5">
        {confirmation ? (
          <div className="flex flex-col gap-2.5" role="alertdialog" aria-label={confirmation.message}>
            <div className="flex items-center gap-2 px-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-content-inverse/90">
              <X className="w-4 h-4 text-status-warning shrink-0" />
              <span>{confirmation.message}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={confirmation.onCancel}
                className={`${buttonBase} bg-content-inverse/10 hover:bg-content-inverse/20 text-content-inverse/85`}
              >
                Não
              </button>
              <button
                type="button"
                onClick={confirmation.onConfirm}
                className={`${buttonBase} border border-status-warning/50 bg-status-warning/15 hover:bg-status-warning/25 text-content-inverse`}
              >
                {confirmation.confirmLabel}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="min-w-0 flex-1 pl-1">
              {summaryLabel && (
                <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-content-inverse/60">
                  {summaryLabel}
                </span>
              )}
              {summaryValue && (
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-xs sm:text-sm font-semibold text-content-inverse" aria-live="polite">
                  {summaryValue}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {clearAction && (
                <button
                  type="button"
                  onClick={clearAction.onClick}
                  disabled={clearAction.disabled}
                  aria-label={clearAction.label || 'Limpar seleção'}
                  title={clearAction.label || 'Limpar seleção'}
                  className="min-h-10 min-w-10 rounded-full border border-content-inverse/20 bg-content-inverse/10 px-2.5 text-content-inverse/75 hover:bg-content-inverse/20 hover:text-status-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-base"
                >
                  <Trash2 className="mx-auto h-4 w-4" />
                </button>
              )}
              {backAction && (
                <button
                  type="button"
                  onClick={backAction.onClick}
                  disabled={backAction.disabled}
                  title={backAction.title || backAction.label}
                  className={`${buttonBase} bg-content-inverse/10 hover:bg-content-inverse/20 text-content-inverse/85`}
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" />
                  <span>{backAction.label}</span>
                </button>
              )}
              {primaryAction && (
                <button
                  type="button"
                  onClick={primaryAction.onClick}
                  disabled={primaryAction.disabled || primaryAction.loading}
                  title={primaryAction.title || primaryAction.label}
                  className={`${buttonBase} ${primaryAction.variant === 'danger' ? 'bg-status-error text-white hover:bg-status-error/90' : primaryAction.variant === 'secondary' ? 'bg-content-inverse/10 hover:bg-content-inverse/20 text-content-inverse' : 'bg-gold-base text-surface-base hover:opacity-95'}`}
                >
                  <span>{primaryAction.loading ? 'Carregando...' : primaryAction.label}</span>
                  {primaryAction.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (primaryAction.icon || <ArrowRight className="h-4 w-4" />)}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
