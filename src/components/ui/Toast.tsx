import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, title, message }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-[#4ade80]" />,
    error: <XCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
  };

  const borderColors = {
    success: 'border-l-[#4ade80]',
    error: 'border-l-red-400',
    info: 'border-l-blue-400',
    warning: 'border-l-amber-400',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-auto sm:top-4 left-3 right-3 sm:left-auto sm:right-4 z-[250] flex flex-col-reverse sm:flex-col gap-2 max-w-none sm:max-w-sm pointer-events-none" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto
              bg-surface-inverse border border-content-inverse/10 border-l-4 ${borderColors[toast.type]}
              rounded-xl shadow-2xl backdrop-blur-xl
              p-4 flex items-start gap-3
              animate-toast-in
              w-full min-w-0 sm:min-w-[280px] max-w-sm
            `}
            role={toast.type === 'error' ? 'alert' : 'status'}
          >
            <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-content-inverse">{toast.title}</p>
              {toast.message && (
                <p className="text-xs text-content-inverse/70 mt-1">{toast.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1 rounded-lg text-content-inverse/70 hover:text-content-inverse hover:bg-content-inverse/10 transition-colors"
              aria-label="Fechar notificação"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
