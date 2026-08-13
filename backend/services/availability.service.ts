import { db } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { timeToMinutes, minutesToTime, getDayOfWeekKey } from '../utils/datetime.js';
import { and, eq, or } from 'drizzle-orm';

interface CheckSlotParams {
  dateStr: string;
  startMins: number;
  reqDuration: number;
  profId?: string;
  excludeAptId?: string;
  todayBRT: string;
  currTimeBRT: { totalMinutes: number; timeStr: string };
  debug?: boolean;
  allowPast?: boolean;
  preloaded?: DaySlotContext;
}

interface CheckSlotResult {
  statusCode: 'AVAILABLE' | 'REQUIRES_APPROVAL' | 'PAST_TIME' | 'SHOP_CLOSED' | 'CONFIRMED_OCCUPIED' | 'BLOCKED' | 'PROFESSIONAL_UNAVAILABLE';
  available: boolean;
  requiresApproval?: boolean;
  isOutsideHours?: boolean;
  chosenProf?: any;
  reason?: string;
  endMins?: number;
  closeMins?: number;
}

interface DaySlotContext {
  shopProf: any;
  allAppointments: any[];
  allBlocks: any[];
  allProfessionals: any[];
}

let cachedShopSettings: { data: any; timestamp: number } | null = null;
let cachedProfessionals: { data: any[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 20000;

type NormalizedProfessionalDay = {
  closed: boolean;
  start: number;
  end: number;
};

const professionalDayAliases: Record<string, string[]> = {
  sunday: ['sunday', 'sun'],
  monday: ['monday', 'mon'],
  tuesday: ['tuesday', 'tue'],
  wednesday: ['wednesday', 'wed'],
  thursday: ['thursday', 'thu'],
  friday: ['friday', 'fri'],
  saturday: ['saturday', 'sat'],
};

function parseProfessionalDay(value: unknown): NormalizedProfessionalDay | null {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['off', 'closed', 'fechado', 'folga'].includes(normalized)) {
      return { closed: true, start: 0, end: 0 };
    }
    const match = normalized.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
    if (!match) return null;
    const start = timeToMinutes(match[1]);
    const end = timeToMinutes(match[2]);
    return end > start ? { closed: false, start, end } : { closed: true, start, end };
  }

  if (!value || typeof value !== 'object') return null;
  const day = value as Record<string, unknown>;
  if (day.isOff === true || day.closed === true || day.active === false) {
    return { closed: true, start: 0, end: 0 };
  }

  const startValue = day.start ?? day.open;
  const endValue = day.end ?? day.close;
  if (typeof startValue !== 'string' || typeof endValue !== 'string') return null;
  const start = timeToMinutes(startValue);
  const end = timeToMinutes(endValue);
  return end > start ? { closed: false, start, end } : { closed: true, start, end };
}

function getProfessionalDaySchedule(professional: any, dayKey: string): NormalizedProfessionalDay | null {
  const workingHours = professional?.workingHours;
  if (!workingHours || typeof workingHours !== 'object') return null;

  const aliases = professionalDayAliases[dayKey] || [dayKey];
  const directKey = aliases.find((key) => Object.prototype.hasOwnProperty.call(workingHours, key));
  if (directKey) {
    return parseProfessionalDay(workingHours[directKey]);
  }

  // Compatibilidade com o formato legado { days: ['mon', ...], start, end }.
  if (Array.isArray(workingHours.days)) {
    const worksThatDay = aliases.some((key) => workingHours.days.includes(key));
    if (!worksThatDay) return { closed: true, start: 0, end: 0 };
    return parseProfessionalDay({ start: workingHours.start, end: workingHours.end });
  }

  return null;
}

export function invalidateAvailabilityCache() {
  cachedShopSettings = null;
  cachedProfessionals = null;
}

export async function fetchDaySlotContext(dateStr: string, excludeAptId?: string): Promise<DaySlotContext> {
  let shopProf: any = { id: 'shop', name: 'Barbearia', roleTitle: 'System', workingHours: {} };
  const now = Date.now();

  const getShopSettings = async () => {
    if (cachedShopSettings && (now - cachedShopSettings.timestamp) < CACHE_TTL_MS) {
      return cachedShopSettings.data;
    }
    const res = await db.query.shopSettings.findFirst({ where: eq(schema.shopSettings.id, 'default') }).catch(() => null);
    if (res) cachedShopSettings = { data: res, timestamp: now };
    return res;
  };

  const getProfessionals = async () => {
    if (cachedProfessionals && (now - cachedProfessionals.timestamp) < CACHE_TTL_MS) {
      return cachedProfessionals.data;
    }
    const res = await db.query.professionals.findMany({ where: eq(schema.professionals.isActive, true) }).catch(() => []);
    if (res && res.length > 0) cachedProfessionals = { data: res, timestamp: now };
    return res;
  };

  const [shopSettings, rawAppointments, rawBlocks, professionalsList] = await Promise.all([
    getShopSettings(),
    db.query.appointments.findMany({ where: eq(schema.appointments.date, dateStr) }).catch(() => []),
    db.query.scheduleBlocks.findMany({ where: eq(schema.scheduleBlocks.date, dateStr) }).catch(() => []),
    getProfessionals()
  ]);

  if (shopSettings) {
    shopProf.workingHours = shopSettings.workingHours || {};
    shopProf.operatingSchedule = shopSettings.operatingSchedule || {};
    shopProf.allowOutsideHoursApproval = shopSettings.allowOutsideHoursApproval;
  }

  let allAppointments = rawAppointments.filter((apt: any) => apt.status !== 'cancelled');
  if (excludeAptId) {
    allAppointments = allAppointments.filter((apt: any) => apt.id !== excludeAptId);
  }

  return { shopProf, allAppointments, allBlocks: rawBlocks, allProfessionals: professionalsList };
}

