import * as schema from '../../src/db/schema.js';

export type PrintSettingsValue = {
  receiptFormat: 'thermal' | 'a4';
  reportFormat: 'thermal' | 'a4';
  qrFormat: 'thermal' | 'a4';
  thermalWidthMm: 58 | 80;
  a4Orientation: 'portrait' | 'landscape';
  fontSize: number;
  density: 'compact' | 'comfortable' | 'spacious';
  marginMm: number;
  showLogo: boolean;
  showClientData: boolean;
  showProfessional: boolean;
  showService: boolean;
  showPayment: boolean;
  showObservations: boolean;
  showQr: boolean;
  showFooter: boolean;
  footerText: string;
  reportIncludeCharts: boolean;
  reportIncludeDetails: boolean;
};

export const DEFAULT_PRINT_SETTINGS: PrintSettingsValue = {
  receiptFormat: 'thermal',
  reportFormat: 'a4',
  qrFormat: 'a4',
  thermalWidthMm: 80,
  a4Orientation: 'portrait',
  fontSize: 11,
  density: 'comfortable',
  marginMm: 8,
  showLogo: true,
  showClientData: true,
  showProfessional: true,
  showService: true,
  showPayment: true,
  showObservations: true,
  showQr: true,
  showFooter: true,
  footerText: 'Obrigado pela preferência.',
  reportIncludeCharts: true,
  reportIncludeDetails: true,
};

let cache: { value: PrintSettingsValue; expiresAt: number } | null = null;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => allowed.includes(value as T) ? value as T : fallback;
const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};

export const normalizePrintSettings = (raw: any): PrintSettingsValue => ({
  receiptFormat: oneOf(raw?.receiptFormat, ['thermal', 'a4'] as const, DEFAULT_PRINT_SETTINGS.receiptFormat),
  reportFormat: oneOf(raw?.reportFormat, ['thermal', 'a4'] as const, DEFAULT_PRINT_SETTINGS.reportFormat),
  qrFormat: oneOf(raw?.qrFormat, ['thermal', 'a4'] as const, DEFAULT_PRINT_SETTINGS.qrFormat),
  thermalWidthMm: (Number(raw?.thermalWidthMm) === 58 ? 58 : 80),
  a4Orientation: oneOf(raw?.a4Orientation, ['portrait', 'landscape'] as const, DEFAULT_PRINT_SETTINGS.a4Orientation),
  fontSize: clampInt(raw?.fontSize, 9, 18, DEFAULT_PRINT_SETTINGS.fontSize),
  density: oneOf(raw?.density, ['compact', 'comfortable', 'spacious'] as const, DEFAULT_PRINT_SETTINGS.density),
  marginMm: clampInt(raw?.marginMm, 0, 30, DEFAULT_PRINT_SETTINGS.marginMm),
  showLogo: raw?.showLogo !== false,
  showClientData: raw?.showClientData !== false,
  showProfessional: raw?.showProfessional !== false,
  showService: raw?.showService !== false,
  showPayment: raw?.showPayment !== false,
  showObservations: raw?.showObservations !== false,
  showQr: raw?.showQr === true,
  showFooter: raw?.showFooter !== false,
  footerText: typeof raw?.footerText === 'string' && raw.footerText.trim() ? raw.footerText.trim().slice(0, 180) : DEFAULT_PRINT_SETTINGS.footerText,
  reportIncludeCharts: raw?.reportIncludeCharts !== false,
  reportIncludeDetails: raw?.reportIncludeDetails !== false,
});

const fromRow = (row: any): PrintSettingsValue => normalizePrintSettings({
  receiptFormat: row.receiptFormat,
  reportFormat: row.reportFormat,
  qrFormat: row.qrFormat,
  thermalWidthMm: row.thermalWidthMm,
  a4Orientation: row.a4Orientation,
  fontSize: row.fontSize,
  density: row.density,
  marginMm: row.marginMm,
  showLogo: row.showLogo,
  showClientData: row.showClientData,
  showProfessional: row.showProfessional,
  showService: row.showService,
  showPayment: row.showPayment,
  showObservations: row.showObservations,
  showQr: row.showQr,
  showFooter: row.showFooter,
  footerText: row.footerText,
  reportIncludeCharts: row.reportIncludeCharts,
  reportIncludeDetails: row.reportIncludeDetails,
});

export async function getPrintSettings(dbLike: any): Promise<PrintSettingsValue> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const row = await dbLike.query.printSettings.findFirst();
  const value = row ? fromRow(row) : DEFAULT_PRINT_SETTINGS;
  cache = { value, expiresAt: Date.now() + 30_000 };
  return value;
}

export function invalidatePrintSettingsCache() {
  cache = null;
}

export async function savePrintSettings(dbLike: any, value: PrintSettingsValue) {
  const normalized = normalizePrintSettings(value);
  const [row] = await dbLike.insert(schema.printSettings).values({
    id: 'default',
    ...normalized,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: schema.printSettings.id,
    set: { ...normalized, updatedAt: new Date() },
  }).returning();
  const result = row ? fromRow(row) : normalized;
  cache = { value: result, expiresAt: Date.now() + 30_000 };
  return result;
}
