import { useCallback, useEffect, useRef, useState } from 'react';
import type { Appointment, WaitingQueueItem } from '../types';
import {
  fetchAdminPushConfig,
  fetchAppointmentsFromSupabase,
  fetchReceiptsFromSupabase,
  getQueueFromSupabase,
  saveAdminPushSubscription,
  sendAdminPushTest,
  type ReceiptItem,
} from '../services/supabaseDataService';

const PREFERENCE_KEY = 'navo-admin-operation-notifications-enabled';
const POLL_INTERVAL_MS = 20_000;
const DEDUPE_WINDOW_MS = 90_000;

type Snapshot = {
  appointments: Map<string, Appointment>;
  queue: Map<string, WaitingQueueItem>;
  receipts: Map<string, ReceiptItem>;
};

type OperationNotification = {
  title: string;
  body: string;
  tag: string;
};

export type AdminNotificationState = {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isEnabled: boolean;
  requestPermission: () => Promise<NotificationPermission | 'unsupported'>;
  sendTestNotification: () => Promise<boolean>;
  backgroundPushEnabled: boolean;
};

const appointmentStatusCopy: Partial<Record<Appointment['status'], Pick<OperationNotification, 'title' | 'body'>>> = {
  confirmed: { title: 'Agendamento confirmado', body: 'Um agendamento foi confirmado na Agenda.' },
  cancelled: { title: 'Agendamento cancelado', body: 'Um compromisso foi cancelado e saiu da operação.' },
  completed: { title: 'Atendimento concluído', body: 'Um atendimento foi finalizado.' },
  no_show: { title: 'Cliente não compareceu', body: 'Um agendamento foi marcado como não comparecido.' },
};

const queueStatusCopy: Partial<Record<WaitingQueueItem['status'], Pick<OperationNotification, 'title' | 'body'>>> = {
  waiting: { title: 'Cliente na recepção', body: 'Um cliente entrou na Fila de Espera.' },
  in_chair: { title: 'Cliente chamado para cadeira', body: 'Um atendimento entrou em andamento.' },
  completed: { title: 'Atendimento concluído', body: 'Um corte foi finalizado na operação.' },
  cancelled: { title: 'Operação cancelada', body: 'Um cliente foi cancelado na Fila de Espera.' },
  abandoned: { title: 'Cliente removido da fila', body: 'Um cliente saiu temporariamente da recepção.' },
};

const receiptStatusCopy: Partial<Record<ReceiptItem['status'], Pick<OperationNotification, 'title' | 'body'>>> = {
  pending: { title: 'Recebimento pendente', body: 'Um atendimento concluído aguarda registro financeiro.' },
  received: { title: 'Recebimento confirmado', body: 'Um pagamento foi registrado no Extrato real.' },
};

const getServiceTitle = (appointment: Appointment) => {
  const firstService = Array.isArray(appointment.services) ? appointment.services[0] : null;
  return firstService?.title || 'Serviço agendado';
};

const getAppointmentOperationKey = (appointmentId: string, status: string) => `appointment:${appointmentId}:${status}`;
const getQueueOperationKey = (item: WaitingQueueItem, status: string) => `appointment:${item.appointment_id || item.id}:${status}`;
const getReceiptOperationKey = (receipt: ReceiptItem, status: string) => `receipt:${receipt.id}:${status}`;

const base64ToUint8Array = (value: string) => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
};

