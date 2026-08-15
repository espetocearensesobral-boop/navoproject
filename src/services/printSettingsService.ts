import { authFetch } from '../lib/api';

export type PrintFormat = 'thermal' | 'a4';
export type PrintDensity = 'compact' | 'comfortable' | 'spacious';

export interface PrintSettings {
  receiptFormat: PrintFormat;
  reportFormat: PrintFormat;
  qrFormat: PrintFormat;
  thermalWidthMm: 58 | 80;
  a4Orientation: 'portrait' | 'landscape';
  fontSize: number;
  density: PrintDensity;
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
}

export const defaultPrintSettings: PrintSettings = {
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

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await authFetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível carregar as configurações de impressão.');
  return data as T;
}

export async function fetchPrintSettings(): Promise<PrintSettings> {
  return request<PrintSettings>('/api/print-settings');
}

export async function savePrintSettings(settings: PrintSettings): Promise<PrintSettings> {
  return request<PrintSettings>('/api/print-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}
