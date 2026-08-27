import React, { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, CheckCheck, Trash2, X, Activity } from "lucide-react";
import type { AdminNotificationState } from "../../hooks/useAdminOperationNotifications";
import {
  ADMIN_NOTIFICATION_HISTORY_EVENT,
  readAdminNotificationHistory,
  writeAdminNotificationHistory,
  type AdminNotificationHistoryItem,
} from "../../utils/adminNotificationHistory";
import { AdminModalV2 } from "./shared/AdminModalV2";

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
      ? "w-10 h-10 flex items-center justify-center rounded-[var(--admin-radius-full)] border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-muted)] active:text-[var(--admin-accent)] active:scale-95 transition-transform"
      : "w-8 h-8 flex items-center justify-center rounded-[var(--admin-radius-lg)] text-[var(--admin-text-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-accent)] active:bg-surface-elevated transition-colors shrink-0";
  const activeTriggerClass = notificationsActive ? "text-status-success" : "";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${triggerClass} ${activeTriggerClass}`}
        title={buttonLabel}
        aria-label={buttonLabel}
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
            <span className="absolute -right-2 -top-2 min-w-4 h-4 px-1 rounded-[var(--admin-radius-full)] bg-status-error text-white text-xs font-black leading-4 text-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </span>
      </button>

      {open && (
        <AdminModalV2
          icon={Activity}
          eyebrow="Monitoramento"
          title="Central de Notificações"
          subtitle={unreadCount > 0 ? `${unreadCount} alerta(s) não lido(s)` : "Você está em dia com os alertas."}
          onClose={() => setOpen(false)}
          size="md"
          footer={
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-1">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notificationsActive}
                    onClick={() => void onToggleNotifications()}
                    disabled={isBlocked || notificationsBusy}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-[var(--admin-radius-full)] border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                      notificationsActive ? "bg-status-success" : "bg-[var(--admin-border)]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-[var(--admin-radius-full)] bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        notificationsActive ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--admin-text-main)] flex items-center gap-1.5">
                      <BellRing className={`w-3.5 h-3.5 ${notificationsActive ? "text-status-success" : "text-[var(--admin-text-muted)]"}`} />
                      Notificações Push
                    </span>
                    <span className="text-[10px] leading-tight text-[var(--admin-text-muted)]">
                      {pushLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          }
        >
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--admin-text-muted)]">
                Histórico recente
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Marcar lidas
                </button>
                <button
                  type="button"
                  onClick={clearHistory}
                  disabled={history.length === 0}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-status-error/80 hover:text-status-error disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar
                </button>
              </div>
            </div>

            <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] overflow-hidden divide-y divide-[var(--admin-border)]/50">
              {history.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <Bell className="w-8 h-8 mx-auto text-[var(--admin-text-muted)]/30" />
                  <p className="mt-3 text-sm font-bold text-[var(--admin-text-main)]">
                    Nenhuma notificação registrada
                  </p>
                  <p className="mt-1 text-xs text-[var(--admin-text-muted)] max-w-[250px] mx-auto">
                    Novos alertas sobre agendamentos, clientes e recepção aparecerão aqui.
                  </p>
                </div>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => markAsRead(item.id)}
                    className={`w-full text-left p-4 hover:bg-[var(--admin-bg)] transition-colors ${
                      item.read ? "opacity-75" : "bg-[var(--admin-accent)]/[0.04]"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <span
                        className={`mt-1.5 w-2 h-2 rounded-[var(--admin-radius-full)] shrink-0 ${
                          item.read ? "bg-[var(--admin-border)]" : "bg-[var(--admin-accent)] ring-4 ring-[var(--admin-accent)]/20"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-sm font-bold truncate ${item.read ? "text-[var(--admin-text-muted)]" : "text-[var(--admin-text-main)]"}`}>
                            {item.title}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)] shrink-0 font-bold bg-[var(--admin-bg)] px-2 py-0.5 rounded-[var(--admin-radius-full)] border border-[var(--admin-border)]">
                            {formatNotificationTime(item.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-[var(--admin-text-muted)]">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </AdminModalV2>
      )}
    </div>
  );
};

