import * as schema from '../../src/db/schema.js';

export interface OperationSettingsValue {
  id?: string;
  slotIntervalMinutes: number;
  minimumBookingLeadMinutes: number;
  maximumBookingHorizonDays: number;
  sameDayBookingCutoffMinutes: number;
  bufferBetweenAppointmentsMinutes: number;
  availabilityCacheTtlSeconds: number;
  updatedAt?: Date | string | null;
}

export const DEFAULT_OPERATION_SETTINGS: OperationSettingsValue = {
  slotIntervalMinutes: 30,
  minimumBookingLeadMinutes: 0,
  maximumBookingHorizonDays: 90,
  sameDayBookingCutoffMinutes: 0,
  bufferBetweenAppointmentsMinutes: 0,
  availabilityCacheTtlSeconds: 20,
};

const clampInteger = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

export function normalizeOperationSettings(value: Partial<OperationSettingsValue> | null | undefined): OperationSettingsValue {
  const rawInterval = Number(value?.slotIntervalMinutes);
  const allowedIntervals = [5, 10, 15, 20, 30, 60];
  const slotIntervalMinutes = allowedIntervals.includes(rawInterval) ? rawInterval : DEFAULT_OPERATION_SETTINGS.slotIntervalMinutes;

  return {
    id: value?.id || 'default',
    slotIntervalMinutes,
    minimumBookingLeadMinutes: clampInteger(value?.minimumBookingLeadMinutes, 0, 10080, DEFAULT_OPERATION_SETTINGS.minimumBookingLeadMinutes),
    maximumBookingHorizonDays: clampInteger(value?.maximumBookingHorizonDays, 1, 730, DEFAULT_OPERATION_SETTINGS.maximumBookingHorizonDays),
    sameDayBookingCutoffMinutes: clampInteger(value?.sameDayBookingCutoffMinutes, 0, 1440, DEFAULT_OPERATION_SETTINGS.sameDayBookingCutoffMinutes),
    bufferBetweenAppointmentsMinutes: clampInteger(value?.bufferBetweenAppointmentsMinutes, 0, 120, DEFAULT_OPERATION_SETTINGS.bufferBetweenAppointmentsMinutes),
    availabilityCacheTtlSeconds: clampInteger(value?.availabilityCacheTtlSeconds, 5, 300, DEFAULT_OPERATION_SETTINGS.availabilityCacheTtlSeconds),
    updatedAt: value?.updatedAt || null,
  };
}

export function mapOperationSettings(row: any): OperationSettingsValue {
  return normalizeOperationSettings({
    id: row?.id,
    slotIntervalMinutes: row?.slotIntervalMinutes ?? row?.slot_interval_minutes,
    minimumBookingLeadMinutes: row?.minimumBookingLeadMinutes ?? row?.minimum_booking_lead_minutes,
    maximumBookingHorizonDays: row?.maximumBookingHorizonDays ?? row?.maximum_booking_horizon_days,
    sameDayBookingCutoffMinutes: row?.sameDayBookingCutoffMinutes ?? row?.same_day_booking_cutoff_minutes,
    bufferBetweenAppointmentsMinutes: row?.bufferBetweenAppointmentsMinutes ?? row?.buffer_between_appointments_minutes,
    availabilityCacheTtlSeconds: row?.availabilityCacheTtlSeconds ?? row?.availability_cache_ttl_seconds,
    updatedAt: row?.updatedAt ?? row?.updated_at,
  });
}

let cachedSettings: OperationSettingsValue | null = null;
let cachedAt = 0;

export function invalidateOperationSettingsCache() {
  cachedSettings = null;
  cachedAt = 0;
}

export async function getOperationSettings(db: any, forceRefresh = false): Promise<OperationSettingsValue> {
  const ttlMs = (cachedSettings?.availabilityCacheTtlSeconds || DEFAULT_OPERATION_SETTINGS.availabilityCacheTtlSeconds) * 1000;
  if (!forceRefresh && cachedSettings && Date.now() - cachedAt < ttlMs) return cachedSettings;

  const row = await db.query.operationSettings.findFirst({ where: (table: any, { eq }: any) => eq(table.id, 'default') }).catch(() => null);
  cachedSettings = mapOperationSettings(row);
  cachedAt = Date.now();
  return cachedSettings;
}

export const operationSettingsTable = schema.operationSettings;