export function useAdminOperationNotifications(isAuthorized = true): AdminNotificationState {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window;
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => isSupported ? Notification.permission : 'unsupported');
  const [isEnabled, setIsEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(PREFERENCE_KEY) === 'true';
  });
  const [backgroundPushEnabled, setBackgroundPushEnabled] = useState(false);
  const snapshotRef = useRef<Snapshot | null>(null);
  const sentTagsRef = useRef<Map<string, number>>(new Map());
  const isPollingRef = useRef(false);
  const registeringPushRef = useRef(false);

  const showNotification = useCallback(async (notification: OperationNotification) => {
    if (!isSupported || Notification.permission !== 'granted') return false;

    const now = Date.now();
    const lastSent = sentTagsRef.current.get(notification.tag) || 0;
    if (now - lastSent < DEDUPE_WINDOW_MS) return false;
    sentTagsRef.current.set(notification.tag, now);

    for (const [tag, timestamp] of sentTagsRef.current.entries()) {
      if (now - timestamp > DEDUPE_WINDOW_MS) sentTagsRef.current.delete(tag);
    }

    const options: NotificationOptions = {
      body: notification.body,
      icon: '/pwa-admin-192x192.svg',
      badge: '/pwa-admin-192x192.svg',
      tag: notification.tag,
      data: { url: '/admin' },
    };

    try {
      const registration = await navigator.serviceWorker?.ready;
      if (registration) {
        await registration.showNotification(notification.title, options);
      } else {
        new Notification(notification.title, options);
      }
      return true;
    } catch (error) {
      console.warn('[Admin Notifications] Falha ao exibir alerta:', error);
      return false;
    }
  }, [isSupported]);

  const registerBackgroundPush = useCallback(async () => {
    if (!isAuthorized || !isSupported || Notification.permission !== 'granted' || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    if (registeringPushRef.current) return false;
    registeringPushRef.current = true;

    try {
      const config = await fetchAdminPushConfig();
      if (!config.enabled || !config.publicKey) return false;
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToUint8Array(config.publicKey),
        });
      }
      await saveAdminPushSubscription(subscription.toJSON());
      setBackgroundPushEnabled(true);
      return true;
    } catch (error) {
      setBackgroundPushEnabled(false);
      console.warn('[Admin Notifications] Push em segundo plano indisponível:', error);
      return false;
    } finally {
      registeringPushRef.current = false;
    }
  }, [isAuthorized, isSupported]);

  const processChanges = useCallback(async () => {
    if (!isAuthorized || !isSupported || Notification.permission !== 'granted' || !isEnabled || isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const [appointments, queue, receipts] = await Promise.all([
        fetchAppointmentsFromSupabase(undefined, { strict: true }),
        getQueueFromSupabase(),
        fetchReceiptsFromSupabase({ strict: true }),
      ]);

      const nextSnapshot: Snapshot = {
        appointments: new Map(appointments.map((item) => [item.id, item])),
        queue: new Map(queue.map((item) => [item.id, item])),
        receipts: new Map(receipts.map((item) => [item.id, item])),
      };
      const previousSnapshot = snapshotRef.current;

      if (!previousSnapshot) {
        snapshotRef.current = nextSnapshot;
        return;
      }

      for (const appointment of appointments) {
        const previous = previousSnapshot.appointments.get(appointment.id);
        if (!previous) {
          await showNotification({
            title: 'Novo agendamento',
            body: `${appointment.client_name} · ${getServiceTitle(appointment)} · ${appointment.date} às ${appointment.time_slot}`,
            tag: getAppointmentOperationKey(appointment.id, 'new'),
          });
          continue;
        }
        if (previous.status !== appointment.status) {
          const copy = appointmentStatusCopy[appointment.status];
          if (copy) await showNotification({
            title: copy.title,
            body: `${appointment.client_name} · ${getServiceTitle(appointment)} · ${copy.body}`,
            tag: getAppointmentOperationKey(appointment.id, appointment.status),
          });
        }
      }

      for (const item of queue) {
        const previous = previousSnapshot.queue.get(item.id);
        if (!previous) {
          await showNotification({
            title: 'Novo cliente na fila',
            body: `${item.client_name} · ${item.service_title} · ${item.professional_name || 'Profissional a definir'}`,
            tag: getQueueOperationKey(item, 'new'),
          });
          continue;
        }
        if (previous.status !== item.status) {
          const copy = queueStatusCopy[item.status];
          if (copy) await showNotification({
            title: copy.title,
            body: `${item.client_name} · ${item.service_title} · ${copy.body}`,
            tag: getQueueOperationKey(item, item.status),
          });
        }
      }

      for (const receipt of receipts) {
        const previous = previousSnapshot.receipts.get(receipt.id);
        if (!previous || previous.status !== receipt.status) {
          const copy = receiptStatusCopy[receipt.status];
          if (copy) await showNotification({
            title: copy.title,
            body: `${receipt.clientName} · ${receipt.serviceTitle} · R$ ${Number(receipt.totalAmount || 0).toFixed(2).replace('.', ',')}`,
            tag: getReceiptOperationKey(receipt, receipt.status),
          });
        }
      }

      snapshotRef.current = nextSnapshot;
    } catch (error) {
      console.warn('[Admin Notifications] Falha ao verificar mudanças operacionais:', error);
    } finally {
      isPollingRef.current = false;
    }
  }, [isAuthorized, isEnabled, isSupported, showNotification]);

  useEffect(() => {
    if (!isAuthorized || !isSupported || permission !== 'granted' || !isEnabled) {
      snapshotRef.current = null;
      return;
    }

    void processChanges();
    const interval = window.setInterval(() => void processChanges(), POLL_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void processChanges();
    };
    const handleRefresh = () => void processChanges();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('adminRefresh', handleRefresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('adminRefresh', handleRefresh);
    };
  }, [isAuthorized, isEnabled, isSupported, permission, processChanges]);

  const requestPermission = useCallback(async (): Promise<NotificationPermission | 'unsupported'> => {
    if (!isSupported) return 'unsupported';
    const nextPermission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

    setPermission(nextPermission);
    const enabled = nextPermission === 'granted';
    setIsEnabled(enabled);
    window.localStorage.setItem(PREFERENCE_KEY, String(enabled));
    snapshotRef.current = null;
    if (enabled) await registerBackgroundPush();
    return nextPermission;
  }, [isSupported, registerBackgroundPush]);

  useEffect(() => {
    if (!isAuthorized || !isEnabled || permission !== 'granted') {
      setBackgroundPushEnabled(false);
      return;
    }

    const synchronizePushSubscription = () => {
      void registerBackgroundPush();
    };

    synchronizePushSubscription();
    window.addEventListener('focus', synchronizePushSubscription);
    window.addEventListener('pageshow', synchronizePushSubscription);
    document.addEventListener('visibilitychange', synchronizePushSubscription);

    return () => {
      window.removeEventListener('focus', synchronizePushSubscription);
      window.removeEventListener('pageshow', synchronizePushSubscription);
      document.removeEventListener('visibilitychange', synchronizePushSubscription);
    };
  }, [isAuthorized, isEnabled, permission, registerBackgroundPush]);

  const sendTestNotification = useCallback(async () => {
    let sentInBackground = false;
    if (backgroundPushEnabled) {
      try {
        const result = await sendAdminPushTest();
        sentInBackground = result.sent > 0;
      } catch (error) {
        console.warn('[Admin Notifications] Falha no teste de push em segundo plano:', error);
      }
    }

    if (!sentInBackground) {
      await showNotification({
        title: 'Alertas operacionais ativados',
        body: 'Você receberá avisos sobre Agenda, Fila e recebimentos pendentes enquanto o Admin estiver aberto.',
        tag: 'admin-notifications:test',
      });
    }
    return true;
  }, [backgroundPushEnabled, showNotification]);

  return { isSupported, permission, isEnabled, requestPermission, sendTestNotification, backgroundPushEnabled };
}
