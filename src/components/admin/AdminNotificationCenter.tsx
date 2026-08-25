import React, { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, CheckCheck, Trash2, X } from "lucide-react";
import type { AdminNotificationState } from "../../hooks/useAdminOperationNotifications";
import {
  ADMIN_NOTIFICATION_HISTORY_EVENT,
  readAdminNotificationHistory,
  writeAdminNotificationHistory,
  type AdminNotificationHistoryItem,
} from "../../utils/adminNotificationHistory";

type AdminNotificationCenterProps = {
  notificationsSupported: AdminNotificationState["isSupported"];
  notificationPermission: AdminNotificationState["permission"];
  notificationsActive: boolean;
  notificationsBusy: boolean;
  onToggleNotifications: () => Promise<boolean>;
  placement?: "topbar" | "drawer";
};

const formatNotificationTime = (createdAt: string) => {
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return "agora";
  if (elapsed < 3_600_000) return `há ${Math.floor(elapsed / 60_000)} min`;
  if (elapsed < 86_400_000) return `há ${Math.floor(elapsed / 3_600_000)} h`;
  return new Date(createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
};

export const AdminNotificationCenter: React.FC<
  AdminNotificationCenterProps
> = ({
  notificationsSupported,
  notificationPermission,
  notificationsActive,
  notificationsBusy,
  onToggleNotifications,
  placement = "topbar",
}) => {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<AdminNotificationHistoryItem[]>(() =>
    readAdminNotificationHistory(),
  );

  useEffect(() => {
    const refresh = () => setHistory(readAdminNotificationHistory());
    window.addEventListener(ADMIN_NOTIFICATION_HISTORY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ADMIN_NOTIFICATION_HISTORY_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const unreadCount = useMemo(
    () => history.filter((item) => !item.read).length,
    [history],
  );
  const isBlocked =
    !notificationsSupported || notificationPermission === "denied";
  const pushLabel = !notificationsSupported
    ? "Notificações indisponíveis neste navegador."
    : notificationPermission === "denied"
      ? "Permissão bloqueada pelo navegador."
      : notificationsBusy
        ? "Sincronizando a assinatura deste dispositivo…"
        : notificationsActive
          ? "Alertas push ativos neste dispositivo."
          : "Alertas push desativados neste dispositivo.";

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
    const nextHistory = history.map((item) =>
      item.id === id ? { ...item, read: true } : item,
    );
    setHistory(nextHistory);
    writeAdminNotificationHistory(nextHistory);
  };

  const buttonLabel = open
    ? "Fechar notificações"
    : unreadCount > 0
      ? `Abrir notificações, ${unreadCount} não lidas`
      : "Abrir notificações";
  const triggerClass =
    placement === "topbar"
      ? "w-10 h-10 flex items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-muted)] active:text-[var(--admin-accent)] active:scale-95 transition-transform"
      : "w-8 h-8 flex items-center justify-center rounded-xl text-[var(--admin-text-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-accent)] active:bg-surface-elevated transition-colors shrink-0";
  const activeTriggerClass = notificationsActive ? "text-status-success" : "";

  return (
    <div className="relative">
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
          {notificationsActive ? (
            <BellRing
              className={`${placement === "topbar" ? "w-5 h-5" : "w-4 h-4"} text-[var(--admin-accent-text)]`}
            />
          ) : (
            <Bell
              className={`${placement === "topbar" ? "w-5 h-5" : "w-4 h-4"}`}
            />
          )}
          {unreadCount > 0 && (
            <span className="absolute -right-2 -top-2 min-w-4 h-4 px-1 rounded-full bg-status-error text-white text-xs font-black leading-4 text-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[55] cursor-default bg-black/40 backdrop-blur-[2px]"
            aria-label="Fechar central de notificações"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-label="Central de notificações"
            className="z-[60] flex flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-main)] shadow-xl animate-fade-in fixed left-3 right-3 top-16 max-h-[min(75vh,28rem)] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem] sm:max-h-[min(75vh,30rem)]"
          >
            <header className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-[var(--admin-border)] bg-[var(--admin-bg)]/40">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="w-4 h-4 text-[var(--admin-accent)] shrink-0" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text-main)] truncate">
                  Notificações
                </h2>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-status-error/15 text-status-error px-1.5 py-0.2 text-[10px] font-black">
                    {unreadCount}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-6 h-6 rounded-md text-[var(--admin-text-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-text-main)] flex items-center justify-center shrink-0 transition-colors"
                aria-label="Fechar notificações"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </header>

            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--admin-border)] bg-[var(--admin-bg)]/20 text-[11px]">
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="inline-flex items-center gap-1 font-semibold text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar lidas
              </button>
              <button
                type="button"
                onClick={clearHistory}
                disabled={history.length === 0}
                className="inline-flex items-center gap-1 font-semibold text-status-error/80 hover:text-status-error disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar
              </button>
            </div>

            <div className="flex-1 min-h-0 max-h-[min(40vh,18rem)] overflow-y-auto overscroll-contain divide-y divide-[var(--admin-border)]/50">
              {history.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-6 h-6 mx-auto text-[var(--admin-text-muted)]/30" />
                  <p className="mt-2 text-xs font-semibold text-[var(--admin-text-main)]">
                    Nenhuma notificação registrada
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--admin-text-muted)]">
                    Novos alertas operacionais aparecerão aqui.
                  </p>
                </div>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => markAsRead(item.id)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-[var(--admin-bg)] transition-colors ${
                      item.read ? "opacity-75" : "bg-[var(--admin-accent)]/[0.04]"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                          item.read ? "bg-content-muted/30" : "bg-[var(--admin-accent)] ring-2 ring-[var(--admin-accent)]/20"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-bold text-[var(--admin-text-main)] truncate">
                            {item.title}
                          </span>
                          <span className="text-[10px] text-[var(--admin-text-muted)] shrink-0 font-medium">
                            {formatNotificationTime(item.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-snug text-[var(--admin-text-muted)] line-clamp-2">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <footer className="p-3 border-t border-[var(--admin-border)] bg-[var(--admin-bg)]/40">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BellRing className={`w-4 h-4 ${notificationsActive ? "text-status-success" : "text-[var(--admin-text-muted)]"}`} />
                    <span className="text-[11px] font-bold text-[var(--admin-text-main)]">
                      Notificações Push
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notificationsActive}
                    onClick={() => void onToggleNotifications()}
                    disabled={isBlocked || notificationsBusy}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                      notificationsActive ? "bg-status-success" : "bg-[var(--admin-border)]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        notificationsActive ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[10px] leading-tight text-[var(--admin-text-muted)]">
                  {pushLabel}
                </p>
              </div>
            </footer>
          </section>
        </>
      )}
    </div>
  );
};
