import { addDaysBRT, getDayOfWeekKey, getTodayStringBRT } from '../utils/datetime.js';

export type NavoBotIntent =
  | 'menu'
  | 'appointments'
  | 'book'
  | 'confirm'
  | 'reschedule'
  | 'cancel'
  | 'human'
  | 'unknown';

export type ExtractedEvolutionMessage = {
  instanceName: string;
  messageId: string;
  phone: string;
  text: string;
  pushName?: string;
};

const WEEKDAY_ALIASES: Record<string, keyof typeof WEEKDAY_OFFSETS> = {
  domingo: 'sunday',
  segunda: 'monday',
  'segunda-feira': 'monday',
  terca: 'tuesday',
  terça: 'tuesday',
  'terca-feira': 'tuesday',
  'terça-feira': 'tuesday',
  quarta: 'wednesday',
  'quarta-feira': 'wednesday',
  quinta: 'thursday',
  'quinta-feira': 'thursday',
  sexta: 'friday',
  'sexta-feira': 'friday',
  sabado: 'saturday',
  sábado: 'saturday',
};

const WEEKDAY_OFFSETS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
} as const;

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function classifyDeterministicIntent(text: string): NavoBotIntent | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  if (/^1(?:\s*[-.)]|\s|$)/.test(normalized)) return 'book';
  if (/^2(?:\s*[-.)]|\s|$)/.test(normalized)) return 'appointments';
  if (/^3(?:\s*[-.)]|\s|$)/.test(normalized)) return 'reschedule';
  if (/^4(?:\s*[-.)]|\s|$)/.test(normalized)) return 'cancel';
  if (/^5(?:\s*[-.)]|\s|$)/.test(normalized)) return 'human';
  if (/^(oi|ola|olá|menu|inicio|início|ajuda|bom dia|boa tarde|boa noite)\b/.test(normalized)) return 'menu';
  if (/\b(atendente|humano|pessoa|equipe|falar com alguem|falar com alguém)\b/.test(normalized)) return 'human';
  if (/\b(cancelar|cancela|cancelamento)\b/.test(normalized)) return 'cancel';
  if (/\b(reagendar|remarcar|mudar (o )?horario|trocar (o )?horario|alterar (o )?agendamento)\b/.test(normalized)) return 'reschedule';
  if (/\b(agendar|agenda[r]?|marcar|novo agendamento|quero cortar|quero fazer)\b/.test(normalized)) return 'book';
  if (/\b(confirmar|confirmo|confirma|confirmacao|confirmação|esta confirmado|está confirmado)\b/.test(normalized)) return 'confirm';
  if (/\b(meu agendamento|minha agenda|minhas reservas|minha reserva|ver agendamento|consultar agendamento|voucher)\b/.test(normalized)) return 'appointments';
  return null;
}

export function isPositiveConfirmation(text: string): boolean {
  return /^(sim|s|ok|okay|pode|confirmo|confirmar|isso|perfeito|fechar|fechado|vamos|pode ser|pode fazer)\b/i.test(normalizeText(text));
}

export function isNegativeConfirmation(text: string): boolean {
  return /^(nao|não|n|cancelar|cancela|desistir|voltar|sair)\b/i.test(normalizeText(text));
}

export function parseTimeFromText(text: string): string | null {
  const normalized = normalizeText(text);
  const match = normalized.match(/\b(?:as|a|horario|horas)?\s*(\d{1,2})(?:\s*[:h]\s*(\d{2}))?\s*(?:h|horas)?\b/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (!Number.isInteger(hours) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseDateFromText(text: string, today = getTodayStringBRT()): string | null {
  const normalized = normalizeText(text);
  if (/\bhoje\b/.test(normalized)) return today;
  if (/\bamanha\b/.test(normalized)) return addDaysBRT(today, 1);
  if (/\bdepois de amanha\b/.test(normalized)) return addDaysBRT(today, 2);

  const isoMatch = normalized.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const brMatch = normalized.match(/\b(\d{1,2})[\/]([01]?\d)[\/]?(20\d{2})?\b/);
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]);
    const year = Number(brMatch[3] || today.slice(0, 4));
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const weekday = Object.entries(WEEKDAY_ALIASES).find(([alias]) => normalized.includes(alias))?.[1];
  if (weekday) {
    const todayKey = getDayOfWeekKey(today);
    const todayOffset = WEEKDAY_OFFSETS[todayKey];
    const targetOffset = WEEKDAY_OFFSETS[weekday];
    const delta = (targetOffset - todayOffset + 7) % 7 || 7;
    return addDaysBRT(today, delta);
  }

  return null;
}

export function extractBookingCode(text: string): string | null {
  const normalized = text.toUpperCase();
  const labeled = normalized.match(/\b(?:VOUCHER|CÓDIGO|CODIGO|RESERVA)\b\s*(?:É|E|:|-)?\s*([A-Z0-9]{4,})\b/);
  if (labeled?.[1] && /\d/.test(labeled[1])) return labeled[1];
  const match = normalized.match(/\b[A-Z]{2,8}[A-Z0-9]*\d[A-Z0-9]*\b/);
  return match?.[0] || null;
}

export function extractEvolutionMessage(payload: any): ExtractedEvolutionMessage | null {
  const event = String(payload?.event || '').toLowerCase();
  if (event && !event.includes('messages.upsert') && !event.includes('messages_upsert')) return null;

  const data = payload?.data || payload;
  const key = data?.key || {};
  if (key.fromMe === true) return null;

  const remoteJid = String(key.remoteJid || '').trim();
  if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast')) return null;
  const alternativeJid = String(key.remoteJidAlt || key.senderPn || data?.sender || payload?.sender || '').trim();
  const resolvedJid = remoteJid.endsWith('@lid') ? alternativeJid : remoteJid;
  if (!resolvedJid || resolvedJid.endsWith('@lid')) return null;

  const rawText = data?.message?.conversation
    || data?.message?.extendedTextMessage?.text
    || data?.message?.imageMessage?.caption
    || data?.message?.buttonsResponseMessage?.selectedButtonId
    || data?.message?.listResponseMessage?.singleSelectReply?.selectedRowId
    || data?.message?.templateButtonReplyMessage?.selectedId
    || '';
  const text = String(rawText).trim();
  const digits = resolvedJid.replace(/\D/g, '');
  if (!text || digits.length < 8) return null;

  return {
    instanceName: String(payload?.instance || data?.instance || ''),
    messageId: String(key.id || `${digits}:${data?.messageTimestamp || Date.now()}`),
    phone: digits,
    text,
    pushName: data?.pushName ? String(data.pushName) : undefined,
  };
}

export function normalizeIntentName(value: unknown): NavoBotIntent {
  const normalized = normalizeText(String(value || ''));
  if (['menu', 'inicio', 'ajuda'].includes(normalized)) return 'menu';
  if (['appointments', 'agendamentos', 'agenda'].includes(normalized)) return 'appointments';
  if (['book', 'agendar', 'marcar'].includes(normalized)) return 'book';
  if (['confirm', 'confirmar'].includes(normalized)) return 'confirm';
  if (['reschedule', 'reagendar', 'remarcar'].includes(normalized)) return 'reschedule';
  if (['cancel', 'cancelar'].includes(normalized)) return 'cancel';
  if (['human', 'humano', 'atendente'].includes(normalized)) return 'human';
  return 'unknown';
}
