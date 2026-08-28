import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  Trash2,
  Activity,
  Calendar,
  Info,
  ShieldAlert,
  Clock,
} from "lucide-react";
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

type AlertCategory = "all" | "critical" | "appointments" | "system";

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

const getNotificationMeta = (item: AdminNotificationHistoryItem) => {
  const text = `${item.title} ${item.body}`.toLowerCase();

  if (
    text.includes("falha") ||
    text.includes("erro") ||
    text.includes("cancelad") ||
    text.includes("não compareceu") ||
    text.includes("urgente") ||
    text.includes("crític")
  ) {
    return {
      category: "critical" as const,
      color: "bg-status-error",
      textColor: "text-status-error",
      iconBg: "bg-status-error/15 text-status-error",
      Icon: ShieldAlert,
      tag: "Crítico",
    };
  }

  if (
    text.includes("agend") ||
    text.includes("horário") ||
    text.includes("cliente") ||
    text.includes("reserva") ||
    text.includes("fila") ||
    text.includes("atendimento")
  ) {
    return {
      category: "appointments" as const,
      color: "bg-[var(--admin-accent)]",
      textColor: "text-[var(--admin-accent)]",
      iconBg: "bg-[var(--admin-accent)]/15 text-[var(--admin-accent)]",
      Icon: Calendar,
      tag: "Agendamento",
    };
  }

  return {
    category: "system" as const,
    color: "bg-sky-500",
    textColor: "text-sky-500",
    iconBg: "bg-sky-500/15 text-sky-400",
    Icon: Info,
    tag: "Sistema",
  };
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
  const [activeCategory, setActiveCategory] = useState<AlertCategory>("all");
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

  const enrichedHistory = useMemo(() => {
    return history.map((item) => ({
      ...item,
      meta: getNotificationMeta(item),
    }));
  }, [history]);

  const filteredHistory = useMemo(() => {
    if (activeCategory === "all") return enrichedHistory;
    return enrichedHistory.filter((item) => item.meta.category === activeCategory);
  }, [enrichedHistory, activeCategory]);

  const counts = useMemo(() => {
    return {
      all: history.length,
      critical: enrichedHistory.filter((i) => i.meta.category === "critical").length,
      appointments: enrichedHistory.filter((i) => i.meta.category === "appointments").length,
      system: enrichedHistory.filter((i) => i.meta.category === "system").length,
    };
  }, [history, enrichedHistory]);

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
          title="Alertas e Notificações"
          subtitle={
            unreadCount > 0
              ? `${unreadCount} alerta(s) pendente(s) de visualização.`
              : "Todas as notificações estão em dia."
          }
          onClose={() => setOpen(false)}
          size="lg"
          footer={
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationsActive}
                  onClick={() => void onToggleNotifications()}
                  disabled={isBlocked || notificationsBusy}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-[var(--admin-radius-full)] border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                    notificationsActive
                      ? "bg-status-success"
                      : "bg-[var(--admin-border)]"
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
                    <BellRing
                      className={`w-3.5 h-3.5 ${
                        notificationsActive
                          ? "text-status-success"
                          : "text-[var(--admin-text-muted)]"
                      }`}
                    />
                    Notificações Push no Navegador
                  </span>
                  <span className="text-[11px] leading-tight text-[var(--admin-text-muted)]">
                    {pushLabel}
                  </span>
                </div>
              </div>

              {history.length > 0 && (
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    disabled={unreadCount === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--admin-radius-sm)] text-xs font-semibold text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-bg)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Marcar lidas
                  </button>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--admin-radius-sm)] text-xs font-semibold text-status-error/80 hover:text-status-error hover:bg-status-error/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Limpar
                  </button>
                </div>
              )}
            </div>
          }
        >
          <div className="flex flex-col space-y-4">
            {/* Quick Filter Pills (Inspirado no Stitch, adaptado para Navo) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeCategory === "all"
                    ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)] shadow-sm"
                    : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border border-[var(--admin-border)] hover:text-[var(--admin-text-main)]"
                }`}
              >
                <span>Tudo</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-bold">
                  {counts.all}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory("critical")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeCategory === "critical"
                    ? "bg-status-error text-white shadow-sm"
                    : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border border-[var(--admin-border)] hover:text-[var(--admin-text-main)]"
                }`}
              >
                <span>Críticos & Erros</span>
                {counts.critical > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-bold">
                    {counts.critical}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory("appointments")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeCategory === "appointments"
                    ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)] shadow-sm"
                    : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border border-[var(--admin-border)] hover:text-[var(--admin-text-main)]"
                }`}
              >
                <span>Agendamentos</span>
                {counts.appointments > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-bold">
                    {counts.appointments}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory("system")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeCategory === "system"
                    ? "bg-sky-500 text-white shadow-sm"
                    : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border border-[var(--admin-border)] hover:text-[var(--admin-text-main)]"
                }`}
              >
                <span>Sistema</span>
                {counts.system > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-bold">
                    {counts.system}
                  </span>
                )}
              </button>
            </div>

            {/* Notification Cards List with Left Border Accent */}
            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
              {filteredHistory.length === 0 ? (
                <div className="p-8 text-center bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)]">
                  <Bell className="w-8 h-8 mx-auto text-[var(--admin-text-muted)]/40" />
                  <p className="mt-3 text-sm font-bold text-[var(--admin-text-main)]">
                    Nenhum alerta nesta categoria
                  </p>
                  <p className="mt-1 text-xs text-[var(--admin-text-muted)] max-w-[280px] mx-auto">
                    Novos eventos operacionais e notificações do sistema serão registrados automaticamente.
                  </p>
                </div>
              ) : (
                filteredHistory.map((item) => {
                  const { meta } = item;
                  const Icon = meta.Icon;

                  return (
                    <article
                      key={item.id}
                      onClick={() => markAsRead(item.id)}
                      className={`relative bg-[var(--admin-surface)] border rounded-[var(--admin-radius-md)] p-3.5 flex gap-3.5 items-start transition-all cursor-pointer overflow-hidden ${
                        item.read
                          ? "border-[var(--admin-border)] opacity-75 hover:opacity-100 hover:border-[var(--admin-border-focus)]"
                          : `border-[var(--admin-border)] shadow-sm bg-[var(--admin-surface)] hover:border-[var(--admin-accent)]`
                      }`}
                    >
                      {/* Colored Left Accent Bar */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1 ${meta.color}`}
                      />

                      {/* Icon Avatar */}
                      <div
                        className={`w-9 h-9 rounded-full ${meta.iconBg} flex items-center justify-center shrink-0 mt-0.5`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4
                            className={`text-sm font-bold truncate ${
                              item.read
                                ? "text-[var(--admin-text-muted)]"
                                : "text-[var(--admin-text-main)]"
                            }`}
                          >
                            {item.title}
                          </h4>
                          <span className="text-[10px] font-semibold text-[var(--admin-text-muted)] shrink-0 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatNotificationTime(item.createdAt)}
                          </span>
                        </div>

                        <p className="text-xs text-[var(--admin-text-muted)] leading-relaxed line-clamp-2">
                          {item.body}
                        </p>
                      </div>

                      {/* Unread indicator bullet */}
                      {!item.read && (
                        <span className="w-2 h-2 rounded-full bg-[var(--admin-accent)] shrink-0 mt-2" />
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </AdminModalV2>
      )}
    </div>
  );
};
