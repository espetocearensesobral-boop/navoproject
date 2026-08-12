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

export async function fetchDaySlotContext(dateStr: string, excludeAptId?: string): Promise<DaySlotContext> {
  let shopProf: any = { id: 'shop', name: 'Barbearia', roleTitle: 'System', workingHours: {} };
  let allAppointments: any[] = [];
  let allBlocks: any[] = [];
  let allProfessionals: any[] = [];

  const shopSettings = await db.query.shopSettings.findFirst({ where: eq(schema.shopSettings.id, 'default') }).catch(() => null);
  if (shopSettings) {
    shopProf.workingHours = shopSettings.workingHours || {};
    shopProf.operatingSchedule = shopSettings.operatingSchedule || {};
    shopProf.allowOutsideHoursApproval = shopSettings.allowOutsideHoursApproval;
  }

  allAppointments = await db.query.appointments.findMany({
    where: eq(schema.appointments.date, dateStr)
  }).catch(() => []);

  if (excludeAptId) {
    allAppointments = allAppointments.filter((apt: any) => apt.id !== excludeAptId);
  }
  
  allAppointments = allAppointments.filter((apt: any) => apt.status !== 'cancelled');

  allBlocks = await db.query.scheduleBlocks.findMany({
    where: eq(schema.scheduleBlocks.date, dateStr)
  }).catch(() => []);

  allProfessionals = await db.query.professionals.findMany({
    where: eq(schema.professionals.isActive, true)
  }).catch(() => []);

  return { shopProf, allAppointments, allBlocks, allProfessionals };
}

export async function checkSlotAvailability(params: CheckSlotParams): Promise<CheckSlotResult> {
  const { dateStr, startMins, reqDuration, profId, excludeAptId, todayBRT, currTimeBRT, debug, preloaded } = params;
  const endMins = startMins + reqDuration;
  
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
  if (isPast) {
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
      if (profId) possibleProf = allProfessionals.find((p: any) => p.id === profId);
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

  let profsToCheck = profId ? allProfessionals.filter((p: any) => p.id === profId) : allProfessionals;

  if (profsToCheck.length === 0) {
    return { statusCode: 'PROFESSIONAL_UNAVAILABLE', available: false, reason: 'Nenhum profissional disponível' };
  }

  let chosenProf = null;
  let requireApprov = false;

  for (const prof of profsToCheck) {
    const pWorkingHours = prof.workingHours || {};
    const pDay = pWorkingHours[dayKey];
    let isProfOutside = false;

    if (pDay && !pDay.isOff) {
       const pStart = timeToMinutes(pDay.start || '09:00');
       const pEnd = timeToMinutes(pDay.end || '21:00');
       if (startMins < pStart || endMins > pEnd) {
          isProfOutside = true;
       }
    } else if (pDay && pDay.isOff) {
       isProfOutside = true;
    }

    if (isProfOutside && !shopProf.allowOutsideHoursApproval) {
      continue;
    }

    const profApts = allAppointments.filter((a: any) => a.professionalId === prof.id);
    const hasAptConflict = profApts.some((a: any) => {
      const aStart = timeToMinutes(a.timeSlot);
      const aEnd = aStart + Number(a.totalDurationMinutes || 30);
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
