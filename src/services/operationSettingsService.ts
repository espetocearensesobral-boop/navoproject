import { authFetch } from '../lib/api';

export interface OperationSettings {
  id?: string;
  slotIntervalMinutes: number;
  minimumBookingLeadMinutes: number;
  maximumBookingHorizonDays: number;
  sameDayBookingCutoffMinutes: number;
  bufferBetweenAppointmentsMinutes: number;
  availabilityCacheTtlSeconds: number;
  updatedAt?: string | null;
}

export const defaultOperationSettings: OperationSettings = {
  slotIntervalMinutes: 30,
  minimumBookingLeadMinutes: 0,
  maximumBookingHorizonDays: 90,
  sameDayBookingCutoffMinutes: 0,
  bufferBetweenAppointmentsMinutes: 0,
  availabilityCacheTtlSeconds: 20,
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
