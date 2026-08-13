/**
 * Módulo Central de Datas, Horários e Fuso Horário (America/Sao_Paulo - BRT)
 * Fonte Única de Verdade para o sistema de agendamentos.
 */

export const TIMEZONE = 'America/Sao_Paulo';

/**
 * Retorna a data atual no formato YYYY-MM-DD no fuso horário de Brasília (BRT)
 */
export function getTodayStringBRT(): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const result = formatter.format(now);
    if (/^\d{4}-\d{2}-\d{2}$/.test(result)) {
      return result;
    }
  } catch (e) {}

  // Fallback: UTC - 3 hours (Brasília time)
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const brtTime = new Date(utcTime - (3 * 3600 * 1000));
  const y = brtTime.getUTCFullYear();
  const m = String(brtTime.getUTCMonth() + 1).padStart(2, '0');
  const d = String(brtTime.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Retorna o horário atual (horas, minutos, string HH:mm e minutos totais) em BRT
 */
export function getCurrentTimeBRT(): { hours: number; minutes: number; timeStr: string; totalMinutes: number } {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    let hours = NaN;
    let minutes = NaN;
    for (const p of parts) {
      if (p.type === 'hour') hours = parseInt(p.value, 10);
      if (p.type === 'minute') minutes = parseInt(p.value, 10);
    }
    if (!isNaN(hours) && !isNaN(minutes)) {
      if (hours === 24) hours = 0;
      return {
        hours,
        minutes,
        timeStr: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
        totalMinutes: hours * 60 + minutes
      };
    }
  } catch (e) {}

  // Fallback: UTC - 3 hours (Brasília time)
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const brtTime = new Date(utcTime - (3 * 3600 * 1000));
  const hours = brtTime.getUTCHours();
  const minutes = brtTime.getUTCMinutes();
  return {
    hours,
    minutes,
    timeStr: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    totalMinutes: hours * 60 + minutes
  };
}

/**
 * Converte string "HH:mm" em minutos totais desde a meia-noite (00:00 = 0)
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return h * 60 + m;
}

/**
 * Converte minutos totais em string "HH:mm"
 */
export function minutesToTime(totalMins: number): string {
  const h = Math.floor(Math.max(0, totalMins) / 60);
  const m = Math.max(0, totalMins) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Formata data YYYY-MM-DD para o padrão brasileiro DD/MM/YYYY
 */
export function formatDateBR(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

/**
 * Soma (ou subtrai) dias a uma data YYYY-MM-DD sem depender do fuso horário
 * local do navegador/servidor. Opera sobre a string, não sobre `new Date()` local,
 * evitando desalinhamento quando o dispositivo do cliente está em outro fuso.
 */
export function addDaysBRT(dateStr: string, days: number): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  // Construção em UTC (meio-dia, pra evitar qualquer problema de horário de verão)
  // e cálculo puramente aritmético de calendário — não usa a hora local do ambiente.
  const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  const ny = utcDate.getUTCFullYear();
  const nm = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export type DayOfWeekKey = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

/**
 * Retorna a chave do dia da semana (sunday, monday, etc.) para uma data YYYY-MM-DD
 */
export function getDayOfWeekKey(dateStr: string): DayOfWeekKey {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'monday';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dayIndex = dateObj.getUTCDay();
  const keys: DayOfWeekKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return keys[dayIndex] || 'monday';
}

/**
 * Verifica se dois intervalos de tempo [startA, endA) e [startB, endB) se sobrepõem
 */
export function checkIntervalOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB;
}

/**
 * Calcula a duração total em minutos a partir de uma lista de serviços
 */
export function calculateTotalServicesDuration(services: Array<{ duration_minutes?: number; durationMinutes?: number; duration?: number }>): number {
  if (!Array.isArray(services) || services.length === 0) return 30;
  const total = services.reduce((sum, s) => {
    const dur = s.duration_minutes ?? s.durationMinutes ?? s.duration ?? 0;
    return sum + (typeof dur === 'number' && dur > 0 ? dur : 0);
  }, 0);
  return total > 0 ? total : 30;
}