export async function checkSlotAvailability(params: CheckSlotParams): Promise<CheckSlotResult> {
  const { dateStr, startMins, reqDuration, profId, excludeAptId, todayBRT, currTimeBRT, debug, allowPast = false, preloaded } = params;
  const safeDuration = Number.isInteger(reqDuration) && reqDuration >= 5 && reqDuration <= 480 ? reqDuration : 30;
  const endMins = startMins + safeDuration;
  
  const ctx = preloaded || await fetchDaySlotContext(dateStr, excludeAptId);
  const { shopProf, allAppointments, allBlocks, allProfessionals } = ctx;

  const dayKey = getDayOfWeekKey(dateStr);
  const daySchedule = shopProf.operatingSchedule?.[dayKey];

  if (daySchedule && daySchedule.isClosed) {
    return { statusCode: 'SHOP_CLOSED', available: false, reason: 'Barbearia fechada neste dia' };
  }

  const openStr = daySchedule?.open || shopProf.openTime || '09:00';
  const closeStr = daySchedule?.close || shopProf.closeTime || '21:00';
  const openMins = timeToMinutes(openStr);
  const closeMins = timeToMinutes(closeStr);

  const isPast = (dateStr < todayBRT) || (dateStr === todayBRT && startMins < currTimeBRT.totalMinutes);
  if (isPast && !allowPast) {
    return { statusCode: 'PAST_TIME', available: false, reason: 'Horário no passado' };
  }

  const isOutside = startMins < openMins || endMins > closeMins;
  if (isOutside) {
    if (shopProf.allowOutsideHoursApproval) {
      const isExtremeOutside = startMins < (openMins - 90) || endMins > (closeMins + 90);
      if (isExtremeOutside) {
         return { statusCode: 'SHOP_CLOSED', available: false, reason: 'Horário muito fora do expediente' };
      }
      let possibleProf = null;
      if (profId && profId !== 'prof_any') possibleProf = allProfessionals.find((p: any) => p.id === profId);
      else if (allProfessionals.length > 0) possibleProf = allProfessionals[0];

      return {
        statusCode: 'REQUIRES_APPROVAL',
        available: true,
        requiresApproval: true,
        isOutsideHours: true,
        reason: 'Fora do horário (Sujeito a aprovação)',
        chosenProf: possibleProf
      };
    } else {
      return { statusCode: 'SHOP_CLOSED', available: false, reason: 'Fora do horário de funcionamento' };
    }
  }

  // `prof_any` é uma opção virtual da UI, não um registro no banco.
  // Sem um profissional específico, a disponibilidade é a união dos profissionais ativos.
  const requestedProfId = profId && profId !== 'prof_any' ? profId : '';
  const profsToCheck = requestedProfId
    ? allProfessionals.filter((p: any) => p.id === requestedProfId)
    : allProfessionals;

  if (profsToCheck.length === 0) {
    return { statusCode: 'PROFESSIONAL_UNAVAILABLE', available: false, reason: 'Nenhum profissional disponível' };
  }

  let chosenProf = null;
  let requireApprov = false;

  for (const prof of profsToCheck) {
    const pDay = getProfessionalDaySchedule(prof, dayKey);
    // Folga individual nunca pode ser liberada pela aprovação fora do expediente.
    if (pDay?.closed) continue;

    const isProfOutside = !!pDay && (startMins < pDay.start || endMins > pDay.end);
    if (isProfOutside && !shopProf.allowOutsideHoursApproval) {
      continue;
    }

    const profApts = allAppointments.filter((a: any) => a.professionalId === prof.id);
    const hasAptConflict = profApts.some((a: any) => {
      const aStart = timeToMinutes(a.timeSlot);
      const aDuration = Number(a.totalDurationMinutes || 30);
      const aEnd = aStart + (Number.isFinite(aDuration) && aDuration > 0 ? aDuration : 30);
      return Math.max(startMins, aStart) < Math.min(endMins, aEnd);
    });

    if (hasAptConflict) continue;

    const profBlocks = allBlocks.filter((b: any) => !b.professionalId || b.professionalId === prof.id || b.professionalId === 'all');
    const hasBlockConflict = profBlocks.some((b: any) => {
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);
      return Math.max(startMins, bStart) < Math.min(endMins, bEnd);
    });

    if (hasBlockConflict) continue;

    chosenProf = prof;
    if (isProfOutside && shopProf.allowOutsideHoursApproval) {
       requireApprov = true;
    } else {
       requireApprov = false;
       break;
    }
  }

  if (chosenProf) {
    return {
      statusCode: requireApprov ? 'REQUIRES_APPROVAL' : 'AVAILABLE',
      available: true,
      requiresApproval: requireApprov,
      isOutsideHours: requireApprov,
      chosenProf,
      endMins,
      closeMins
    };
  }

  return { statusCode: 'CONFIRMED_OCCUPIED', available: false, reason: 'Horário ocupado para todos os profissionais' };
}
