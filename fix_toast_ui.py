import re

with open('src/components/ui/Toast.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# I will just write a completely fresh clean version for Toast.tsx
clean_toast = """import React, { createContext, useContext, useState, useCallback } from 'react';
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
    success: <CheckCircle2 className="w-5 h-5 text-status-success" />,
    error: <XCircle className="w-5 h-5 text-status-error" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-auto sm:top-6 left-3 right-3 sm:left-auto sm:right-6 z-[250] flex flex-col-reverse sm:flex-col gap-3 max-w-none sm:max-w-sm pointer-events-none" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto
              bg-surface-inverse border border-content-inverse/10
              rounded-xl shadow-2xl backdrop-blur-xl
              p-3.5 flex items-start gap-3
              animate-toast-in
              w-full min-w-0 sm:min-w-[280px] max-w-sm
            `}
            role={toast.type === 'error' ? 'alert' : 'status'}
          >
            <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-content-inverse">{toast.title}</p>
              {toast.message && (
                <p className="text-xs text-content-inverse/70 mt-0.5">{toast.message}</p>
              )}
            </div>
            
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1.5 -m-1.5 rounded-lg text-content-inverse/60 hover:text-content-inverse hover:bg-content-inverse/10 transition-colors"
              aria-label="Fechar notificação"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
"""

with open('src/components/ui/Toast.tsx', 'w', encoding='utf-8') as f:
    f.write(clean_toast)

print("Rewrote toast clean")
