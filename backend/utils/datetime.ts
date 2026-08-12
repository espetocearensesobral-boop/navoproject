import { TIMEZONE } from '../constants.js';

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

  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const brtTime = new Date(utcTime - (3 * 3600 * 1000));
  const y = brtTime.getUTCFullYear();
  const m = String(brtTime.getUTCMonth() + 1).padStart(2, '0');
  const d = String(brtTime.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return h * 60 + m;
}

export function minutesToTime(totalMins: number): string {
  const h = Math.floor(Math.max(0, totalMins) / 60);
  const m = Math.max(0, totalMins) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getDayOfWeekKey(dateStr: string): 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'monday';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayIndex = dateObj.getDay();
  const keys: ('sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday')[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];
  return keys[dayIndex] || 'monday';
}

export function checkIntervalOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB;
}
