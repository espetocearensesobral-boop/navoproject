import { authFetch } from '../lib/api';

export interface OperationSettings {
  id?: string;
  slotIntervalMinutes: number;
  minimumBookingLeadMinutes: number;
  maximumBookingHorizonDays: number;
  sameDayBookingCutoffMinutes: number;
  bufferBetweenAppointmentsMinutes: number;
  availabilityCacheTtlSeconds: number;
  queueRefreshSeconds: number;
  queueBaseWaitMinutes: number;
  allowWalkIn: boolean;
  requireProfessionalForWalkIn: boolean;
  queueVisibleLimit: number;
  reportsDayStartTime: string;
  reportsIncludeCancelled: boolean;
  reportsIncludeNoShow: boolean;
  reportsComparisonWindow: 'previous_period' | 'none';
  reportsRefreshSeconds: number;
  reportsShowPendingValues: boolean;
  updatedAt?: string | null;
}

export const defaultOperationSettings: OperationSettings = {
  slotIntervalMinutes: 30,
  minimumBookingLeadMinutes: 0,
  maximumBookingHorizonDays: 90,
  sameDayBookingCutoffMinutes: 0,
  bufferBetweenAppointmentsMinutes: 0,
  availabilityCacheTtlSeconds: 20,
  queueRefreshSeconds: 15,
  queueBaseWaitMinutes: 15,
  allowWalkIn: true,
  requireProfessionalForWalkIn: false,
  queueVisibleLimit: 5,
  reportsDayStartTime: '00:00',
  reportsIncludeCancelled: false,
  reportsIncludeNoShow: false,
  reportsComparisonWindow: 'previous_period',
  reportsRefreshSeconds: 30,
  reportsShowPendingValues: true,
};

const normalize = (value: any): OperationSettings => {
  const interval = Number(value?.slotIntervalMinutes);
  const allowedIntervals = [5, 10, 15, 20, 30, 60];
  return {
    ...defaultOperationSettings,
    ...(value || {}),
    slotIntervalMinutes: allowedIntervals.includes(interval) ? interval : defaultOperationSettings.slotIntervalMinutes,
    minimumBookingLeadMinutes: Math.max(0, Math.min(10080, Number(value?.minimumBookingLeadMinutes ?? defaultOperationSettings.minimumBookingLeadMinutes))),
    maximumBookingHorizonDays: Math.max(1, Math.min(730, Number(value?.maximumBookingHorizonDays ?? defaultOperationSettings.maximumBookingHorizonDays))),
    sameDayBookingCutoffMinutes: Math.max(0, Math.min(1440, Number(value?.sameDayBookingCutoffMinutes ?? defaultOperationSettings.sameDayBookingCutoffMinutes))),
    bufferBetweenAppointmentsMinutes: Math.max(0, Math.min(120, Number(value?.bufferBetweenAppointmentsMinutes ?? defaultOperationSettings.bufferBetweenAppointmentsMinutes))),
    availabilityCacheTtlSeconds: Math.max(5, Math.min(300, Number(value?.availabilityCacheTtlSeconds ?? defaultOperationSettings.availabilityCacheTtlSeconds))),
    queueRefreshSeconds: Math.max(5, Math.min(300, Number(value?.queueRefreshSeconds ?? defaultOperationSettings.queueRefreshSeconds))),
    queueBaseWaitMinutes: Math.max(1, Math.min(240, Number(value?.queueBaseWaitMinutes ?? defaultOperationSettings.queueBaseWaitMinutes))),
    allowWalkIn: typeof value?.allowWalkIn === 'boolean' ? value.allowWalkIn : defaultOperationSettings.allowWalkIn,
    requireProfessionalForWalkIn: typeof value?.requireProfessionalForWalkIn === 'boolean' ? value.requireProfessionalForWalkIn : defaultOperationSettings.requireProfessionalForWalkIn,
    queueVisibleLimit: Math.max(1, Math.min(20, Number(value?.queueVisibleLimit ?? defaultOperationSettings.queueVisibleLimit))),
    reportsDayStartTime: /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(String(value?.reportsDayStartTime || '')) ? value.reportsDayStartTime : defaultOperationSettings.reportsDayStartTime,
    reportsIncludeCancelled: typeof value?.reportsIncludeCancelled === 'boolean' ? value.reportsIncludeCancelled : defaultOperationSettings.reportsIncludeCancelled,
    reportsIncludeNoShow: typeof value?.reportsIncludeNoShow === 'boolean' ? value.reportsIncludeNoShow : defaultOperationSettings.reportsIncludeNoShow,
    reportsComparisonWindow: value?.reportsComparisonWindow === 'none' ? 'none' : defaultOperationSettings.reportsComparisonWindow,
    reportsRefreshSeconds: Math.max(15, Math.min(300, Number(value?.reportsRefreshSeconds ?? defaultOperationSettings.reportsRefreshSeconds))),
    reportsShowPendingValues: typeof value?.reportsShowPendingValues === 'boolean' ? value.reportsShowPendingValues : defaultOperationSettings.reportsShowPendingValues,
  };
};

let cachedSettings: OperationSettings | null = null;
let settingsPromise: Promise<OperationSettings> | null = null;

export function getCachedOperationSettings(): OperationSettings {
  return cachedSettings || defaultOperationSettings;
}

export async function fetchOperationSettings(forceRefresh = false): Promise<OperationSettings> {
  if (cachedSettings && !forceRefresh) return cachedSettings;
  if (settingsPromise && !forceRefresh) return settingsPromise;

  settingsPromise = (async () => {
    try {
      const response = await authFetch('/api/operation-settings');
      if (!response.ok) throw new Error('Falha ao buscar as configurações de Agenda.');
      const data = await response.json();
      cachedSettings = normalize(data);
      return cachedSettings;
    } catch (error) {
      console.warn('[OperationSettings] Usando defaults locais:', error);
      cachedSettings = defaultOperationSettings;
      return cachedSettings;
    } finally {
      settingsPromise = null;
    }
  })();

  return settingsPromise;
}

export async function saveOperationSettings(settings: OperationSettings): Promise<OperationSettings> {
  const payload = normalize(settings);
  const response = await authFetch('/api/operation-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Não foi possível salvar as configurações de Agenda.');
  }

  cachedSettings = normalize(data);
  return cachedSettings;
}
