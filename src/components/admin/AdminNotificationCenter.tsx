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
    placement === "drawer"
      ? "w-full h-11 flex items-center justify-center gap-2 px-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] text-[var(--admin-text-main)] hover:border-[var(--admin-accent)]/40 transition-colors"
      : placement === "topbar"
        ? "w-10 h-10 flex items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-muted)] active:text-[var(--admin-accent)] active:scale-95 transition-transform"
        : "w-8 h-8 flex items-center justify-center rounded-xl text-[var(--admin-text-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-accent)] active:bg-surface-elevated transition-colors shrink-0";
  const activeTriggerClass = notificationsActive ? "text-status-success" : "";

  return (
    <div className={`relative ${placement === "drawer" ? "w-full" : ""}`}>
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
              className={`${placement === "topbar" ? "w-5 h-5" : placement === "drawer" ? "w-4 h-4" : "w-4 h-4"} text-[var(--admin-accent-text)]`}
            />
          ) : (
            <Bell
              className={`${placement === "topbar" ? "w-5 h-5" : placement === "drawer" ? "w-4 h-4" : "w-4 h-4"}`}
            />
          )}
          {unreadCount > 0 && (
            <span className="absolute -right-2 -top-2 min-w-4 h-4 px-1 rounded-full bg-status-error text-white text-xs font-black leading-4 text-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </span>
        {placement === "drawer" && (
          <span className="truncate">Central de notificações</span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[55] cursor-default bg-black/50 backdrop-blur-sm"
            aria-label="Fechar central de notificações"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-label="Central de notificações"
            className={`z-[60] flex flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-main)] ${placement === "drawer" ? "fixed left-3 right-3 bottom-20 max-h-[min(78vh,40rem)]" : "fixed left-1/2 top-1/2 w-[min(42rem,calc(100vw-2rem))] max-h-[min(86vh,42rem)] -translate-x-1/2 -translate-y-1/2"}`}
          >
            <header className="flex items-start justify-between gap-3 p-4 border-b border-[var(--admin-border)]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold tracking-tight truncate">
                    Notificações
                  </h2>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-status-error/10 text-status-error px-2 py-0.5 text-[10px] font-bold">
                      {unreadCount} novas
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
                  Agenda, fila e recebimentos
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-md text-[var(--admin-text-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-text-main)] flex items-center justify-center shrink-0"
                aria-label="Fechar notificações"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--admin-border)] bg-[var(--admin-bg)]/30">
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="inline-flex items-center gap-1.5 rounded-md px-0 py-1 text-xs font-semibold text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCheck className="w-4 h-4" />
                Marcar lidas
              </button>
              <button
                type="button"
                onClick={clearHistory}
                disabled={history.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md px-0 py-1 text-xs font-semibold text-status-error hover:text-status-error/80 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Limpar
              </button>
            </div>

            <div className="flex-1 min-h-0 max-h-[min(42vh,22rem)] overflow-y-auto overscroll-contain">
              {history.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Bell className="w-8 h-8 mx-auto text-[var(--admin-text-muted)]/40" />
                  <p className="mt-4 text-sm font-semibold text-[var(--admin-text-main)]">
                    Nenhuma notificação registrada
                  </p>
                  <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
                    Novos eventos operacionais aparecerão aqui.
                  </p>
                </div>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => markAsRead(item.id)}
                    className={`w-full text-left px-4 py-3 border-b border-[var(--admin-border)] last:border-b-0 hover:bg-[var(--admin-bg)] transition-colors ${item.read ? "" : "bg-[var(--admin-accent)]/5"}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${item.read ? "bg-content-muted/30" : "bg-[var(--admin-accent)]"}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-xs font-black text-[var(--admin-text-main)]">
                            {item.title}
                          </span>
                          <span className="text-xs text-[var(--admin-text-muted)] whitespace-nowrap">
                            {formatNotificationTime(item.createdAt)}
                          </span>
                        </span>
                        <span className="block mt-1 text-xs leading-relaxed text-[var(--admin-text-muted)]">
                          {item.body}
                        </span>
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <footer className="p-3 border-t border-[var(--admin-border)] bg-[var(--admin-bg)]/30">
              <button
                type="button"
                onClick={() => void onToggleNotifications()}
                disabled={isBlocked || notificationsBusy}
                className={`w-full min-h-12 rounded-md px-3 py-2 flex items-center justify-between gap-4 text-left border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${notificationsActive ? "border-status-success/40 bg-[var(--admin-surface)]" : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-accent)]/40"}`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-md bg-[var(--admin-bg)] flex items-center justify-center shrink-0">
                    {notificationsActive ? (
                      <BellRing className="w-4 h-4 text-status-success" />
                    ) : (
                      <Bell className="w-4 h-4 text-[var(--admin-text-muted)]" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block text-xs font-bold ${notificationsActive ? "text-status-success" : "text-[var(--admin-text-main)]"}`}
                    >
                      {notificationsActive ? "Push ativo" : "Push inativo"}
                    </span>
                    <span
                      className={`block mt-0.5 text-[11px] truncate ${notificationsActive ? "text-status-success/80" : "text-[var(--admin-text-muted)]"}`}
                    >
                      {pushLabel}
                    </span>
                  </span>
                </span>
                <span
                  className={`text-xs font-bold whitespace-nowrap ${notificationsActive ? "text-status-success" : "text-[var(--admin-accent)]"}`}
                >
                  {notificationsActive ? "Desativar" : "Ativar"}
                </span>
              </button>
            </footer>
          </section>
        </>
      )}
    </div>
  );
};
