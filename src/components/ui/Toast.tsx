import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

type ToastInput =
  | [type: ToastType, title: string, message?: string]
  | [messageOrTitle: string, type?: ToastType, message?: string]
  | [{ type?: ToastType; title?: string; message?: string; text?: string }];

// Global listener for standalone showToast calls
type ToastListener = (toast: Omit<ToastItem, 'id'>) => void;
const listeners = new Set<ToastListener>();

export const showToast = (...args: any[]) => {
  let type: ToastType = 'info';
  let title = '';
  let message: string | undefined = undefined;

  if (typeof args[0] === 'object' && args[0] !== null) {
    type = args[0].type || 'info';
    title = args[0].title || args[0].text || args[0].message || '';
    message = args[0].message && args[0].title ? args[0].message : undefined;
  } else if (['success', 'error', 'info', 'warning'].includes(args[0])) {
    type = args[0] as ToastType;
    title = String(args[1] || '');
    message = args[2] ? String(args[2]) : undefined;
  } else {
    title = String(args[0] || '');
    type = (args[1] as ToastType) || 'info';
    message = args[2] ? String(args[2]) : undefined;
  }

  listeners.forEach((listener) => listener({ type, title, message }));
};

export const toast = {
  success: (title: string, message?: string) => showToast('success', title, message),
  error: (title: string, message?: string) => showToast('error', title, message),
  info: (title: string, message?: string) => showToast('info', title, message),
  warning: (title: string, message?: string) => showToast('warning', title, message),
};

interface ToastContextValue {
  showToast: typeof showToast;
  toast: typeof toast;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast,
  toast,
  success: toast.success,
  error: toast.error,
  info: toast.info,
  warning: toast.warning,
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(({ type, title, message }: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    setToasts((prev) => [...prev, { id, type, title, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    listeners.add(addToast);
    return () => {
      listeners.delete(addToast);
    };
  }, [addToast]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-status-success shrink-0" />,
    error: <XCircle className="w-5 h-5 text-status-error shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
  };

  const contextValue: ToastContextValue = {
    showToast,
    toast,
    success: toast.success,
    error: toast.error,
    info: toast.info,
    warning: toast.warning,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Live Floating Toast Notification Container */}
      <div
        className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:bottom-auto sm:top-6 left-4 right-4 sm:left-auto sm:right-6 z-[9999] flex flex-col-reverse sm:flex-col gap-2.5 max-w-none sm:max-w-sm pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className="pointer-events-auto bg-surface-inverse/95 text-content-inverse border border-content-inverse/10 rounded-2xl shadow-2xl backdrop-blur-xl p-3.5 sm:p-4 flex items-start gap-3 w-full min-w-0 sm:min-w-[320px] max-w-sm transition-all animate-in fade-in slide-in-from-bottom-2 sm:slide-in-from-top-2 duration-200"
            role={item.type === 'error' ? 'alert' : 'status'}
          >
            <div className="mt-0.5">{icons[item.type]}</div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-content-inverse leading-tight">{item.title}</p>
              {item.message && (
                <p className="text-xs text-content-inverse/75 mt-1 leading-relaxed">{item.message}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => removeToast(item.id)}
              className="shrink-0 p-1.5 -m-1 rounded-lg text-content-inverse/60 hover:text-content-inverse hover:bg-content-inverse/10 transition-colors focus:outline-none"
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

export default ToastProvider;
