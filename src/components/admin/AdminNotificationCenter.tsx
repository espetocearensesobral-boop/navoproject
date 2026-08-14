import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, CheckCheck, Trash2, X } from 'lucide-react';
import type { AdminNotificationState } from '../../hooks/useAdminOperationNotifications';
import {
  ADMIN_NOTIFICATION_HISTORY_EVENT,
  readAdminNotificationHistory,
  writeAdminNotificationHistory,
  type AdminNotificationHistoryItem,
} from '../../utils/adminNotificationHistory';

type AdminNotificationCenterProps = {
  notificationsSupported: AdminNotificationState['isSupported'];
  notificationPermission: AdminNotificationState['permission'];
  notificationsActive: boolean;
  notificationsBusy: boolean;
  onToggleNotifications: () => Promise<boolean>;
  placement?: 'topbar' | 'drawer';
};

const formatNotificationTime = (createdAt: string) => {
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return 'agora';
  if (elapsed < 3_600_000) return `há ${Math.floor(elapsed / 60_000)} min`;
  if (elapsed < 86_400_000) return `há ${Math.floor(elapsed / 3_600_000)} h`;
  return new Date(createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export const AdminNotificationCenter: React.FC<AdminNotificationCenterProps> = ({
  notificationsSupported,
  notificationPermission,
  notificationsActive,
  notificationsBusy,
  onToggleNotifications,
  placement = 'topbar',
}) => {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<AdminNotificationHistoryItem[]>(() => readAdminNotificationHistory());

  useEffect(() => {
    const refresh = () => setHistory(readAdminNotificationHistory());
    window.addEventListener(ADMIN_NOTIFICATION_HISTORY_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(ADMIN_NOTIFICATION_HISTORY_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const unreadCount = useMemo(() => history.filter((item) => !item.read).length, [history]);
  const isBlocked = !notificationsSupported || notificationPermission === 'denied';
  const pushLabel = !notificationsSupported
    ? 'Notificações indisponíveis neste navegador.'
    : notificationPermission === 'denied'
      ? 'Permissão bloqueada pelo navegador.'
      : notificationsBusy
        ? 'Sincronizando a assinatura deste dispositivo…'
        : notificationsActive
          ? 'Alertas push ativos neste dispositivo.'
          : 'Alertas push desativados neste dispositivo.';

  const markAllAsRead = () => {
    const nextHistory = history.map((item) => ({ ...item, read: true }));
    setHistory(nextHistory);
    writeAdminNotificationHistory(nextHistory);
  };

  const clearHistory = () => {
    setHistory([]);
    writeAdminNotificationHistory([]);
  };

  const markAsRead = (id: string) => {
    const nextHistory = history.map((item) => item.id === id ? { ...item, read: true } : item);
    setHistory(nextHistory);
    writeAdminNotificationHistory(nextHistory);
  };

  const buttonLabel = open ? 'Fechar notificações' : unreadCount > 0 ? `Abrir notificações, ${unreadCount} não lidas` : 'Abrir notificações';
  const triggerClass = placement === 'drawer'
    ? 'w-full h-11 flex items-center justify-center gap-2 px-3 rounded-xl border border-border-subtle bg-surface-base text-content-base hover:border-gold-base/40 transition-colors'
    : placement === 'topbar'
      ? 'w-10 h-10 flex items-center justify-center rounded-full border border-border-subtle bg-surface-card text-content-muted active:text-gold-base active:scale-95 transition-transform'
      : 'w-8 h-8 flex items-center justify-center rounded-xl text-content-muted hover:bg-surface-base hover:text-gold-base active:bg-surface-elevated transition-colors shrink-0';
  const activeTriggerClass = notificationsActive ? 'text-status-success' : '';

  return (
    <div className={`relative ${placement === 'drawer' ? 'w-full' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`${triggerClass} ${activeTriggerClass}`}
        title={buttonLabel}
        aria-label={buttonLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="relative shrink-0">
          {notificationsActive ? <BellRing className={`${placement === 'topbar' ? 'w-5 h-5' : placement === 'drawer' ? 'w-4 h-4' : 'w-4 h-4'} text-content-on-accent`} /> : <Bell className={`${placement === 'topbar' ? 'w-5 h-5' : placement === 'drawer' ? 'w-4 h-4' : 'w-4 h-4'}`} />}
          {unreadCount > 0 && (
            <span className="absolute -right-2 -top-2 min-w-4 h-4 px-1 rounded-full bg-status-error text-white text-[9px] font-black leading-4 text-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
        {placement === 'drawer' && <span className="truncate">Central de notificações</span>}
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-[55] cursor-default bg-black/50 backdrop-blur-sm" aria-label="Fechar central de notificações" onClick={() => setOpen(false)} />
          <section
            role="dialog"
            aria-label="Central de notificações"
            className={`z-[60] flex flex-col overflow-hidden rounded-[2rem] sm:rounded-[2.75rem] border border-border-subtle bg-surface-card text-content-base shadow-2xl ${placement === 'drawer' ? 'fixed left-4 right-4 bottom-24 max-h-[min(78vh,48rem)]' : 'fixed left-1/2 top-1/2 w-[min(54rem,calc(100vw-2rem))] max-h-[min(86vh,52rem)] -translate-x-1/2 -translate-y-1/2'}`}
          >
            <header className="flex items-start justify-between gap-5 p-6 sm:p-10 border-b border-border-subtle">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl sm:text-4xl font-black tracking-tight truncate">Notificações</h2>
                  {unreadCount > 0 && <span className="rounded-full bg-status-error/10 text-status-error px-2.5 py-1 text-[10px] sm:text-xs font-black">{unreadCount} novas</span>}
                </div>
                <p className="mt-2 text-base sm:text-2xl text-content-muted">Agenda, Fila e Recebimentos</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl text-content-muted hover:bg-surface-base hover:text-content-base flex items-center justify-center shrink-0" aria-label="Fechar notificações">
                <X className="w-7 h-7 sm:w-9 sm:h-9" />
              </button>
            </header>

            <div className="flex items-center gap-6 px-6 sm:px-10 py-5 sm:py-6 border-b border-border-subtle bg-surface-base/30">
              <button type="button" onClick={markAllAsRead} disabled={unreadCount === 0} className="inline-flex items-center gap-2 rounded-xl px-0 py-2 text-sm sm:text-lg font-bold text-content-muted hover:text-content-base disabled:opacity-40 disabled:cursor-not-allowed">
                <CheckCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                Marcar lidas
              </button>
              <button type="button" onClick={clearHistory} disabled={history.length === 0} className="inline-flex items-center gap-2 rounded-xl px-0 py-2 text-sm sm:text-lg font-bold text-status-error hover:text-status-error/80 disabled:opacity-40 disabled:cursor-not-allowed">
                <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
                Limpar
              </button>
            </div>

            <div className="flex-1 min-h-0 max-h-[min(42vh,22rem)] overflow-y-auto overscroll-contain">
              {history.length === 0 ? (
                <div className="px-5 py-16 sm:py-24 text-center">
                  <Bell className="w-14 h-14 sm:w-20 sm:h-20 mx-auto text-content-muted/40" />
                  <p className="mt-8 text-xl sm:text-2xl font-black text-content-base">Nenhuma notificação registrada</p>
                  <p className="mt-3 text-base sm:text-xl text-content-muted">Novos eventos operacionais aparecerão aqui.</p>
                </div>
              ) : history.map((item) => (
                <button key={item.id} type="button" onClick={() => markAsRead(item.id)} className={`w-full text-left px-4 py-3 border-b border-border-subtle last:border-b-0 hover:bg-surface-base transition-colors ${item.read ? '' : 'bg-gold-base/5'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${item.read ? 'bg-content-muted/30' : 'bg-gold-base'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-xs font-black text-content-base">{item.title}</span>
                        <span className="text-[10px] text-content-muted whitespace-nowrap">{formatNotificationTime(item.createdAt)}</span>
                      </span>
                      <span className="block mt-1 text-xs leading-relaxed text-content-muted">{item.body}</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <footer className="p-5 sm:p-8 border-t border-border-subtle bg-surface-base/30">
              <button type="button" onClick={() => void onToggleNotifications()} disabled={isBlocked || notificationsBusy} className={`w-full min-h-[76px] rounded-[1.5rem] px-5 py-4 flex items-center justify-between gap-4 text-left border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${notificationsActive ? 'border-status-success/40 bg-surface-card' : 'border-border-subtle bg-surface-card hover:border-gold-base/40'}`}>
                <span className="flex items-center gap-4 min-w-0">
                  <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-surface-base flex items-center justify-center shrink-0">
                    {notificationsActive ? <BellRing className="w-6 h-6 sm:w-7 sm:h-7 text-status-success" /> : <Bell className="w-6 h-6 sm:w-7 sm:h-7 text-content-muted" />}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-base sm:text-xl font-black ${notificationsActive ? 'text-status-success' : 'text-content-base'}`}>{notificationsActive ? 'Push ativo' : 'Push inativo'}</span>
                    <span className={`block mt-1 text-sm sm:text-lg truncate ${notificationsActive ? 'text-status-success/80' : 'text-content-muted'}`}>{pushLabel}</span>
                  </span>
                </span>
                <span className={`text-sm sm:text-lg font-black whitespace-nowrap ${notificationsActive ? 'text-status-success' : 'text-gold-base'}`}>{notificationsActive ? 'Desativar' : 'Ativar'}</span>
              </button>
            </footer>
          </section>
        </>
      )}
    </div>
  );
};
