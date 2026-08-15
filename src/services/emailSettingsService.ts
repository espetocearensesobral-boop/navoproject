import { authFetch } from '../lib/api';

export interface EmailSettings {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  // A senha nunca vem preenchida do servidor. hasPassword indica se já existe
  // uma senha salva; smtpPassword só é enviado de volta ao servidor quando o
  // admin realmente digita uma nova.
  hasPassword: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  notificationEmail: string;
  notifyOnBooking: boolean;
  notifyOnReschedule: boolean;
  notifyOnCancel: boolean;
}

export const defaultEmailSettings: EmailSettings = {
  enabled: false,
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  hasPassword: false,
  fromName: 'Navo Barber & Club',
  fromEmail: '',
  replyTo: '',
  notificationEmail: '',
  notifyOnBooking: true,
  notifyOnReschedule: true,
  notifyOnCancel: true,
};

export async function fetchEmailSettings(): Promise<EmailSettings> {
  const res = await authFetch('/api/email/config');
  if (!res.ok) {
    throw new Error('Não foi possível carregar as configurações de e-mail.');
  }
  const data = await res.json();
  return { ...defaultEmailSettings, ...data };
}

/**
 * `smtpPassword` só deve ser incluído em `data` quando o admin digitou uma
 * senha nova nesta sessão — caso contrário o backend preserva a senha salva.
 */
export async function saveEmailSettings(data: Partial<EmailSettings> & { smtpPassword?: string }): Promise<EmailSettings> {
  const res = await authFetch('/api/email/config', {
    method: 'PUT',
    body: JSON.stringify(data),
  });

  const resData = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(resData?.error || 'Erro ao salvar configurações de e-mail.');
  }

  return { ...defaultEmailSettings, ...resData.config };
}

export async function sendTestEmail(to: string): Promise<string> {
  const res = await authFetch('/api/email/test', {
    method: 'POST',
    body: JSON.stringify({ to }),
  });

  const resData = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(resData?.error || 'Erro ao enviar e-mail de teste.');
  }

  return resData.message || `E-mail de teste enviado para ${to}.`;
}
