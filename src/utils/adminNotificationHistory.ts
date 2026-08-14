export const ADMIN_NOTIFICATION_HISTORY_KEY = 'navo-admin-notification-history-v1';
export const ADMIN_NOTIFICATION_HISTORY_EVENT = 'adminNotificationHistoryChange';

export type AdminNotificationHistoryItem = {
  id: string;
  title: string;
  body: string;
  tag: string;
  createdAt: string;
  read: boolean;
};

export const readAdminNotificationHistory = (): AdminNotificationHistoryItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem(ADMIN_NOTIFICATION_HISTORY_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeAdminNotificationHistory = (history: AdminNotificationHistoryItem[]) => {
  try {
    window.localStorage.setItem(ADMIN_NOTIFICATION_HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
    window.dispatchEvent(new CustomEvent(ADMIN_NOTIFICATION_HISTORY_EVENT));
  } catch {
    // A indisponibilidade do armazenamento não deve bloquear a operação do Admin.
  }
};

export const appendAdminNotificationHistory = (notification: Pick<AdminNotificationHistoryItem, 'title' | 'body' | 'tag'>) => {
  const history = readAdminNotificationHistory();
  const nextHistory: AdminNotificationHistoryItem[] = [
    {
      id: `${notification.tag}:${Date.now()}`,
      title: notification.title,
      body: notification.body,
      tag: notification.tag,
      createdAt: new Date().toISOString(),
      read: false,
    },
    ...history.filter((item) => item.tag !== notification.tag),
  ];
  writeAdminNotificationHistory(nextHistory);
};
